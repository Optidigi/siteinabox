import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getTestPayload } from "./_helpers"
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

let payload: Awaited<ReturnType<typeof getTestPayload>>
let tenantId: string | number
let pageId: string | number
const uniq = `${Date.now()}-${Math.floor(Math.random() * 100000)}`

const manifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  themedNodes: [{ id: "eyebrow", label: "Eyebrow", fields: [{ name: "text", type: "text", required: true }] }],
}

beforeAll(async () => {
  payload = await getTestPayload()
  const t = await payload.create({
    collection: "tenants",
    data: {
      name: "RT Restore Test", slug: "tenant-restore", domain: `rtr-${uniq}.test`,
      siteManifest: manifest,
    } as any,
    overrideAccess: true,
  })
  tenantId = (t as any).id

  const p = await payload.create({
    collection: "pages",
    data: {
      title: "Original", slug: `roundtrip-${uniq}`, status: "draft", tenant: tenantId,
      blocks: [{
        blockType: "contentSection",
        designVariant: "shadcnui-blocks.legal-content-01",
        body: { t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "original content" }] }] },
      }],
    } as any,
    overrideAccess: true,
  })
  pageId = (p as any).id
}, 30000)

afterAll(async () => {
  if (pageId) await payload.delete({ collection: "pages", id: pageId as any, overrideAccess: true })
  if (tenantId) await payload.delete({ collection: "tenants", id: tenantId as any, overrideAccess: true })
})

describe("migrate-richtext-v2 backup + restore round-trip", () => {
  it("backup file round-trips through the restore script unchanged", async () => {
    const original = await payload.findByID({ collection: "pages", id: pageId as any, overrideAccess: true })

    // Manually create a backup file in the same format the migration script produces.
    const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-test")
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupDir = resolve(dataDir, "migrations-backup", `richtext-v2-roundtrip-${stamp}`)
    mkdirSync(backupDir, { recursive: true })
    writeFileSync(resolve(backupDir, `${pageId}.json`), JSON.stringify(original, null, 2))

    // Verify the backup file is well-formed
    const backupFiles = readdirSync(backupDir).filter((f) => f.endsWith(".json"))
    expect(backupFiles).toHaveLength(1)
    const backup = JSON.parse(readFileSync(resolve(backupDir, backupFiles[0]!), "utf-8"))
    expect(backup.id).toBe(pageId)
    expect(backup.blocks).toEqual((original as any).blocks)

    // Mutate the live page
    await payload.update({
      collection: "pages", id: pageId as any,
      data: { blocks: [{
        blockType: "contentSection",
        designVariant: "shadcnui-blocks.legal-content-01",
        body: { t: "root", variant: "block",
          children: [{ t: "paragraph", children: [{ t: "text", v: "MUTATED" }] }] },
      }] } as any,
      overrideAccess: true,
    })

    const mutated = await payload.findByID({ collection: "pages", id: pageId as any, overrideAccess: true })
    expect((mutated as any).blocks[0].body.children[0].children[0].v).toBe("MUTATED")

    // Run the restore script via tsx.
    // --tsconfig tsconfig.scripts.json stubs `server-only` (not installed as a
    // standalone pkg — Next.js bundles it implicitly) so the child process can
    // resolve the transitive import chain through src/ without crashing.
    const childResult = spawnSync(
      "pnpm",
      ["exec", "tsx", "--tsconfig", "tsconfig.scripts.json", "scripts/restore-richtext-v2.ts", backupDir],
      {
        cwd: process.cwd(),
        // Explicitly close stdin and pipe stdout/stderr so the child doesn't
        // inherit the vitest worker's IPC file descriptors.
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          // The setup.ts DATABASE_URI override only affects the test process.
          // Pass the already-overridden value explicitly so the child process
          // (which spawns its own Payload instance) hits the test DB, not prod.
          DATABASE_URI: process.env.DATABASE_URI,
          // Prevent the child's Payload init from running pushDevSchema (drizzle
          // DDL push). Two concurrent pushes on the same DB deadlock on the
          // implicit DDL lock. The test DB schema is already current; we only
          // need Payload's query layer, not a schema sync.
          PAYLOAD_MIGRATING: "true",
          // Limit the child's pg pool size so it doesn't exhaust Postgres
          // max_connections (100) when spawned alongside a vitest process that
          // already holds many idle connections from prior test files.
          PG_POOL_MAX: "3",
          // Fail fast if the child's pool cannot acquire a connection within 15s,
          // rather than hanging indefinitely. Surfaces real connection issues.
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

    // Verify the page is back to original
    const restored = await payload.findByID({ collection: "pages", id: pageId as any, overrideAccess: true })
    expect((restored as any).blocks[0].body.children[0].children[0].v).toBe("original content")
    expect((restored as any).blocks).toEqual((original as any).blocks)
  }, 60000) // 60s timeout — spinning up tsx + payload twice takes time
})
