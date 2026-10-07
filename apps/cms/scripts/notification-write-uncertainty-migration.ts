import assert from "node:assert/strict"
import type { Payload } from "payload"
import "@payloadcms/db-postgres"
import { z } from "zod"

/** Generate only the reviewed mail retry field and its conservative backfill. */
export async function dynamic({ payload }: { payload: Payload }) {
  const kit = payload.db.requireDrizzleKit()
  const raw: unknown = await kit.generateDrizzleJson(payload.db.schema)
  const snapshot = z.object({
    tables: z.record(z.string(), z.object({ columns: z.record(z.string(), z.unknown()) }).passthrough()),
    enums: z.record(z.string(), z.unknown()),
  }).passthrough().parse(raw)
  const before = structuredClone(snapshot)
  const table = before.tables["public.commerce_notification_deliveries"]
  const enumName = "public.enum_commerce_notification_deliveries_retry_state"
  assert(table?.columns.retry_state && before.enums[enumName], "The owning schema must declare the mail retry field and enum")
  delete table.columns.retry_state
  delete before.enums[enumName]
  const up: string[] = await kit.generateMigration(before, snapshot)
  const down: string[] = await kit.generateMigration(snapshot, before)
  assert.deepEqual(up, [
    `CREATE TYPE "public"."enum_commerce_notification_deliveries_retry_state" AS ENUM('none', 'retryable', 'permanent');`,
    `ALTER TABLE "commerce_notification_deliveries" ADD COLUMN "retry_state" "enum_commerce_notification_deliveries_retry_state" DEFAULT 'none';`,
  ])
  assert.deepEqual(down, [
    'ALTER TABLE "commerce_notification_deliveries" DROP COLUMN "retry_state";',
    'DROP TYPE "public"."enum_commerce_notification_deliveries_retry_state";',
  ])
  const backfills = ["commerce_notification_deliveries", "legal_notification_deliveries"].map(name =>
    `UPDATE "${name}" SET "retry_state" = 'permanent', "last_error" = COALESCE("last_error", 'Mail delivery may have started; a verified provider receipt is required before resend.') WHERE "status" = 'processing';`,
  )
  const guard = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM "commerce_notification_deliveries" WHERE "retry_state" = 'permanent') OR EXISTS (SELECT 1 FROM "legal_notification_deliveries" WHERE "retry_state" = 'permanent') THEN RAISE EXCEPTION 'Resolve uncertain mail writes before removing their durable evidence'; END IF; END $$;`
  return {
    upSQL: "  await db.execute(sql`" + [...up, ...backfills].join("\n") + "`);",
    downSQL: "  await db.execute(sql`" + [guard, ...down].join("\n") + "`);",
  }
}
