import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const payload = {
  count: vi.fn(),
}

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => payload),
}))
vi.mock("@/payload.config", () => ({
  default: {},
}))

import { GET } from "@/app/(payload)/api/health/route"
import { normalizeBuildRevision } from "@/lib/health/normalizeBuildRevision"

describe("health endpoint", () => {
  let dataDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    payload.count.mockReset()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "siab-health-"))
    vi.stubEnv("DATA_DIR", dataDir)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    payload.count.mockReset()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it("returns an explicit full SHA revision", async () => {
    payload.count.mockResolvedValue(1)
    vi.stubEnv("SIAB_BUILD_REVISION", "0123456789abcdef0123456789abcdef01234567")

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: "ok",
      db: "connected",
      dataDir: "writable",
      revision: "0123456789abcdef0123456789abcdef01234567",
    })
    expect(response.headers.get("x-siab-service")).toBe("cms")
  })

  it("normalizes missing, empty, and whitespace-only revisions to unknown", () => {
    expect(normalizeBuildRevision(undefined)).toBe("unknown")
    expect(normalizeBuildRevision("")).toBe("unknown")
    expect(normalizeBuildRevision("   ")).toBe("unknown")
  })

  it("keeps liveness status tied to db and data directory checks only", async () => {
    payload.count.mockRejectedValue(new Error("db down"))
    vi.stubEnv("SIAB_BUILD_REVISION", "deadbeef")

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      status: "degraded",
      db: "down",
      dataDir: "writable",
      revision: "deadbeef",
    })
  })
})
