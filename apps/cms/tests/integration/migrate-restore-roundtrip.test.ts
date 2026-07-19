import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getTestPayload } from "./_helpers"
import { createArgs, relationId, updateArgs, asDocRecord } from "../_helpers/payloadApi"
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import type { MockDoc } from "../_helpers/mockPayload"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantId: number
let pageId: number
const uniq = `${Date.now()}-${Math.floor(Math.random() * 100000)}`

const manifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  themedNodes: [{ id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text", required: true }] }],
}

beforeAll(async () => {
  payload = await getTestPayload()
  const tenant = await payload.create(createArgs("tenants", {
    name: "RT Restore Test", slug: "tenant-restore", domain: `rtr-${uniq}.test`,
    siteManifest: manifest,
  }, { overrideAccess: true }))
  tenantId = relationId(tenant)

  const page = await payload.create(createArgs("pages", {
    title: "Original", slug: `roundtrip-${uniq}`, status: "draft", tenant: tenantId,
    blocks: [{
      blockType: "contentSection",
      designVariant: "shadcnui-blocks.legal-content-01",
      body: { t: "root", variant: "block",
        children: [{ t: "paragraph", children: [{ t: "text", v: "original content" }] }] },
    }],
  }, { overrideAccess: true }))
  pageId = relationId(page)
}, 30000)

afterAll(async () => {
  if (pageId) await payload.delete({ collection: "pages", id: pageId, overrideAccess: true })
  if (tenantId) await payload.delete({ collection: "tenants", id: tenantId, overrideAccess: true })
})

function blockBody(doc: MockDoc): MockDoc {
  const blocks = doc.blocks as MockDoc[] | undefined
  const body = blocks?.[0]?.body as MockDoc | undefined
  const children = body?.children as MockDoc[] | undefined
  const paragraph = children?.[0]?.children as MockDoc[] | undefined
  return paragraph?.[0] ?? {}
}

describe("migrate-richtext-v2 backup + restore round-trip", () => {
  it("backup file round-trips through the restore script unchanged", async () => {
    const original = await payload.findByID({ collection: "pages", id: pageId, overrideAccess: true })
    const originalDoc = asDocRecord(original)

    const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-test")
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupDir = resolve(dataDir, "migrations-backup", `richtext-v2-roundtrip-${stamp}`)
    mkdirSync(backupDir, { recursive: true })
    writeFileSync(resolve(backupDir, `${pageId}.json`), JSON.stringify(original, null, 2))

    const backupFiles = readdirSync(backupDir).filter((f) => f.endsWith(".json"))
    expect(backupFiles).toHaveLength(1)
    const backup = JSON.parse(readFileSync(resolve(backupDir, backupFiles[0]!), "utf-8")) as MockDoc
    expect(backup.id).toBe(pageId)
    expect(backup.blocks).toEqual(originalDoc.blocks)

    await payload.update(updateArgs("pages", pageId, {
      blocks: [{
        blockType: "contentSection",
        designVariant: "shadcnui-blocks.legal-content-01",
        body: { t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "MUTATED" }] }] },
      }],
    }, { overrideAccess: true }))

    const mutated = asDocRecord(await payload.findByID({ collection: "pages", id: pageId, overrideAccess: true }))
    expect(blockBody(mutated).v).toBe("MUTATED")

    const childResult = spawnSync(
      "pnpm",
      ["exec", "tsx", "--tsconfig", "tsconfig.scripts.json", "scripts/restore-richtext-v2.ts", backupDir],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          DATABASE_URI: process.env.DATABASE_URI,
          PAYLOAD_MIGRATING: "true",
          PG_POOL_MAX: "3",
          PG_CONN_TIMEOUT_MS: "15000",
        },
        timeout: 45000,
      },
    )
    const restoreOutput = (childResult.stdout?.toString() ?? "") + (childResult.stderr?.toString() ?? "")
    if (childResult.error) {
      throw new Error(`Restore script failed to run: ${childResult.error.message}\n${restoreOutput}`)
    }
    expect(childResult.status, `Restore script exited non-zero. Output:\n${restoreOutput}`).toBe(0)
    expect(restoreOutput).toMatch(/restored page/i)

    const restored = asDocRecord(await payload.findByID({ collection: "pages", id: pageId, overrideAccess: true }))
    expect(blockBody(restored).v).toBe("original content")
    expect(restored.blocks).toEqual(originalDoc.blocks)
  }, 60000)
})
