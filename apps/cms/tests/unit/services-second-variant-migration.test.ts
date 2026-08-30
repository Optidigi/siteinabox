import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("services second variant migration", () => {
  it("extends the existing services enum without rewriting service content", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/migrations/20260827_110000_services_second_variant.ts"),
      "utf8",
    )
    const index = readFileSync(resolve(process.cwd(), "src/migrations/index.ts"), "utf8")

    expect(index).toContain("20260827_110000_services_second_variant")
    expect(source).toContain("ALTER TYPE public.enum_pages_blocks_services_variant")
    expect(source).toContain("ADD VALUE IF NOT EXISTS 'services-02'")
    expect(source).not.toContain("UPDATE public.pages_blocks_services")
    expect(source).not.toContain("published_site_snapshots")
  })
})
