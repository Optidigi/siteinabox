import { access, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { errLike } from "../_helpers/cast"
const mocks = vi.hoisted(() => ({
  payload: {
    find: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { GET, HEAD } from "@/app/(payload)/api/renderer/media/[tenantId]/[...path]/route"

const ORIGINAL_ENV = { ...process.env }
const ROUTE_DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), ".data-out")
const TENANT_ID = `media-${Date.now()}`

const request = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers })

const ctx = (tenantId: string, path: string[]) => ({
  params: Promise.resolve({ tenantId, path }),
})

describe("renderer media route", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_RENDERER_API_TOKEN: "media-secret",
    }
    await mkdir(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media"), { recursive: true })
    await mkdir(join(ROUTE_DATA_DIR, "_uploads-tmp"), { recursive: true })
    await writeFile(join(ROUTE_DATA_DIR, "_uploads-tmp", "favicon.svg"), "<svg/>")
    await writeFile(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"), "<svg/>")
    mocks.payload.find.mockResolvedValue({
      docs: [{ id: 1, filename: "favicon.svg", mimeType: "image/svg+xml" }],
    })
  })

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV }
    await rm(join(ROUTE_DATA_DIR, "tenants", TENANT_ID), { recursive: true, force: true })
  })

  it("requires the renderer bearer token", async () => {
    expect((await GET(request("https://cms.test/api/renderer/media/41/favicon.svg"), ctx("41", ["favicon.svg"]))).status).toBe(401)
    expect((await GET(request("https://cms.test/api/renderer/media/41/favicon.svg", {
      authorization: "Bearer wrong",
    }), ctx("41", ["favicon.svg"]))).status).toBe(401)
  })

  it("serves tenant media only after the media row and path checks pass", async () => {
    const res = await GET(request(`https://cms.test/api/renderer/media/${TENANT_ID}/favicon.svg`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["favicon.svg"]))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/svg+xml")
    expect(res.headers.get("content-security-policy")).toBe("script-src 'none'")
    expect(await res.text()).toBe("<svg/>")
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

  it("supports HEAD and rejects traversal", async () => {
    const head = await HEAD(request(`https://cms.test/api/renderer/media/${TENANT_ID}/favicon.svg`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["favicon.svg"]))

    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")

    const traversal = await GET(request(`https://cms.test/api/renderer/media/${TENANT_ID}/../secret`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["..", "secret"]))

    expect(traversal.status).toBe(400)
  })

  it("self-heals canonical tenant media from Payload upload scratch after row authorization", async () => {
    await rm(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"), { force: true })

    const res = await GET(request(`https://cms.test/api/renderer/media/${TENANT_ID}/favicon.svg`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["favicon.svg"]))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("<svg/>")
    expect(await fsExists(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "favicon.svg"))).toBe(true)
  })

  it("serves nested tenant media paths after authorizing the media row by filename", async () => {
    await mkdir(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "nested"), { recursive: true })
    await writeFile(join(ROUTE_DATA_DIR, "tenants", TENANT_ID, "media", "nested", "favicon.svg"), "<svg/>")

    const nested = await GET(request(`https://cms.test/api/renderer/media/${TENANT_ID}/nested/favicon.svg`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["nested", "favicon.svg"]))

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

  it("returns 404 when the CMS media row is missing", async () => {
    mocks.payload.find.mockResolvedValueOnce({ docs: [] })

    const res = await GET(request(`https://cms.test/api/renderer/media/${TENANT_ID}/favicon.svg`, {
      authorization: "Bearer media-secret",
    }), ctx(TENANT_ID, ["favicon.svg"]))

    expect(res.status).toBe(404)
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
