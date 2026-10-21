// Backend authority is also loaded by Payload's ordinary Node configuration
// and migration CLI. The Next request boundary is verifiedPreviewSession.ts.
import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import type { CustomerAccount } from "@/payload-types"
import { asRecord, queryRows } from "@/lib/record"
import { normalizeBuilderEmail } from "@/lib/builder/thread"

export class CustomerIdentityError extends Error {
  constructor(readonly code: string) { super(code); this.name = "CustomerIdentityError" }
}

const instant = (value: unknown): number =>
  value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN

/** Validate before configuration imports or any protected workspace lookup. */
export function verifiedCustomerClaims(sdkSession: unknown) {
  const envelope = asRecord(sdkSession)
  const user = asRecord(envelope?.user)
  const session = asRecord(envelope?.session)
  const now = Date.now()
  if (!user || user.emailVerified !== true || typeof user.id !== "string" || !user.id ||
      typeof user.email !== "string" || !session || session.userId !== user.id ||
      typeof session.id !== "string" || !session.id || !(instant(session.expiresAt) > now)) {
    throw new CustomerIdentityError("E_CUSTOMER_SESSION_REQUIRED")
  }
  const firstVerifiedAt = instant(user.firstVerifiedAt)
  if (user.verificationHistoryUnknown === true || !Number.isFinite(firstVerifiedAt) || firstVerifiedAt > now) {
    // A historical account's creation or last login time is not verification
    // evidence. Preserve that missing mapping for explicit recovery.
    throw new CustomerIdentityError("E_CUSTOMER_VERIFICATION_HISTORY_REQUIRED")
  }
  const email = normalizeBuilderEmail(user.email)
  const verifiedAt = new Date(firstVerifiedAt).toISOString()
  return { email, verifiedAt, previewUserId: user.id, previewSessionId: session.id }
}

/** Input must come from the actual server SDK with cookie caching disabled. */
export async function resolveVerifiedCustomerAccount(payload: Payload, sdkSession: unknown): Promise<CustomerAccount> {
  const { email, verifiedAt, previewUserId } = verifiedCustomerClaims(sdkSession)
  const existing = async () => (await payload.find({ collection: "customer-accounts",
    where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  let account = await existing()
  if (!account) {
    const priorMembership = queryRows(await payload.db.drizzle.execute(sql`
      SELECT id FROM users WHERE lower(btrim(email))=${email} LIMIT 1`))
    if (priorMembership.length) throw new CustomerIdentityError("E_CUSTOMER_EXISTING_MEMBERSHIP")
    try {
      account = await payload.create({ collection: "customer-accounts", overrideAccess: true, depth: 0,
        data: { email, previewUserId, verifiedAt } })
    } catch (error) {
      // The database's unique email/preview identity arbitrates simultaneous
      // devices. Reuse only the identical committed claim, never move it.
      account = await existing()
      if (!account) throw error
    }
  }
  if (account.previewUserId !== previewUserId || account.email !== email || account.verifiedAt !== verifiedAt) {
    throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")
  }
  if (account.revokedAt) throw new CustomerIdentityError("E_CUSTOMER_ACCOUNT_REVOKED")
  return account
}
