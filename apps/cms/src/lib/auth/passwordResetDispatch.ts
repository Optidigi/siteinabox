// Collection backend hooks also load in Payload's owning CLI generators.
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres"
import { Forbidden, type CollectionBeforeOperationHook, type CollectionAfterOperationHook, type PayloadRequest } from "payload"
import type { User } from "@/payload-types"
import { asRecord, queryRows } from "@/lib/record"
import { relationshipId } from "@/lib/relationshipId"
import { assertPayloadCustomerActive } from "./payloadCustomerAccess"
import { AccountLinkError } from "./accountLinkTypes"
import { admitAccountLink, accountLinkFingerprint, type AccountLinkLease } from "./accountLinkStore"
import { getSuperAdminOrigin } from "./passwordRecovery"
import { CustomerIdentityError } from "./verifiedCustomer"
import { accountLinkLocale } from "./accountLinkLocale"

type ResetInvocation = { user: User; lease?: AccountLinkLease }
const resets = new WeakMap<PayloadRequest, ResetInvocation>()
const consuming = new WeakMap<PayloadRequest, number>()

export const authorizePasswordResetConsumption: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== "resetPassword") return args
  const token = asRecord(args.data)?.token
  if (typeof token !== "string" || !token) throw new Forbidden()
  const tx = await req.transactionID
  const db = tx && (req.payload.db as unknown as PostgresAdapter).sessions[tx]?.db
  if (!db) throw new AccountLinkError("E_ACCOUNT_LINK_TRANSACTION")
  // Includes old compatible links and trusted token-only Local API recovery.
  // Serialize their consumption too, before Payload reads or rotates credentials.
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${accountLinkFingerprint("reset-consume", token)},0))`)
  let user = await req.payload.db.findOne<User>({ collection: "users", req,
    where: { resetPasswordToken: { equals: token } } })
  if (!user) throw new Forbidden()
  await db.execute(sql`SELECT id FROM customer_accounts WHERE payload_user_id=${user.id} FOR SHARE`)
  await db.execute(sql`SELECT id FROM users WHERE id=${user.id} FOR UPDATE`)
  user = await req.payload.db.findOne<User>({ collection: "users", req, where: { resetPasswordToken: { equals: token } } })
  const expires = Date.parse(user?.resetPasswordExpiration ?? "")
  if (!user || !Number.isFinite(expires) || expires <= Date.now()) throw new Forbidden()
  await assertPayloadCustomerActive(req.payload, user.id)
  const receipt = (await req.payload.find({ collection: "account-link-dispatches", overrideAccess: true, req,
    where: { tokenFingerprint: { equals: accountLinkFingerprint("payload", token) } }, depth: 0, limit: 1 })).docs[0]
  if (receipt) {
    if (receipt.namespace !== "payload" || receipt.purpose !== "password_reset" || receipt.payloadUserId !== String(user.id) ||
      receipt.recipient !== user.email.trim().toLowerCase() || receipt.role !== user.role ||
      (receipt.tenantId ?? null) !== relationshipId(user.tenants?.[0]?.tenant)) throw new Forbidden()
    const changed = queryRows(await db.execute(sql`UPDATE account_link_dispatches SET state='consumed', active_key=NULL,
      updated_at=clock_timestamp() WHERE id=${receipt.id} AND state IN ('queued','issuing','dispatching','sent','indeterminate')
      AND expires_at>clock_timestamp() RETURNING id`))
    if (changed.length !== 1) throw new Forbidden()
  }
  consuming.set(req, expires)
  return args
}

export const preparePasswordResetDispatch: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  // Explicit disableEmail is a trusted Local API facility; HTTP does not expose
  // that option. Preserve its existing token-only behavior.
  if (operation !== "forgotPassword" || args.disableEmail === true) return args
  const email = asRecord(args.data)?.email
  if (typeof email !== "string") return args
  const recipient = email.trim().toLowerCase()
  const tx = await req.transactionID
  const db = tx && (req.payload.db as unknown as PostgresAdapter).sessions[tx]?.db
  if (!db) throw new AccountLinkError("E_ACCOUNT_LINK_TRANSACTION")
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"payload-reset:" + recipient},0))`)
  const user = await req.payload.db.findOne<User>({ collection: "users", req, where: { email: { equals: recipient } } })
  // Stop Payload's synchronous mail path. afterOperation stages only; the
  // existing worker observes the token and receipt after this transaction commits.
  args.disableEmail = true
  if (!user) return args
  try { await assertPayloadCustomerActive(req.payload, user.id) }
  catch (error) {
    if (!(error instanceof CustomerIdentityError)) throw error
    resets.set(req, { user })
    return args
  }
  const tenants = user.tenants ?? []
  if ((user.role === "super-admin" && tenants.length !== 0) || (user.role !== "super-admin" && tenants.length !== 1)) {
    resets.set(req, { user })
    return args
  }
  const admission = await admitAccountLink(req.payload, { namespace: "payload", purpose: "password_reset", lane: "protected",
    recipient, payloadUserId: String(user.id), role: user.role, tenantId: relationshipId(tenants[0]?.tenant) ?? undefined,
    origin: getSuperAdminOrigin(), callbackPath: "/reset-password", errorCallbackPath: "/forgot-password",
    metadata: { locale: accountLinkLocale(req.headers) } })
  resets.set(req, { user, lease: admission.kind === "claimed" ? admission.lease : undefined })
  return args
}

export const stagePasswordResetDispatch: CollectionAfterOperationHook = async ({ operation, req, result }) => {
  if (operation === "resetPassword") {
    const expires = consuming.get(req)
    consuming.delete(req)
    if (!expires || expires <= Date.now()) throw new Forbidden()
    return result
  }
  if (operation !== "forgotPassword") return result
  const invocation = resets.get(req)
  if (!invocation) return result
  resets.delete(req)
  if (!invocation.lease) {
    // A duplicate must preserve a possibly delivered token, not silently rotate
    // it while suppressing the second message. This write shares Payload's txn.
    await req.payload.db.updateOne({ collection: "users", id: invocation.user.id, req,
      data: { resetPasswordToken: invocation.user.resetPasswordToken ?? null,
        resetPasswordExpiration: invocation.user.resetPasswordExpiration ?? null } })
    return invocation.user.resetPasswordToken ?? null
  }
  const token = result
  if (typeof token !== "string" || !token) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
  const user = await req.payload.db.findOne<User>({ collection: "users", req, where: { id: { equals: invocation.user.id } } })
  if (!user?.resetPasswordExpiration || user.resetPasswordToken !== token) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
  const tx = await req.transactionID
  const db = tx && (req.payload.db as unknown as PostgresAdapter).sessions[tx]?.db
  if (!db) throw new AccountLinkError("E_ACCOUNT_LINK_TRANSACTION")
  const { lease } = invocation
  const changed = queryRows(await db.execute(sql`
    UPDATE account_link_dispatches SET state='queued', token_fingerprint=${accountLinkFingerprint("payload", token)},
      verification_id=${String(user.id)}, expires_at=${user.resetPasswordExpiration}, lease_token_hash=NULL, lease_until=NULL,
      retention_after=${new Date(Date.parse(user.resetPasswordExpiration) + 86_400_000).toISOString()}, updated_at=clock_timestamp()
    WHERE id=${lease.id} AND fence=${lease.fence} AND lease_token_hash=${accountLinkFingerprint("lease", lease.token)}
      AND state='admitted' AND lease_until>clock_timestamp() RETURNING id`))
  if (changed.length !== 1) throw new AccountLinkError("E_ACCOUNT_LINK_LEASE_LOST")
  return result
}
