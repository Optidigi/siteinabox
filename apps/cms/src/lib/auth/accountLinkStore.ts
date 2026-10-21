// Backend storage primitive, not a server action. Issuer/worker boundaries must
// authorize purpose and current target before admission and before delivery.
import { createHash, randomBytes } from "node:crypto"
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres"
import type { Payload, PayloadRequest } from "payload"
import { queryRows } from "@/lib/record"
import { getMailSendTimeoutMs } from "@/lib/email/configuration"
import { getMagicLinkRateLimit, PASSWORD_RESET_RATE_LIMIT } from "./magicLinkRateLimit"
import { AccountLinkError, accountLinkNamespaces, accountLinkPurposes, accountLinkLanes, type AccountLinkTarget } from "./accountLinkTypes"

export const accountLinkFingerprint = (namespace: string, value: string) =>
  createHash("sha256").update(namespace + "\0" + value).digest("hex")

export const accountLinkScopeKey = (target: AccountLinkTarget) => accountLinkFingerprint("scope", JSON.stringify([
  target.namespace, target.purpose, target.recipient, target.payloadUserId ?? null, target.previewUserId ?? null,
  target.tenantId ?? null, target.role ?? null, target.actorUserId ?? null, target.origin, target.callbackPath, target.errorCallbackPath,
]))

export type AccountLinkLease = { id: number; fence: number; token: string }
export type AccountLinkAdmission =
  | { kind: "claimed"; lease: AccountLinkLease }
  | { kind: "coalesced"; id: number }
  | { kind: "limited"; retryAfterSeconds: number }

type LinkDatabase = Pick<PostgresAdapter["drizzle"], "execute">
class WindowDenied extends Error {
  constructor(readonly retryAfterSeconds: number) { super("E_ACCOUNT_LINK_WINDOW_FULL") }
}
const future = (value: string | null | undefined, now: Date) => Boolean(value && Date.parse(value) > now.getTime())

async function reserveWindow(db: LinkDatabase, key: string, windowSeconds: number, maximum: number, now: Date) {
  const expiry = new Date(now.getTime() + windowSeconds * 1000).toISOString()
  const reserved = queryRows(await db.execute(sql`
    INSERT INTO account_link_windows (key,count,expires_at) VALUES (${key},1,${expiry})
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN account_link_windows.expires_at<=clock_timestamp() THEN 1 ELSE account_link_windows.count+1 END,
      expires_at=CASE WHEN account_link_windows.expires_at<=clock_timestamp() THEN excluded.expires_at ELSE account_link_windows.expires_at END,
      updated_at=clock_timestamp()
    WHERE account_link_windows.expires_at<=clock_timestamp() OR account_link_windows.count<${maximum}
    RETURNING id`))
  if (reserved.length) return
  const row = queryRows<{ expires_at: Date | string }>(await db.execute(sql`SELECT expires_at FROM account_link_windows WHERE key=${key}`))[0]
  throw new WindowDenied(Math.max(1, Math.ceil((new Date(row?.expires_at ?? expiry).getTime() - now.getTime()) / 1000)))
}

