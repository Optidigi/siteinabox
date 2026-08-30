import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("CTA second variant migration", () => {
  it("extends the existing CTA enum without rewriting stored content", () => {
    const source = readFileSync(resolve(process.cwd(), "src/migrations/20260828_100000_cta_second_variant.ts"), "utf8")

    expect(source).toContain("ALTER TYPE public.enum_pages_blocks_cta_variant")
    expect(source).toContain("ADD VALUE IF NOT EXISTS 'cta-02'")
    expect(source).toContain("restore a database backup")
  })
})
