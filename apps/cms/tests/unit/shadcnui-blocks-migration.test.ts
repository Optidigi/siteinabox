import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import * as migration from "@/migrations/20260715_120000_migrate_shadcnui_blocks_provider"

const source = readFileSync(
  resolve(process.cwd(), "src/migrations/20260715_120000_migrate_shadcnui_blocks_provider.ts"),
  "utf8",
)

describe("shadcnui-blocks provider migration", () => {
  it("is wired as a forward-only Payload migration", async () => {
    expect(typeof migration.up).toBe("function")
    await expect(migration.down({ db: {} as any, payload: {} as any, req: {} as any }))
      .rejects.toThrow(/intentionally irreversible/)
    expect(readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8"))
      .toContain("20260715_120000_migrate_shadcnui_blocks_provider")
  })

  it("migrates every retired generic semantic and persisted surface", () => {
    for (const semantic of ["richText", "newsletter", "bentoGrid"]) expect(source).toContain(semantic)
    for (const table of [
      "published_site_snapshots",
      "site_generation_runs",
      "pages_blocks_hero",
      "pages_blocks_content_section",
      "site_settings",
    ]) expect(source).toContain(table)
    for (const variant of [
      "shadcnui-blocks.hero-01",
      "shadcnui-blocks.timeline-01",
      "shadcnui-blocks.banner-04",
      "shadcnui-blocks.navbar-01",
      "shadcnui-blocks.footer-01",
    ]) expect(source).toContain(variant)
  })

  it("preserves tenant-owned Amicare rows", () => {
    expect(source).toContain("NOT LIKE 'amicare%'")
    expect(source).not.toMatch(/DROP TABLE\s+"?pages_blocks_/i)
  })
})
