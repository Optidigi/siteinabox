import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "intake_submissions" ADD COLUMN "reviewed_generation_input" jsonb;
    ALTER TABLE "intake_submissions" ADD COLUMN "review_notes" varchar;
    ALTER TABLE "intake_submissions" ADD COLUMN "reviewed_at" timestamp(3) with time zone;
    ALTER TABLE "intake_submissions" ADD COLUMN "reviewed_by_id" integer;
    ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "intake_submissions_reviewed_by_idx" ON "intake_submissions" USING btree ("reviewed_by_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "intake_submissions_reviewed_by_idx";
    ALTER TABLE "intake_submissions" DROP CONSTRAINT "intake_submissions_reviewed_by_id_users_id_fk";
    ALTER TABLE "intake_submissions" DROP COLUMN "reviewed_generation_input";
    ALTER TABLE "intake_submissions" DROP COLUMN "review_notes";
    ALTER TABLE "intake_submissions" DROP COLUMN "reviewed_at";
    ALTER TABLE "intake_submissions" DROP COLUMN "reviewed_by_id";
  `)
}
