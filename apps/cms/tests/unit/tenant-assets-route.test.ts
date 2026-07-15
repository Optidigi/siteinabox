import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { NextRequest } from "next/server"

let tmpDir: string

const req = new NextRequest("https://admin.example.com/api/tenant-assets/77/cms-editor.css")

const callRoute = async (tenantId: string, segments: string[]) => {
  const { GET } = await import("@/app/(payload)/api/tenant-assets/[tenantId]/[...path]/route")
  return GET(req, { params: Promise.resolve({ tenantId, path: segments }) })
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "siab-tenant-assets-"))
  process.env.DATA_DIR = tmpDir
})

afterEach(async () => {
  delete process.env.DATA_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("tenant-assets route allowlist", () => {
  beforeEach(async () => {
    const tenantRoot = path.join(tmpDir, "tenants", "77")
    await fs.mkdir(path.join(tenantRoot, "files"), { recursive: true })
    await fs.mkdir(path.join(tenantRoot, "pages"), { recursive: true })
    await fs.mkdir(path.join(tenantRoot, "media"), { recursive: true })
    await fs.writeFile(path.join(tenantRoot, "cms-editor.css"), ".rt-canvas{color:red}")
    await fs.writeFile(path.join(tenantRoot, "files", "font.woff2"), "font")
    await fs.writeFile(path.join(tenantRoot, "manifest.json"), "{\"secret\":true}")
    await fs.writeFile(path.join(tenantRoot, "site.json"), "{\"secret\":true}")
    await fs.writeFile(path.join(tenantRoot, "pages", "home.json"), "{\"secret\":true}")
    await fs.writeFile(path.join(tenantRoot, "media", "secret.png"), "secret")
  })

  it("serves the tenant root cms-editor.css asset", async () => {
    const res = await callRoute("77", ["cms-editor.css"])

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/css")
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(await res.text()).toBe(".rt-canvas{color:red}")
  })

  it("serves files/* assets used by rewritten tenant CSS URLs", async () => {
    const res = await callRoute("77", ["files", "font.woff2"])

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("font/woff2")
    expect(await res.text()).toBe("font")
  })

  it.each([
    ["manifest.json"],
    ["site.json"],
    ["pages", "home.json"],
    ["media", "secret.png"],
    ["tenant-theme.css"],
  ])("does not serve projected tenant data path %s", async (...segments) => {
    const res = await callRoute("77", segments)

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("not found")
  })

  it.each([
    ["files", "..", "manifest.json"],
    ["files", "."],
    ["files", ""],
    ["files", "nested\\secret.woff2"],
  ])("rejects unsafe asset path %s", async (...segments) => {
    const res = await callRoute("77", segments)

    expect(res.status).toBe(403)
    expect(await res.text()).toBe("forbidden")
  })

  it("returns 404 for missing files inside the allowed asset surface", async () => {
    const res = await callRoute("77", ["files", "missing.woff2"])

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("not found")
  })

  it("rejects non-numeric tenant ids", async () => {
    const res = await callRoute("abc", ["cms-editor.css"])

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("invalid tenant id")
  })
})