export async function admitAccountLink(payload: Payload, target: AccountLinkTarget): Promise<AccountLinkAdmission> {
  if (!accountLinkNamespaces.includes(target.namespace) || !accountLinkPurposes.includes(target.purpose) ||
      !accountLinkLanes.includes(target.lane) || target.recipient !== target.recipient.trim().toLowerCase() ||
      !target.recipient.includes("@") || target.recipient.length > 254) throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
  const activeKey = accountLinkFingerprint(target.namespace, target.recipient)
  const laneKey = "lane:" + target.lane
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new AccountLinkError("E_ACCOUNT_LINK_TRANSACTION")
  const req: Partial<PayloadRequest> = { transactionID }
  const adapter = payload.db as unknown as Pick<PostgresAdapter, "sessions">
  const db = adapter.sessions[transactionID]?.db
  if (!db) { await payload.db.rollbackTransaction(transactionID); throw new AccountLinkError("E_ACCOUNT_LINK_TRANSACTION") }
  try {
    // Fixed lock order: independent delivery lane, then canonical mailbox.
    // SQL reservations and the active claim commit together, before SDK or I/O.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${laneKey},0))`)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${activeKey},0))`)
    const clock = queryRows<{ now: Date | string }>(await db.execute(sql`SELECT clock_timestamp() AS now`))[0]!
    const now = new Date(clock.now)
    const existing = (await payload.find({ collection: "account-link-dispatches", where: { activeKey: { equals: activeKey } },
      depth: 0, limit: 1, overrideAccess: true, req })).docs[0]
    if (existing) {
      const issued = ["sent", "indeterminate", "queued", "dispatching"].includes(existing.state)
      if (future(existing.leaseUntil, now) || issued && future(existing.expiresAt, now)) {
        if (existing.state === "dispatching" && !future(existing.leaseUntil, now)) {
          await payload.update({ collection: "account-link-dispatches", id: existing.id, overrideAccess: true, req,
            data: { state: "indeterminate", retryState: "manual_review", leaseUntil: null, leaseTokenHash: null,
              outcomeCode: "E_PROVIDER_WRITE_INDETERMINATE" } })
        }
        await payload.db.commitTransaction(transactionID)
        return { kind: "coalesced", id: existing.id }
      }
      await payload.update({ collection: "account-link-dispatches", id: existing.id, overrideAccess: true, req,
        data: { activeKey: null, ...(existing.state === "admitted" || existing.state === "issuing"
          ? { state: "failed", retryState: "retryable", outcomeCode: "E_LINK_ISSUANCE_INTERRUPTED" } : {}) } })
    }
    const limit = getMagicLinkRateLimit()
    await reserveWindow(db, laneKey, limit.window, limit.max, now)
    const reset = target.namespace === "payload" && target.purpose === "password_reset"
    await reserveWindow(db, "mailbox:" + activeKey, reset ? PASSWORD_RESET_RATE_LIMIT.window : limit.window,
      reset ? PASSWORD_RESET_RATE_LIMIT.max : limit.max, now)
    const token = randomBytes(32).toString("hex")
    const scopeKey = accountLinkScopeKey(target)
    const doc = await payload.create({ collection: "account-link-dispatches", overrideAccess: true, req,
      data: { ...target, activeKey, scopeKey, state: "admitted", fence: 1, leaseTokenHash: accountLinkFingerprint("lease", token),
        sendAttempts: 0, retryState: "none",
        leaseUntil: new Date(now.getTime() + getMailSendTimeoutMs() + 10_000).toISOString(),
        retentionAfter: new Date(now.getTime() + 86_400_000).toISOString() } })
    await payload.db.commitTransaction(transactionID)
    return { kind: "claimed", lease: { id: doc.id, fence: 1, token } }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    if (error instanceof WindowDenied) return { kind: "limited", retryAfterSeconds: error.retryAfterSeconds }
    throw error
  }
}

// Each transition is a single fenced SQL write. No lease holder can dispatch
// twice, and no database transaction remains open while a provider is called.
const database = (payload: Payload): LinkDatabase => (payload.db as unknown as Pick<PostgresAdapter, "drizzle">).drizzle
const assertTransition = (rows: unknown[]) => {
  if (rows.length !== 1) throw new AccountLinkError("E_ACCOUNT_LINK_LEASE_LOST")
}

