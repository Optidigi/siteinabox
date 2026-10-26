import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "microsoft_mail_provisioning_runs" ADD COLUMN "action_lease_token" varchar;
  ALTER TABLE "microsoft_mail_provisioning_runs" ADD COLUMN "action_lease_until" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "microsoft_mail_provisioning_runs" DROP COLUMN "action_lease_token";
  ALTER TABLE "microsoft_mail_provisioning_runs" DROP COLUMN "action_lease_until";`)
}
