import assert from "node:assert/strict"
import type { Payload } from "payload"
import "@payloadcms/db-postgres"
import { z } from "zod"

// Historical snapshots omit later owner-generated migrations. As with the
// provider/mail migrations, derive only the declared additive delta from the
// owning Drizzle schema; verify existing schema separately during rehearsal.
export async function dynamic({ payload }: { payload: Payload }) {
  const kit = payload.db.requireDrizzleKit()
  const snapshot = z.object({
    tables: z.record(z.string(), z.object({ columns: z.record(z.string(), z.unknown()) }).passthrough()),
    enums: z.record(z.string(), z.object({ values: z.array(z.string()) }).passthrough()),
  }).passthrough().parse(await kit.generateDrizzleJson(payload.db.schema))
  const before = structuredClone(snapshot)
  const tables = ["builder_quota_accounts", "builder_quota_global", "builder_operations", "customer_auth_accounts", "customer_session_bindings", "costly_search_budgets", "magic_mail_budgets"]
  for (const name of tables) {
    assert(before.tables[`public.${name}`], `Missing declared table ${name}`)
    delete before.tables[`public.${name}`]
    for (const key of Object.keys(before.enums)) if (key.startsWith(`public.enum_${name}_`)) delete before.enums[key]
  }
  const grant = before.tables["public.preview_access_grants"]
  assert(grant, "Missing existing preview grants")
  for (const name of ["inactive_notice_state", "inactive_notice_claimed_at", "inactive_notice_sent_at", "inactive_notice_activity_at", "inactive_expires_at", "inactive_expired_at"]) {
    assert(grant.columns[name], `Missing declared preview field ${name}`)
    delete grant.columns[name]
  }
  // The field's index is part of the same additive declaration.
  const indexes = z.record(z.string(), z.unknown()).parse(grant.indexes)
  for (const key of Object.keys(indexes)) if (key.includes("inactive_expires_at") || key.includes("inactive_expired_at")) delete indexes[key]
  grant.indexes = indexes
  delete before.enums["public.enum_preview_access_grants_inactive_notice_state"]
  for (const name of ["public.enum_payload_jobs_task_slug", "public.enum_payload_jobs_log_task_slug"]) {
    const enumeration = before.enums[name]
    if (!enumeration) throw new Error(`Missing declared jobs ${name}`)
    assert(enumeration.values.includes("inactive-previews") && enumeration.values.includes("reconcile-builder-operations"), `Missing declared jobs ${name}`)
    enumeration.values = enumeration.values.filter((value) => value !== "inactive-previews" && value !== "reconcile-builder-operations")
  }
  const mail = before.enums["public.enum_mail_logs_flow"]
  if (!mail) throw new Error("Missing declared notice mail enum")
  assert(mail.values.includes("preview.expiry_notice"), "Missing declared notice mail intent")
  mail.values = mail.values.filter((value) => value !== "preview.expiry_notice")
  const format = (statement: string) => statement.split("\n").map((line) => line.replaceAll("\t", "  ").trimEnd()).filter((line) => line.length > 0).join("\n")
  const up: string[] = (await kit.generateMigration(before, snapshot)).map(format)
  const down: string[] = (await kit.generateMigration(snapshot, before)).map(format)
  assert(up.length > 0 && down.length > 0, "Expected an additive migration")
  assert(up.every((statement) => !/DROP\s+(TABLE|COLUMN|TYPE)|RENAME\s/i.test(statement)), "Unexpected destructive upgrade")
  const evidenceTables = ["builder_quota_accounts", "builder_operations", "customer_auth_accounts", "customer_session_bindings", "costly_search_budgets", "magic_mail_budgets"]
  const conditions = evidenceTables.map((table) => `EXISTS (SELECT 1 FROM "${table}")`)
  conditions.push(`EXISTS (SELECT 1 FROM "builder_quota_global" WHERE "attempts" > 0 OR "ingress_requests" > 0 OR "active_operations" > 0 OR "charged_cost_units" > 0)`)
  conditions.push(`EXISTS (SELECT 1 FROM "preview_access_grants" WHERE "inactive_notice_claimed_at" IS NOT NULL OR "inactive_expired_at" IS NOT NULL)`)
  conditions.push(`EXISTS (SELECT 1 FROM "payload_jobs" WHERE "task_slug" IN ('inactive-previews', 'reconcile-builder-operations'))`)
  conditions.push(`EXISTS (SELECT 1 FROM "payload_jobs_log" WHERE "task_slug" IN ('inactive-previews', 'reconcile-builder-operations'))`)
  conditions.push(`EXISTS (SELECT 1 FROM "mail_logs" WHERE "flow" = 'preview.expiry_notice')`)
  const guard = `DO $$ BEGIN IF ${conditions.join(" OR ")} THEN RAISE EXCEPTION 'Preserve customer identity, accounting and notice evidence; use a forward fix'; END IF; END $$;`
  return {
    upSQL: "  await db.execute(sql`" + up.join("\n") + "`);",
    downSQL: "  await db.execute(sql`" + [guard, ...down].join("\n") + "`);",
  }
}
