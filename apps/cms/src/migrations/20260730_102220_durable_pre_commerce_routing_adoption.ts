import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_pre_commerce_routing_adoption_state" AS ENUM('not_adopted', 'adopted', 'revoked');
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_state" "enum_tenants_pre_commerce_routing_adoption_state" DEFAULT 'not_adopted';
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_adopted_domain" varchar;
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_evidence_version" varchar;
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_adopted_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_revoked_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "pre_commerce_routing_adoption_reason" varchar;
  ALTER TABLE "tenants" ALTER COLUMN "pre_commerce_routing_adoption_state" SET NOT NULL;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_pre_commerce_routing_adoption_evidence_check" CHECK (
    (
      "pre_commerce_routing_adoption_state" = 'not_adopted'
      AND "pre_commerce_routing_adoption_adopted_domain" IS NULL
      AND "pre_commerce_routing_adoption_evidence_version" IS NULL
      AND "pre_commerce_routing_adoption_adopted_at" IS NULL
      AND "pre_commerce_routing_adoption_revoked_at" IS NULL
    )
    OR (
      "pre_commerce_routing_adoption_state" = 'adopted'
      AND "pre_commerce_routing_adoption_adopted_domain" IS NOT NULL
      AND "pre_commerce_routing_adoption_adopted_domain" =
        lower(trim(trailing '.' from "domain"))
      AND "pre_commerce_routing_adoption_evidence_version" IS NOT NULL
      AND "pre_commerce_routing_adoption_evidence_version" =
        'pre-commerce-routing-v1'
      AND "pre_commerce_routing_adoption_adopted_at" IS NOT NULL
      AND "pre_commerce_routing_adoption_revoked_at" IS NULL
    )
    OR (
      "pre_commerce_routing_adoption_state" = 'revoked'
      AND "pre_commerce_routing_adoption_adopted_domain" IS NOT NULL
      AND "pre_commerce_routing_adoption_adopted_domain" =
        lower(trim(trailing '.' from "domain"))
      AND "pre_commerce_routing_adoption_evidence_version" IS NOT NULL
      AND "pre_commerce_routing_adoption_evidence_version" =
        'pre-commerce-routing-v1'
      AND "pre_commerce_routing_adoption_adopted_at" IS NOT NULL
      AND "pre_commerce_routing_adoption_revoked_at" IS NOT NULL
    )
  );
  DO $migration$
  DECLARE
    historical_rows integer;
    eligible_rows integer;
  BEGIN
    SELECT count(*) INTO historical_rows
    FROM "tenants" AS tenant
    WHERE lower(trim(trailing '.' from tenant."domain")) = 'ami-care.nl';

    IF historical_rows = 0 THEN
      RETURN;
    END IF;

    SELECT count(*) INTO eligible_rows
    FROM "tenants" AS tenant
    JOIN "published_site_snapshots" AS snapshot
      ON snapshot."id" = tenant."active_snapshot_id"
      AND snapshot."tenant_id" = tenant."id"
    WHERE lower(trim(trailing '.' from tenant."domain")) = 'ami-care.nl'
      AND tenant."status" = 'active'
      AND tenant."domain_verification_status" = 'verified'
      AND snapshot."status" = 'active'
      AND lower(trim(trailing '.' from snapshot."domain")) = 'ami-care.nl'
      AND NOT EXISTS (
        SELECT 1
        FROM "managed_domains" AS managed
        WHERE lower(trim(trailing '.' from managed."domain_name_ascii")) =
          'ami-care.nl'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "tenants" AS canonical_www
        WHERE lower(trim(trailing '.' from canonical_www."domain")) =
          'www.ami-care.nl'
      )
      AND (
        SELECT count(*)
        FROM "site_settings" AS settings
        WHERE settings."tenant_id" = tenant."id"
      ) = 1
      AND (
        SELECT count(*)
        FROM "site_settings_aliases" AS alias
        WHERE lower(trim(trailing '.' from alias."host")) =
          'www.ami-care.nl'
      ) = 1
      AND EXISTS (
        SELECT 1
        FROM "site_settings_aliases" AS alias
        JOIN "site_settings" AS settings
          ON settings."id" = alias."_parent_id"
        WHERE settings."tenant_id" = tenant."id"
          AND lower(trim(trailing '.' from alias."host")) =
            'www.ami-care.nl'
      );

    IF historical_rows <> 1 OR eligible_rows <> 1 THEN
      RAISE EXCEPTION
        'Historical ami-care.nl routing adoption evidence is incomplete; refusing migration';
    END IF;

    UPDATE "tenants"
    SET
      "pre_commerce_routing_adoption_state" = 'adopted',
      "pre_commerce_routing_adoption_adopted_domain" = 'ami-care.nl',
      "pre_commerce_routing_adoption_evidence_version" =
        'pre-commerce-routing-v1',
      "pre_commerce_routing_adoption_adopted_at" = CURRENT_TIMESTAMP,
      "pre_commerce_routing_adoption_revoked_at" = NULL,
      "pre_commerce_routing_adoption_reason" =
        'Verified historical routing adoption; no commerce or provider authority granted.'
    WHERE lower(trim(trailing '.' from "domain")) = 'ami-care.nl';
  END
  $migration$;
  CREATE INDEX "tenants_pre_commerce_routing_adoption_pre_commerce_routi_idx" ON "tenants" USING btree ("pre_commerce_routing_adoption_state");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $migration$
   BEGIN
     IF EXISTS (
       SELECT 1
       FROM "tenants"
       WHERE "pre_commerce_routing_adoption_state"::text IN ('adopted', 'revoked')
     ) THEN
       RAISE EXCEPTION 'Cannot remove durable pre-commerce routing adoption evidence; retain the additive schema and use forward recovery.';
     END IF;
   END
   $migration$;
  DROP INDEX "tenants_pre_commerce_routing_adoption_pre_commerce_routi_idx";
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_pre_commerce_routing_adoption_evidence_check";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_state";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_adopted_domain";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_evidence_version";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_adopted_at";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_revoked_at";
  ALTER TABLE "tenants" DROP COLUMN "pre_commerce_routing_adoption_reason";
  DROP TYPE "public"."enum_tenants_pre_commerce_routing_adoption_state";`)
}
