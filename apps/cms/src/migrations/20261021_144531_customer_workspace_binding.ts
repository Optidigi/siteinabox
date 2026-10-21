import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
     CREATE TABLE "customer_accounts" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL,
      "preview_user_id" varchar NOT NULL,
      "verified_at" timestamp(3) with time zone NOT NULL,
      "tenant_id" integer,
      "payload_user_id" integer,
      "revoked_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "builder_sessions" ADD COLUMN "customer_account_id" integer;
    ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_payload_user_id_users_id_fk" FOREIGN KEY ("payload_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE UNIQUE INDEX "customer_accounts_email_idx" ON "customer_accounts" USING btree ("email");
    CREATE UNIQUE INDEX "customer_accounts_preview_user_id_idx" ON "customer_accounts" USING btree ("preview_user_id");
    CREATE INDEX "customer_accounts_tenant_idx" ON "customer_accounts" USING btree ("tenant_id");
    CREATE UNIQUE INDEX "customer_accounts_payload_user_idx" ON "customer_accounts" USING btree ("payload_user_id");
    CREATE INDEX "customer_accounts_updated_at_idx" ON "customer_accounts" USING btree ("updated_at");
    CREATE INDEX "customer_accounts_created_at_idx" ON "customer_accounts" USING btree ("created_at");
    ALTER TABLE "builder_sessions" ADD CONSTRAINT "builder_sessions_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;
    CREATE UNIQUE INDEX "builder_sessions_customer_account_idx" ON "builder_sessions" USING btree ("customer_account_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN IF EXISTS (SELECT 1 FROM customer_accounts) THEN RAISE EXCEPTION 'Preserve verified customer identity; use reviewed forward recovery'; END IF; END $$;
  ALTER TABLE "builder_sessions" DROP CONSTRAINT "builder_sessions_customer_account_id_customer_accounts_id_fk";
  ALTER TABLE "customer_accounts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customer_accounts" CASCADE;
  DROP INDEX "builder_sessions_customer_account_idx";
  ALTER TABLE "builder_sessions" DROP COLUMN "customer_account_id";
  `);
}
