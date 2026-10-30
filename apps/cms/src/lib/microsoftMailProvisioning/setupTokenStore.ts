import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { sql } from "@payloadcms/db-postgres"
import type { Payload } from "payload"
import { withCommerceOrderLock } from "../commerce/orderLock.ts"

const lifecycleContext = { microsoftMailSetupTokenLifecycle: true }

export type ConsumedMicrosoftMailSetupToken = {
  userPrincipalName: string
  encryptedPassword: string
}

export async function createMicrosoftMailSetupToken(input: {
  payload: Payload
  runId: number
  userPrincipalName: string
  encryptedPassword: string
  expiresAt: Date
}): Promise<string | null> {
  return withCommerceOrderLock(input.payload, `mail-setup:${input.runId}:${input.userPrincipalName.toLowerCase()}`, async () => {
  const prior = await input.payload.db.drizzle.execute(sql`SELECT id FROM microsoft_mail_setup_tokens WHERE provisioning_run_id = ${input.runId} AND user_principal_name = ${input.userPrincipalName} AND consumed_at IS NOT NULL LIMIT 1`)
  if (prior.rows.length) return null
  await input.payload.db.drizzle.execute(sql`
    UPDATE microsoft_mail_setup_tokens
    SET encrypted_password = ''
    WHERE consumed_at IS NOT NULL OR expires_at <= clock_timestamp()
  `)
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await input.payload.create({
    collection: "microsoft-mail-setup-tokens",
    data: {
      tokenHash,
      provisioningRun: input.runId,
      userPrincipalName: input.userPrincipalName,
      encryptedPassword: input.encryptedPassword,
      expiresAt: input.expiresAt.toISOString(),
      consumedAt: null,
    },
    overrideAccess: true,
    context: lifecycleContext,
  })
  return token
  })
}

/** Workspace callers must authenticate and bind run/address before calling. */
export async function consumeMicrosoftMailSetupCredential(input: {
  payload: Payload; runId: number; userPrincipalName: string; now?: Date
}): Promise<ConsumedMicrosoftMailSetupToken | null> {
  return claimSetupCredential({ ...input, now: input.now ?? new Date() })
}

/** A bearer email token and authenticated workspace access share one atomic claim. */
export async function consumeMicrosoftMailSetupToken(input: {
  payload: Payload; token: string; now?: Date
}): Promise<ConsumedMicrosoftMailSetupToken | null> {
  const token = input.token.trim()
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const found = await input.payload.db.drizzle.execute(sql`
    SELECT provisioning_run_id, user_principal_name FROM microsoft_mail_setup_tokens
    WHERE token_hash = ${tokenHash} LIMIT 1
  `)
  const row = found.rows[0]
  if (!row || typeof row.provisioning_run_id !== "number" || typeof row.user_principal_name !== "string") return null
  return claimSetupCredential({ payload: input.payload, runId: row.provisioning_run_id, userPrincipalName: row.user_principal_name, tokenHash, now: input.now ?? new Date() })
}

async function claimSetupCredential(input: {
  payload: Payload; runId: number; userPrincipalName: string; now: Date; tokenHash?: string
}): Promise<ConsumedMicrosoftMailSetupToken | null> {
  if (!Number.isSafeInteger(input.runId) || input.runId < 1 || !input.userPrincipalName.trim()) return null
  return withCommerceOrderLock(input.payload, `mail-setup:${input.runId}:${input.userPrincipalName.toLowerCase()}`, async () => {
    await input.payload.db.drizzle.execute(sql`
      UPDATE microsoft_mail_setup_tokens SET encrypted_password = ''
      WHERE consumed_at IS NOT NULL OR expires_at <= clock_timestamp()
    `)
    const result = await input.payload.db.drizzle.execute(sql`
      WITH candidate AS MATERIALIZED (
        SELECT id, provisioning_run_id, user_principal_name, encrypted_password
        FROM microsoft_mail_setup_tokens
        WHERE provisioning_run_id = ${input.runId}
          AND user_principal_name = ${input.userPrincipalName}
          AND consumed_at IS NULL AND encrypted_password <> ''
          AND expires_at > ${input.now.toISOString()}::timestamptz
          ${input.tokenHash ? sql`AND token_hash = ${input.tokenHash}` : sql``}
        ORDER BY id DESC LIMIT 1 FOR UPDATE SKIP LOCKED
      ), claimed AS (
        UPDATE microsoft_mail_setup_tokens AS setup_token
        SET consumed_at = clock_timestamp(), encrypted_password = ''
        FROM candidate
        WHERE setup_token.provisioning_run_id = candidate.provisioning_run_id
          AND setup_token.user_principal_name = candidate.user_principal_name
          AND setup_token.consumed_at IS NULL
        RETURNING setup_token.id
      )
      SELECT candidate.user_principal_name, candidate.encrypted_password
      FROM candidate WHERE EXISTS (SELECT 1 FROM claimed)
    `)
    const row = result.rows[0]
    if (!row || typeof row.user_principal_name !== "string" || typeof row.encrypted_password !== "string" || !row.encrypted_password) return null
    return { userPrincipalName: row.user_principal_name, encryptedPassword: row.encrypted_password }
  })
}