export async function bindAccountLinkToken(payload: Payload, lease: AccountLinkLease, input: {
  namespace: AccountLinkTarget["namespace"]; token: string; verificationId: string; expiresAt: Date
}) {
  if (!input.token || !input.verificationId || !Number.isFinite(input.expiresAt.getTime())) {
    throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
  }
  assertTransition(queryRows(await database(payload).execute(sql`
    UPDATE account_link_dispatches SET state='issuing', token_fingerprint=${accountLinkFingerprint(input.namespace, input.token)},
      verification_id=${input.verificationId}, expires_at=${input.expiresAt.toISOString()},
      retention_after=${new Date(input.expiresAt.getTime() + 86_400_000).toISOString()}, updated_at=clock_timestamp()
    WHERE id=${lease.id} AND fence=${lease.fence} AND lease_token_hash=${accountLinkFingerprint("lease", lease.token)}
      AND namespace=${input.namespace} AND state='admitted' AND lease_until>clock_timestamp()
      AND ${input.expiresAt.toISOString()}::timestamptz>clock_timestamp() RETURNING id`)))
}

export async function beginAccountLinkDelivery(payload: Payload, lease: AccountLinkLease) {
  assertTransition(queryRows(await database(payload).execute(sql`
    UPDATE account_link_dispatches SET state='dispatching', send_attempts=send_attempts+1, updated_at=clock_timestamp()
    WHERE id=${lease.id} AND fence=${lease.fence} AND lease_token_hash=${accountLinkFingerprint("lease", lease.token)}
      AND state='issuing' AND lease_until>clock_timestamp() AND expires_at>clock_timestamp() RETURNING id`)))
}

export async function claimQueuedAccountLink(payload: Payload, id: number): Promise<AccountLinkLease | null> {
  const token = randomBytes(32).toString("hex")
  const row = queryRows<{ fence: number }>(await database(payload).execute(sql`
    UPDATE account_link_dispatches SET state='issuing', fence=fence+1,
      lease_token_hash=${accountLinkFingerprint("lease", token)},
      lease_until=clock_timestamp()+${getMailSendTimeoutMs() + 10_000}*interval '1 millisecond', updated_at=clock_timestamp()
    WHERE id=${id} AND state='queued' AND expires_at>clock_timestamp() RETURNING fence`))[0]
  return row ? { id, fence: row.fence, token } : null
}

export async function cancelAccountLink(payload: Payload, lease: AccountLinkLease) {
  assertTransition(queryRows(await database(payload).execute(sql`
    UPDATE account_link_dispatches SET state='cancelled', active_key=NULL, lease_token_hash=NULL, lease_until=NULL,
      outcome_code='E_ACCOUNT_LINK_TARGET', updated_at=clock_timestamp()
    WHERE id=${lease.id} AND fence=${lease.fence} AND lease_token_hash=${accountLinkFingerprint("lease", lease.token)}
      AND state IN ('admitted','issuing') RETURNING id`)))
}

export type AccountLinkDeliveryOutcome =
  | { state: "sent"; providerMessageId?: string }
  | { state: "indeterminate"; code: string; providerMessageId?: string }
  | { state: "failed"; code: string; retryable: boolean }

export async function finishAccountLinkDelivery(payload: Payload, lease: AccountLinkLease, outcome: AccountLinkDeliveryOutcome) {
  const retryState = outcome.state === "indeterminate" ? "manual_review"
    : outcome.state === "failed" ? outcome.retryable ? "retryable" : "permanent" : "none"
  assertTransition(queryRows(await database(payload).execute(sql`
    UPDATE account_link_dispatches SET state=CASE WHEN state='consumed' THEN state ELSE ${outcome.state}::enum_account_link_dispatches_state END,
      retry_state=${retryState},
      outcome_code=${"code" in outcome ? outcome.code : null},
      provider_message_id=${"providerMessageId" in outcome ? outcome.providerMessageId ?? null : null},
      active_key=CASE WHEN ${outcome.state}='failed' THEN NULL ELSE active_key END,
      lease_until=NULL, lease_token_hash=NULL, updated_at=clock_timestamp()
    WHERE id=${lease.id} AND fence=${lease.fence} AND lease_token_hash=${accountLinkFingerprint("lease", lease.token)}
      AND state IN ('dispatching','consumed') RETURNING id`)))
}
