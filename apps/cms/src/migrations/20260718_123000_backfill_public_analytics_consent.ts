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

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "site_manifest" = "site_manifest" - 'analyticsConsent',
        "updated_at" = now()
    WHERE "site_manifest" -> 'analyticsConsent' = ${consent}
  `)
}
