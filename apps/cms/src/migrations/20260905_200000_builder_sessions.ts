import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "builder_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "customer_email" varchar NOT NULL,
    "display_name" varchar NOT NULL,
    "contact_phone" varchar DEFAULT '',
    "legal" jsonb NOT NULL,
    "messages" jsonb NOT NULL,
    "facts" jsonb,
    "client_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "builder_sessions_customer_email_idx" ON "builder_sessions" USING btree ("customer_email");
  CREATE INDEX "builder_sessions_client_slug_idx" ON "builder_sessions" USING btree ("client_slug");
  CREATE INDEX "builder_sessions_updated_at_idx" ON "builder_sessions" USING btree ("updated_at");
  CREATE INDEX "builder_sessions_created_at_idx" ON "builder_sessions" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE "builder_sessions" CASCADE;`)
}
