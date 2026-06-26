import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" ADD COLUMN "provider" varchar DEFAULT 'mock' NOT NULL;
    ALTER TABLE "site_generation_runs" ADD COLUMN "model" varchar DEFAULT 'fixture:amblast' NOT NULL;
    ALTER TABLE "site_generation_runs" ADD COLUMN "prompt_version" varchar DEFAULT 'site-generation-v1' NOT NULL;
    ALTER TABLE "site_generation_runs" ADD COLUMN "generation_input_hash" varchar DEFAULT 'legacy' NOT NULL;
    ALTER TABLE "site_generation_runs" ADD COLUMN "generation_input" jsonb;
    ALTER TABLE "site_generation_runs" ADD COLUMN "generation_output_hash" varchar;
    ALTER TABLE "site_generation_runs" ADD COLUMN "raw_output" jsonb;
    ALTER TABLE "site_generation_runs" ADD COLUMN "parsed_output" jsonb;
    ALTER TABLE "site_generation_runs" ADD COLUMN "generation_attempts" numeric DEFAULT 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_generation_runs" DROP COLUMN "provider";
    ALTER TABLE "site_generation_runs" DROP COLUMN "model";
    ALTER TABLE "site_generation_runs" DROP COLUMN "prompt_version";
    ALTER TABLE "site_generation_runs" DROP COLUMN "generation_input_hash";
    ALTER TABLE "site_generation_runs" DROP COLUMN "generation_input";
    ALTER TABLE "site_generation_runs" DROP COLUMN "generation_output_hash";
    ALTER TABLE "site_generation_runs" DROP COLUMN "raw_output";
    ALTER TABLE "site_generation_runs" DROP COLUMN "parsed_output";
    ALTER TABLE "site_generation_runs" DROP COLUMN "generation_attempts";
  `)
}
