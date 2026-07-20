import type { Where } from "payload"

// Audit-p2 #10 (T11) — Forms GDPR retention.
//
// Pure logic for the daily purge task. The Payload task wrapper lives
// alongside (`./purgeStaleFormsTask.ts`); this module is the testable
// core, with no Payload-runtime imports so unit tests can call it
// against a hand-rolled mock client.
//
// Boundary: rows with `createdAt < cutoff` are deleted. A row exactly at
// `cutoff` is preserved (inclusive of newest, exclusive of oldest).

export const DEFAULT_RETENTION_DAYS = 90 as const

export interface PayloadLikeClient {
  delete(args: {
    collection: "forms"
    where: Where
    overrideAccess: true
  }): Promise<{ docs: unknown[]; deletedCount?: number }>
}

export interface PurgeOpts {
  payload: PayloadLikeClient
  retentionDays: number
  /**
   * Override "now" for deterministic testing. Production callers omit
   * this — the task wrapper passes new Date().
   */
  now?: Date
}

export interface PurgeResult {
  deleted: number
  cutoffISO: string
  retentionDays: number
}

/**
 * Resolve retentionDays from explicit arg or `FORMS_RETENTION_DAYS` env.
 * Refuses zero/negative/non-finite values: a misconfigured 0 would purge
 * every form on the next run, an irrecoverable destructive default. A
 * malformed env var falls back to {@link DEFAULT_RETENTION_DAYS} rather
 * than throwing — operator-level configuration shouldn't crash the
 * Payload boot path.
 */
export function resolveRetentionDays(explicit?: number): number {
  if (explicit !== undefined) {
    if (!Number.isFinite(explicit) || explicit < 1) {
      throw new Error(
        `retentionDays must be a finite integer >= 1 (got ${explicit})`,
      )
    }
    return Math.floor(explicit)
  }
  const raw = process.env.FORMS_RETENTION_DAYS
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_RETENTION_DAYS
  return Math.floor(n)
}

/**
 * Delete every form submission whose `createdAt` is strictly older than
 * `now - retentionDays`. Issues a single bulk delete (Payload v3
 * supports `where`-keyed bulk delete on the local API), which scales to
 * any tenant count and any submission volume without per-row roundtrips.
 *
 * Tenant isolation: the row-level `tenant` column travels with each
 * deleted row by definition (Postgres deletes the matching rows; the
 * tenant column is not in the predicate, so tenant-A's recent rows are
 * not in the matching set and are never touched). The `createdAt`
 * predicate is purely temporal — no cross-tenant bleed.
 *
 * Runs with `overrideAccess: true` because the task fires from a cron
 * runner where `req.user` is null; the Forms `access.delete` only
 * admits super-admin / owner so without overrideAccess the call would
 * 403. The task is a system path equivalent to a super-admin delete.
 */
export async function purgeStaleFormSubmissions(opts: PurgeOpts): Promise<PurgeResult> {
  const { payload, retentionDays } = opts
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error(`retentionDays must be a finite integer >= 1 (got ${retentionDays})`)
  }
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000)
  const cutoffISO = cutoff.toISOString()

  const res = await payload.delete({
    collection: "forms",
    where: { createdAt: { less_than: cutoffISO } },
    overrideAccess: true,
  })

  // Payload returns `{ docs: [...] }` from bulk delete; fall back to
  // docs.length if `deletedCount` isn't surfaced (the local API in v3
  // returns docs even on bulk by default).
  const deleted =
    typeof res.deletedCount === "number" ? res.deletedCount : Array.isArray(res.docs) ? res.docs.length : 0

  return { deleted, cutoffISO, retentionDays }
}
