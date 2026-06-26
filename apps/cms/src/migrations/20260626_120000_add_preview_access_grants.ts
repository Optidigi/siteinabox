import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "preview_auth_users" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL,
      "image" text,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    );

    CREATE TABLE "preview_auth_sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "preview_auth_users"("id") ON DELETE cascade
    );

    CREATE TABLE "preview_auth_accounts" (
      "id" text PRIMARY KEY NOT NULL,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "preview_auth_users"("id") ON DELETE cascade,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      "scope" text,
      "password" text,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    );

    CREATE TABLE "preview_auth_verifications" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    );

    CREATE TABLE "preview_access_grants" (
      "id" serial PRIMARY KEY NOT NULL,
      "customer_email" varchar NOT NULL,
      "tenant_id" integer NOT NULL,
      "generation_run_id" integer NOT NULL,
      "client_slug" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "revoked_at" timestamp(3) with time zone,
      "last_sent_at" timestamp(3) with time zone,
      "sent_count" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "preview_auth_sessions_userId_idx" ON "preview_auth_sessions" ("userId");
    CREATE INDEX "preview_auth_accounts_userId_idx" ON "preview_auth_accounts" ("userId");
    CREATE INDEX "preview_auth_verifications_identifier_idx" ON "preview_auth_verifications" ("identifier");

    CREATE TABLE "preview_access_grants_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "preview_access_grants_id" integer;

    ALTER TABLE "preview_access_grants" ADD CONSTRAINT "preview_access_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "preview_access_grants" ADD CONSTRAINT "preview_access_grants_generation_run_id_site_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."site_generation_runs"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "preview_access_grants_rels" ADD CONSTRAINT "preview_access_grants_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."preview_access_grants"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "preview_access_grants_rels" ADD CONSTRAINT "preview_access_grants_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_preview_access_grants_fk" FOREIGN KEY ("preview_access_grants_id") REFERENCES "public"."preview_access_grants"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "preview_access_grants_customer_email_idx" ON "preview_access_grants" USING btree ("customer_email");
    CREATE INDEX "preview_access_grants_tenant_idx" ON "preview_access_grants" USING btree ("tenant_id");
    CREATE INDEX "preview_access_grants_generation_run_idx" ON "preview_access_grants" USING btree ("generation_run_id");
    CREATE INDEX "preview_access_grants_client_slug_idx" ON "preview_access_grants" USING btree ("client_slug");
    CREATE INDEX "preview_access_grants_expires_at_idx" ON "preview_access_grants" USING btree ("expires_at");
    CREATE INDEX "preview_access_grants_revoked_at_idx" ON "preview_access_grants" USING btree ("revoked_at");
    CREATE INDEX "preview_access_grants_updated_at_idx" ON "preview_access_grants" USING btree ("updated_at");
    CREATE INDEX "preview_access_grants_created_at_idx" ON "preview_access_grants" USING btree ("created_at");
    CREATE INDEX "preview_access_grants_rels_order_idx" ON "preview_access_grants_rels" USING btree ("order");
    CREATE INDEX "preview_access_grants_rels_parent_idx" ON "preview_access_grants_rels" USING btree ("parent_id");
    CREATE INDEX "preview_access_grants_rels_path_idx" ON "preview_access_grants_rels" USING btree ("path");
    CREATE INDEX "preview_access_grants_rels_pages_id_idx" ON "preview_access_grants_rels" USING btree ("pages_id");
    CREATE INDEX "payload_locked_documents_rels_preview_access_grants_id_idx" ON "payload_locked_documents_rels" USING btree ("preview_access_grants_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_preview_access_grants_fk";
    ALTER TABLE "preview_access_grants_rels" DROP CONSTRAINT IF EXISTS "preview_access_grants_rels_pages_fk";
    ALTER TABLE "preview_access_grants_rels" DROP CONSTRAINT IF EXISTS "preview_access_grants_rels_parent_fk";
    ALTER TABLE "preview_access_grants" DROP CONSTRAINT IF EXISTS "preview_access_grants_generation_run_id_site_generation_runs_id_fk";
    ALTER TABLE "preview_access_grants" DROP CONSTRAINT IF EXISTS "preview_access_grants_tenant_id_tenants_id_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_preview_access_grants_id_idx";
    DROP INDEX IF EXISTS "preview_access_grants_rels_pages_id_idx";
    DROP INDEX IF EXISTS "preview_access_grants_rels_path_idx";
    DROP INDEX IF EXISTS "preview_access_grants_rels_parent_idx";
    DROP INDEX IF EXISTS "preview_access_grants_rels_order_idx";
    DROP INDEX IF EXISTS "preview_access_grants_created_at_idx";
    DROP INDEX IF EXISTS "preview_access_grants_updated_at_idx";
    DROP INDEX IF EXISTS "preview_access_grants_revoked_at_idx";
    DROP INDEX IF EXISTS "preview_access_grants_expires_at_idx";
    DROP INDEX IF EXISTS "preview_access_grants_client_slug_idx";
    DROP INDEX IF EXISTS "preview_access_grants_generation_run_idx";
    DROP INDEX IF EXISTS "preview_access_grants_tenant_idx";
    DROP INDEX IF EXISTS "preview_access_grants_customer_email_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "preview_access_grants_id";
    DROP TABLE IF EXISTS "preview_access_grants_rels" CASCADE;
    DROP TABLE IF EXISTS "preview_access_grants" CASCADE;
    DROP TABLE IF EXISTS "preview_auth_verifications";
    DROP TABLE IF EXISTS "preview_auth_accounts";
    DROP TABLE IF EXISTS "preview_auth_sessions";
    DROP TABLE IF EXISTS "preview_auth_users";
  `)
}
