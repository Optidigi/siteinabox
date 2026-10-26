import { sql } from "@payloadcms/db-postgres"
import type { TaskConfig } from "payload"

export const purgeMicrosoftMailSetupSecretsTask: TaskConfig<{
  input: Record<string, never>
  output: { clearedTokens: number; clearedRunCredentials: number; deletedTokenRecords: number }
}> = {
  slug: "purge-microsoft-mail-setup-secrets",
  label: "Purge expired Microsoft mailbox setup secrets",
  schedule: [{ cron: "0 10 3 * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "clearedTokens", type: "number", required: true },
    { name: "clearedRunCredentials", type: "number", required: true },
    { name: "deletedTokenRecords", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const cleared = await req.payload.db.drizzle.execute(sql`
      UPDATE microsoft_mail_setup_tokens
      SET encrypted_password = ''
      WHERE encrypted_password <> ''
        AND (consumed_at IS NOT NULL OR expires_at <= clock_timestamp())
      RETURNING id
    `)
    const expiredRunCredentials = await req.payload.db.drizzle.execute(sql`
      UPDATE microsoft_mail_provisioning_runs
      SET data = jsonb_set(data, '{setupCredentialBundles}', '{}'::jsonb, true)
      WHERE updated_at <= clock_timestamp() - interval '7 days'
        AND data ? 'setupCredentialBundles'
        AND jsonb_typeof(data->'setupCredentialBundles') = 'object'
        AND data->'setupCredentialBundles' <> '{}'::jsonb
        AND state IN ('manual_review', 'failed', 'cancelled')
      RETURNING id
    `)
    const deleted = await req.payload.db.drizzle.execute(sql`
      DELETE FROM microsoft_mail_setup_tokens
      WHERE expires_at <= clock_timestamp() - interval '90 days'
      RETURNING id
    `)
    const output = {
      clearedTokens: (cleared as unknown as { rows?: unknown[] }).rows?.length ?? 0,
      clearedRunCredentials: (expiredRunCredentials as unknown as { rows?: unknown[] }).rows?.length ?? 0,
      deletedTokenRecords: (deleted as unknown as { rows?: unknown[] }).rows?.length ?? 0,
    }
    req.payload.logger.info(`[purge-microsoft-mail-setup-secrets] ${JSON.stringify(output)}`)
    return { output }
  },
}
