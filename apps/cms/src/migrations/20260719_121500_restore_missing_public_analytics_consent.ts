import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

const consent = sql.raw(`jsonb_build_object(
  'enabled', true,
  'provider', 'posthog',
  'consentStorageKey', 'siab_cookie_consent_v1',
  'consentVersion', '2026-07-07.1'
)`)

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "site_manifest" = jsonb_set("site_manifest", '{analyticsConsent}', ${consent}, true),
        "updated_at" = now()
    WHERE "site_manifest" IS NOT NULL
      AND NOT ("site_manifest" ? 'analyticsConsent')
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("20260719_121500_restore_missing_public_analytics_consent is intentionally irreversible because current tenant consent policy must not be removed during rollback.")
}
