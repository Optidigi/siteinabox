// Shared by the Node migration/runtime graph and Next server request handlers.
import type { Payload, PayloadRequest } from "payload"
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres"
import { CustomerProjectionError, type CustomerProjectionTask } from "@/lib/projection/customerTransaction"
import type { CustomerAccount, Tenant } from "@/payload-types"
import { queryRows } from "@/lib/record"
import { relationshipId } from "@/lib/relationshipId"
import { CustomerIdentityError } from "./verifiedCustomer"

/** These IDs come from the server SDK/account resolver, never request data. */
export type CustomerAuthority = { accountId: number; previewSessionId: string }
type AccessIntent = "read" | "write" | "purchase"
export type WorkspaceResult = { doc: Tenant; operation: "created" | "updated" }

async function currentCustomer(
  payload: Payload,
  authority: CustomerAuthority,
  intent: AccessIntent,
  tenantId?: string | number,
  req?: Partial<PayloadRequest>,
): Promise<CustomerAccount> {
  const transactionID = req?.transactionID ? await req.transactionID : null
  // Payload's generic adapter omits the concrete PostgreSQL session type;
  // payload.config.ts owns this adapter. Validate the selected handle below.
  const adapter = payload.db as unknown as Pick<PostgresAdapter, "sessions" | "drizzle">
  const database = transactionID ? adapter.sessions[transactionID]?.db : adapter.drizzle
  if (!database || typeof database.execute !== "function") throw new Error("Customer authority transaction is unavailable")
  if (transactionID) {
    // Use the same normalized-email lock as account/membership claims, before
    // any row locks. This also serializes an invite racing initial creation.
    await database.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(email, 0))
      FROM customer_accounts WHERE id=${authority.accountId}`)
  }
  const locking = transactionID ? sql`FOR UPDATE OF a FOR SHARE OF u, s` : sql``
  const matches = queryRows<{ id: number }>(await database.execute(sql`
    SELECT a.id FROM customer_accounts a
    JOIN preview_auth_users u ON u.id=a.preview_user_id
    JOIN preview_auth_sessions s ON s."userId"=u.id
    WHERE a.id=${authority.accountId} AND s.id=${authority.previewSessionId}
      AND s."expiresAt">clock_timestamp() AND u."emailVerified"=true AND u."verificationHistoryUnknown"=false
      AND a.revoked_at IS NULL AND a.email=u.email
      AND a.verified_at=date_trunc('milliseconds',u."firstVerifiedAt")
    ${locking}`))
  if (matches.length !== 1) throw new CustomerIdentityError("E_CUSTOMER_SESSION_REQUIRED")
  const account = await payload.findByID({ collection: "customer-accounts", id: authority.accountId,
    depth: 0, overrideAccess: true, req })
  if (account.revokedAt) throw new CustomerIdentityError("E_CUSTOMER_ACCOUNT_REVOKED")
  const boundTenant = relationshipId(account.tenant)
  if (tenantId != null && boundTenant !== String(tenantId)) {
    throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
  }
  if (boundTenant) {
    const tenants = queryRows<{ status: string }>(await database.execute(sql`SELECT status FROM tenants WHERE id=${boundTenant}`))
    const tenant = tenants[0]
    if (tenants.length !== 1 || !tenant || ["archived", "suspended"].includes(tenant.status)) {
      throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
    }
  }
  const memberships = queryRows<{ id: number; role: string; tenant_id: number | null }>(await database.execute(sql`
    SELECT u.id, u.role, t.tenant_id FROM users u
    LEFT JOIN users_tenants t ON t._parent_id=u.id
    WHERE lower(btrim(u.email))=${account.email}`))
  if (memberships.length) {
    const member = memberships[0]!
    if (memberships.length !== 1 || !boundTenant || String(member.tenant_id) !== boundTenant ||
        !["owner", "editor", "viewer"].includes(member.role) ||
        (relationshipId(account.payloadUser) && relationshipId(account.payloadUser) !== String(member.id)) ||
        (intent !== "read" && member.role !== "owner")) {
      throw new CustomerIdentityError("E_CUSTOMER_EXISTING_MEMBERSHIP")
    }
  } else if (account.payloadUser) {
    throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")
  }
  return account
}

export async function assertCustomerAccess(
  payload: Payload,
  authority: CustomerAuthority,
  input: { intent: AccessIntent; tenantId?: string | number },
  req?: Partial<PayloadRequest>,
): Promise<CustomerAccount> {
  return currentCustomer(payload, authority, input.intent, input.tenantId, req)
}

/** Serialize only local workspace writes; never pass provider I/O as action. */
export async function withCustomerWorkspace<Result extends WorkspaceResult>(
  payload: Payload,
  authority: CustomerAuthority,
  action: (bound: Tenant | null, req: Partial<PayloadRequest>) => Promise<Result>,
  intent: AccessIntent = "write",
): Promise<Result> {
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new Error("Customer workspace requires a transaction")
  const projections: CustomerProjectionTask[] = []
  const req = { transactionID, context: { customerProjectionQueue: (task: CustomerProjectionTask): void => { projections.push(task) } } }
  let result: Result
  try {
    const account = await currentCustomer(payload, authority, intent, undefined, req)
    const tenantId = relationshipId(account.tenant)
    const bound = tenantId ? await payload.findByID({ collection: "tenants", id: tenantId,
      overrideAccess: true, depth: 0, req }) : null
    if (bound && ["archived", "suspended"].includes(bound.status)) {
      throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
    }
    result = await action(bound, req)
    // A locked session can still expire while local work runs. Revalidate
    // against wall time before any content/binding becomes committed.
    await currentCustomer(payload, authority, intent, undefined, req)
    if (tenantId && String(result.doc.id) !== tenantId) {
      throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
    }
    if (!tenantId) await payload.update({ collection: "customer-accounts", id: account.id,
      data: { tenant: result.doc.id }, overrideAccess: true, depth: 0, req })
    await payload.db.commitTransaction(transactionID)
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
  // Filesystem projection cannot participate in PostgreSQL rollback. Only
  // materialize committed documents after the authority/expiry gate succeeds.
  let projectionFailed = false
  for (const task of projections) {
    try { await task.run() }
    catch (error) {
      projectionFailed = true
      payload.logger.error({ err: error, code: "E_CUSTOMER_PROJECTION_PENDING", committed: true,
        accountId: authority.accountId, tenantId: result.doc.id, collection: task.collection, documentId: task.documentId },
      "[projection] committed customer change needs refresh; restore storage and repeat the same authenticated save")
    }
  }
  if (projectionFailed) throw new CustomerProjectionError()
  return result
}
