import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ptt-"))
  process.env.DATA_DIR = tmpDir
})

afterEach(async () => {
  delete process.env.DATA_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("projectTenantTheme", () => {
  it("writes CSS to tenants/<id>/tenant-theme.css", async () => {
    const { projectTenantTheme } = await import("@/lib/projection/projectTenantTheme")
    const tenantDir = path.join(tmpDir, "tenants", "t1")
    await fs.mkdir(tenantDir, { recursive: true })

    await projectTenantTheme("t1", { ...DEFAULT_THEME_TOKEN_SPEC, colors: { schemeId: "blue-professional" } })

    const written = await fs.readFile(path.join(tenantDir, "tenant-theme.css"), "utf8")
    expect(written).toContain(":root{")
    expect(written).toContain("--color-accent:#2563eb")
  })

  it("writes V2 Blue Professional default CSS when theme is null", async () => {
    const { projectTenantTheme } = await import("@/lib/projection/projectTenantTheme")
    const tenantDir = path.join(tmpDir, "tenants", "t2")
    await fs.mkdir(tenantDir, { recursive: true })

    await projectTenantTheme("t2", null)

    const written = await fs.readFile(path.join(tenantDir, "tenant-theme.css"), "utf8")
    expect(written).toContain("html:root{")
    expect(written).toContain("--color-accent:#2563eb")
    expect(written).toContain("--siab-accent-600:#2563eb")
    expect(written).not.toMatch(/--color-indigo-\d+:/)
  })

  it("does not throw when tenant dir does not exist — logs error and returns", async () => {
    const { projectTenantTheme } = await import("@/lib/projection/projectTenantTheme")
    // No tenants/t3 dir — writeFile will ENOENT
    await expect(projectTenantTheme("t3", DEFAULT_THEME_TOKEN_SPEC)).resolves.toBeUndefined()
  })
})
