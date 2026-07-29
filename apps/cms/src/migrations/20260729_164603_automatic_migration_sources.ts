import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_domain_migrations_source_mechanism" ADD VALUE 'cloudflare_api_v1';
  ALTER TYPE "public"."enum_domain_migrations_source_mechanism" ADD VALUE 'authorized_axfr_v1';
  ALTER TYPE "public"."enum_domain_migrations_source_mechanism" ADD VALUE 'validated_provider_export_v1';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "domain_migrations" ALTER COLUMN "source_mechanism" SET DATA TYPE text;
  ALTER TABLE "domain_migrations" ALTER COLUMN "source_mechanism" SET DEFAULT 'customer_authorized_provider_export_v1'::text;
  DROP TYPE "public"."enum_domain_migrations_source_mechanism";
  CREATE TYPE "public"."enum_domain_migrations_source_mechanism" AS ENUM('customer_authorized_provider_export_v1');
  ALTER TABLE "domain_migrations" ALTER COLUMN "source_mechanism" SET DEFAULT 'customer_authorized_provider_export_v1'::"public"."enum_domain_migrations_source_mechanism";
  ALTER TABLE "domain_migrations" ALTER COLUMN "source_mechanism" SET DATA TYPE "public"."enum_domain_migrations_source_mechanism" USING "source_mechanism"::"public"."enum_domain_migrations_source_mechanism";`)
}
