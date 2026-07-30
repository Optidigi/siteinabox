import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_migration_source_authorizations_state" AS ENUM('pending', 'authorized', 'attached', 'refreshing', 'revocation_pending', 'revoked', 'expired');
  CREATE TABLE "migration_source_authorizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"authorization_key" varchar NOT NULL,
	"state_digest" varchar NOT NULL,
	"browser_binding_digest" varchar NOT NULL,
	"generation_run_id" integer,
	"tenant_id" integer,
	"client_slug" varchar NOT NULL,
	"customer_email_digest" varchar NOT NULL,
	"domain_name_ascii" varchar NOT NULL,
	"encrypted_authority" varchar,
	"state" "enum_migration_source_authorizations_state" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"authorized_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "migration_source_authorizations" ADD CONSTRAINT "migration_source_authorizations_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "migration_source_authorizations" ADD CONSTRAINT "migration_source_authorizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "migration_source_authorizations_authorization_key_idx" ON "migration_source_authorizations" USING btree ("authorization_key");
  CREATE UNIQUE INDEX "migration_source_authorizations_state_digest_idx" ON "migration_source_authorizations" USING btree ("state_digest");
  CREATE INDEX "migration_source_authorizations_generation_run_idx" ON "migration_source_authorizations" USING btree ("generation_run_id");
  CREATE INDEX "migration_source_authorizations_tenant_idx" ON "migration_source_authorizations" USING btree ("tenant_id");
  CREATE INDEX "migration_source_authorizations_client_slug_idx" ON "migration_source_authorizations" USING btree ("client_slug");
  CREATE INDEX "migration_source_authorizations_customer_email_digest_idx" ON "migration_source_authorizations" USING btree ("customer_email_digest");
  CREATE INDEX "migration_source_authorizations_domain_name_ascii_idx" ON "migration_source_authorizations" USING btree ("domain_name_ascii");
  CREATE INDEX "migration_source_authorizations_state_idx" ON "migration_source_authorizations" USING btree ("state");
  CREATE INDEX "migration_source_authorizations_expires_at_idx" ON "migration_source_authorizations" USING btree ("expires_at");
  CREATE INDEX "migration_source_authorizations_updated_at_idx" ON "migration_source_authorizations" USING btree ("updated_at");
  CREATE INDEX "migration_source_authorizations_created_at_idx" ON "migration_source_authorizations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1
       FROM "migration_source_authorizations"
       WHERE "encrypted_authority" IS NOT NULL
          OR "state"::text IN ('pending', 'authorized', 'attached', 'refreshing', 'revocation_pending')
     ) THEN
       RAISE EXCEPTION 'Cannot remove Cloudflare source OAuth storage while live or revocation-pending authority exists. Drain and revoke authorizations first.';
     END IF;
   END
   $$;
   DROP TABLE "migration_source_authorizations" CASCADE;
  DROP TYPE "public"."enum_migration_source_authorizations_state";`)
}
