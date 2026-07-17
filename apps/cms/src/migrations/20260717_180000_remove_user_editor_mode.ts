import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "editor_mode";
    DROP TYPE IF EXISTS "public"."enum_users_editor_mode";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_editor_mode" AS ENUM('canvas', 'sidebar');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "editor_mode" "public"."enum_users_editor_mode";
  `)
}
