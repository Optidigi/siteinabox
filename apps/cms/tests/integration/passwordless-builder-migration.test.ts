import { randomUUID } from "node:crypto"
import { createLocalReq } from "payload"
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { getTestPayload } from "./_helpers"
import { up, down } from "@/migrations/20261008_002457_pr03_passwordless_builder"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Migration rehearsal requires the isolated test database")
  payload = await getTestPayload()
}, 60_000)
const execute = (raw: string) => payload.db.execute({ drizzle: payload.db.drizzle, raw })
const columns = async () => z.object({ rows: z.array(z.object({ table_name: z.string(), column_name: z.string(), data_type: z.string(), is_nullable: z.string() })) }).parse(await execute("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows

describe("owner-generated passwordless/builder migration", () => {
  it("rehearses the prior schema upgrade without changing existing columns or retained tenant data", async () => {
    const req = await createLocalReq({}, payload), args = { payload, req, db: payload.db.drizzle }
    const upgraded = await columns()
    const marker = `migration-${randomUUID()}`
    await execute(`INSERT INTO tenants (name,slug,domain,status) VALUES ('Retained fixture','${marker}','${marker}.test','provisioning')`)
    await down(args)
    const prior = await columns()
    expect(prior.some((column) => column.table_name === "builder_operations")).toBe(false)
    expect(prior.some((column) => column.table_name === "preview_access_grants" && column.column_name === "inactive_notice_state")).toBe(false)
    await up(args)
    expect(await columns()).toEqual(upgraded)
    const before = new Map(prior.map((column) => [`${column.table_name}.${column.column_name}`, column]))
    for (const column of await columns()) {
      const existing = before.get(`${column.table_name}.${column.column_name}`)
      if (existing) expect(column).toEqual(existing)
    }
    expect((await payload.find({ collection: "tenants", where: { slug: { equals: marker } }, overrideAccess: true })).docs[0]?.name).toBe("Retained fixture")
  })
  it("refuses rollback after accounting or mail evidence appears and keeps the schema intact", async () => {
    const req = await createLocalReq({}, payload), args = { payload, req, db: payload.db.drizzle }
    const before = await columns()
    await payload.create({ collection: "magic-mail-budgets", overrideAccess: true, data: { budgetKey: randomUUID(), day: "2026-10-08", attempts: 1 } })
    await expect(down(args)).rejects.toThrow("Preserve customer identity, accounting and notice evidence")
    expect(await columns()).toEqual(before)
    expect((await payload.find({ collection: "magic-mail-budgets", overrideAccess: true })).totalDocs).toBe(1)
  })
})
