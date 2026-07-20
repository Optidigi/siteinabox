import { access, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { errLike } from "../_helpers/cast"
const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
    find: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { GET, HEAD } from "@/app/(payload)/siab-media/[tenantId]/[...path]/route"

const ORIGINAL_ENV = { ...process.env }
const ROUTE_DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), ".data-out")
const TENANT_ID = `cms-media-${Date.now()}`

const request = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers })

const ctx = (tenantId: string, path: string[]) => ({
  params: Promise.resolve({ tenantId, path }),
})

describe("CMS siab-media route", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
    }
    await mkdir(join(ROUTE_DATA_DIR, "_uploads-tmp"), { recursive: true })
    await mkdir(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media"), { recursive: true })
    await writeFile(join(ROUTE_DATA_DIR, "_uploads-tmp", "favicon.svg"), "<svg/>")
    await writeFile(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"), "<svg/>")
    mocks.payload.auth.mockResolvedValue({
      user: {
        role: "editor",
        tenants: [{ tenant: TENANT_ID }],
      },
    })
    mocks.payload.find.mockResolvedValue({
      docs: [{ id: 1, filename: "favicon.svg", mimeType: "image/svg+xml" }],
    })
  })

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV }
    await rm(join(ROUTE_DATA_DIR, "tenants", TENANT_ID), { recursive: true, force: true })
  })

  it("serves authenticated editor media through the same public media URL shape", async () => {
    const res = await GET(request(`https://cms.test/siab-media/${TENANT_ID}/favicon.svg`), ctx(TENANT_ID, ["favicon.svg"]))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/svg+xml")
    expect(res.headers.get("content-security-policy")).toBe("script-src 'none'")
    expect(await res.text()).toBe("<svg/>")
  })

  it("supports HEAD and rejects unauthorized or cross-tenant requests", async () => {
    const head = await HEAD(request(`https://cms.test/siab-media/${TENANT_ID}/favicon.svg`), ctx(TENANT_ID, ["favicon.svg"]))
    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")

    mocks.payload.auth.mockResolvedValueOnce({ user: null })
    const unauthenticated = await GET(request(`https://cms.test/siab-media/${TENANT_ID}/favicon.svg`), ctx(TENANT_ID, ["favicon.svg"]))
    expect(unauthenticated.status).toBe(401)

    mocks.payload.auth.mockResolvedValueOnce({ user: { role: "editor", tenants: [{ tenant: "other" }] } })
    const crossTenant = await GET(request(`https://cms.test/siab-media/${TENANT_ID}/favicon.svg`), ctx(TENANT_ID, ["favicon.svg"]))
    expect(crossTenant.status).toBe(403)
  })

  it("self-heals from Payload upload scratch after row authorization", async () => {
    await rm(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"), { force: true })

    const res = await GET(request(`https://cms.test/siab-media/${TENANT_ID}/favicon.svg`), ctx(TENANT_ID, ["favicon.svg"]))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("<svg/>")
    expect(await fsExists(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"))).toBe(true)
  })

  it("serves nested authenticated media paths after authorizing the media row by filename", async () => {
    await mkdir(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "nested"), { recursive: true })
    await writeFile(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "nested", "favicon.svg"), "<svg/>")

    const nested = await GET(request(`https://cms.test/siab-media/${TENANT_ID}/nested/favicon.svg`), ctx(TENANT_ID, ["nested", "favicon.svg"]))

    expect(nested.status).toBe(200)
    expect(await nested.text()).toBe("<svg/>")
    expect(mocks.payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "media",
      where: {
        and: [
          { tenant: { equals: TENANT_ID } },
          { filename: { equals: "favicon.svg" } },
        ],
      },
    }))
  })
})

async function fsExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
