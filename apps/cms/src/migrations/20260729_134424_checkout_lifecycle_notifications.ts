import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_commerce_notification_deliveries_kind" ADD VALUE 'payment_received' BEFORE 'upcoming_charge_7d';
  ALTER TYPE "public"."enum_commerce_notification_deliveries_kind" ADD VALUE 'domain_verification_required' BEFORE 'upcoming_charge_7d';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "commerce_notification_deliveries" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_commerce_notification_deliveries_kind";
  CREATE TYPE "public"."enum_commerce_notification_deliveries_kind" AS ENUM('upcoming_charge_7d', 'payment_failed_0d', 'payment_overdue_3d', 'payment_overdue_7d', 'payment_overdue_13d', 'service_suspended_14d', 'service_restored', 'cancellation_scheduled', 'cancellation_effective', 'domain_renewal_90d', 'domain_renewal_60d', 'domain_renewal_30d', 'domain_renewal_14d', 'domain_renewal_7d', 'domain_renewal_admin_7d', 'domain_renewal_1d', 'domain_renewed');
  ALTER TABLE "commerce_notification_deliveries" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_commerce_notification_deliveries_kind" USING "kind"::"public"."enum_commerce_notification_deliveries_kind";`)
}
