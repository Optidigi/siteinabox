import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { sql } from "@payloadcms/db-postgres"
import type { Payload } from "payload"

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
}): Promise<string> {
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
}

/** Atomic compare-and-set: only one concurrent submit can claim a live token. */
export async function consumeMicrosoftMailSetupToken(input: {
  payload: Payload
  token: string
  now?: Date
}): Promise<ConsumedMicrosoftMailSetupToken | null> {
  const token = input.token.trim()
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const now = input.now ?? new Date()
  await input.payload.db.drizzle.execute(sql`
    UPDATE microsoft_mail_setup_tokens
    SET encrypted_password = ''
    WHERE consumed_at IS NOT NULL OR expires_at <= clock_timestamp()
  `)
  const result = await input.payload.db.drizzle.execute(sql`
    WITH candidate AS MATERIALIZED (
      SELECT id, user_principal_name, encrypted_password
      FROM microsoft_mail_setup_tokens
      WHERE token_hash = ${tokenHash}
        AND consumed_at IS NULL
        AND expires_at > ${now.toISOString()}::timestamptz
      FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE microsoft_mail_setup_tokens AS setup_token
      SET consumed_at = clock_timestamp(), encrypted_password = ''
      FROM candidate
      WHERE setup_token.id = candidate.id
        AND setup_token.consumed_at IS NULL
      RETURNING setup_token.id
    )
    SELECT candidate.user_principal_name, candidate.encrypted_password
    FROM candidate
    JOIN claimed USING (id)
  `)
  const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []
  const row = rows[0]
  if (!row || typeof row.user_principal_name !== "string" || typeof row.encrypted_password !== "string" || !row.encrypted_password) return null
  return { userPrincipalName: row.user_principal_name, encryptedPassword: row.encrypted_password }
}
