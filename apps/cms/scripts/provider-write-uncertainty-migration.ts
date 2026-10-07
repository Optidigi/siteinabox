import assert from "node:assert/strict"
import type { Payload } from "payload"
import "@payloadcms/db-postgres"
import { z } from "zod"

// Payload's predefined-migration generator owns formatting and the migration
// index. Isolate this additive column from historical snapshot drift.
export async function dynamic({ payload }: { payload: Payload }) {
  const kit = payload.db.requireDrizzleKit()
  const raw: unknown = await kit.generateDrizzleJson(payload.db.schema)
  const snapshot = z.object({ tables: z.record(z.string(), z.object({ columns: z.record(z.string(), z.unknown()) }).passthrough()) }).passthrough().parse(raw)
  const before = structuredClone(snapshot)
  const table = before.tables["public.appointment_calendar_events"]
  assert(table?.columns.provider_create_uncertain, "The owning schema must declare the uncertainty field")
  delete table.columns.provider_create_uncertain
  const up: string[] = await kit.generateMigration(before, snapshot)
  const down: string[] = await kit.generateMigration(snapshot, before)
  assert.deepEqual(up, ['ALTER TABLE "appointment_calendar_events" ADD COLUMN "provider_create_uncertain" boolean DEFAULT false;'])
  assert.deepEqual(down, ['ALTER TABLE "appointment_calendar_events" DROP COLUMN "provider_create_uncertain";'])
  // Old attempts/leases can be reset. An absent provider ID therefore cannot
  // prove that an existing row has never issued a create. Preserve uncertainty.
  const backfill = 'UPDATE "appointment_calendar_events" SET "provider_create_uncertain" = true WHERE "provider_event_id" IS NULL OR "provider_event_id" = \'\';'
  const mailBackfill = `UPDATE "appointment_notification_deliveries" SET "retry_state" = 'permanent', "last_error" = COALESCE("last_error", 'Mail delivery may have started; a verified provider receipt is required before resend.') WHERE "status" = 'processing';`
  const rollbackGuard = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM "appointment_calendar_events" WHERE "provider_create_uncertain" = true) OR EXISTS (SELECT 1 FROM "appointment_notification_deliveries" WHERE "status" = 'processing' AND "retry_state" = 'permanent') THEN RAISE EXCEPTION 'Resolve uncertain provider writes before removing their durable evidence'; END IF; END $$;`
  return {
    upSQL: "  await db.execute(sql`" + [...up, backfill, mailBackfill].join("\n") + "`);",
    downSQL: "  await db.execute(sql`" + [rollbackGuard, ...down].join("\n") + "`);",
  }
}
