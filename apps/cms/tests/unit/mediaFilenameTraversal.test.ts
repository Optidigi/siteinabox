import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import type { File as PayloadFile } from "payload"
import { ValidationError } from "payload"
import { assertSafeMediaFilename, isSafeMediaFilename, resolveMediaPath } from "@/lib/mediaFilename"
import { ensureUniqueTenantFilename } from "@/hooks/ensureUniqueTenantFilename"
import { deleteMediaFile } from "@/hooks/deleteFileFromDisk"
import { projectMediaToDisk } from "@/hooks/projectToDisk"

import { cast } from "../_helpers/cast"
import { createTestPayload, createInitializedTestPayload, createTestRequest } from "../_helpers/testPayload"

vi.mock("@/lib/projection/manifest", () => ({
  readManifest: vi.fn(async () => ({ entries: [] })),
  writeManifest: vi.fn(async () => undefined),
  upsertEntry: vi.fn((manifest, entry) => ({ ...manifest, entries: [entry] })),
  removeEntry: vi.fn((manifest) => manifest),
  withManifestLock: vi.fn(async (_dataDir, _tenantId, fn) => fn()),
}))

let tmpDir: string

const unsafeFilenames = ["../manifest.json", "../../2/site.json", "nested/file.png", "nested\\file.png", "..", ""]

const reqWithLogger = async () => {
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload.logger, "info")
  vi.spyOn(payload.logger, "warn")
  return createTestRequest(payload)
}

const testFile = (data: string): PayloadFile => ({
  data: Buffer.from(data),
  name: "file.png",
  mimetype: "image/png",
  size: Buffer.byteLength(data),
})

const writeSentinels = async () => {
  await fs.mkdir(path.join(tmpDir, "tenants", "1", "media", "nested"), { recursive: true })
  await fs.mkdir(path.join(tmpDir, "tenants", "2"), { recursive: true })
  await fs.mkdir(path.join(tmpDir, "_uploads-tmp"), { recursive: true })
  await fs.writeFile(path.join(tmpDir, "tenants", "1", "manifest.json"), "tenant-1-manifest")
  await fs.writeFile(path.join(tmpDir, "tenants", "2", "site.json"), "tenant-2-site")
  await fs.writeFile(path.join(tmpDir, "tenants", "1", "media", "nested", "file.png"), "nested-media")
}

const expectSentinelsUntouched = async () => {
  await expect(fs.readFile(path.join(tmpDir, "tenants", "1", "manifest.json"), "utf8")).resolves.toBe(
    "tenant-1-manifest",
  )
  await expect(fs.readFile(path.join(tmpDir, "tenants", "2", "site.json"), "utf8")).resolves.toBe("tenant-2-site")
  await expect(fs.readFile(path.join(tmpDir, "tenants", "1", "media", "nested", "file.png"), "utf8")).resolves.toBe(
    "nested-media",
  )
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-traversal-"))
  process.env.DATA_DIR = tmpDir
})

afterEach(async () => {
  delete process.env.DATA_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe("media filename traversal guard", () => {
  it("rejects path separators, empty names, absolute paths, NUL bytes, and dot segments", () => {
    expect(isSafeMediaFilename("logo.png")).toBe(true)
    expect(resolveMediaPath(path.join(tmpDir, "tenants", "1", "media"), "logo.png")).toBe(
      path.join(tmpDir, "tenants", "1", "media", "logo.png"),
    )

    for (const filename of [...unsafeFilenames, "/tmp/file.png", "C:\\tmp\\file.png", "bad\0name.png"]) {
      expect(isSafeMediaFilename(filename)).toBe(false)
      expect(() => assertSafeMediaFilename(filename)).toThrow(ValidationError)
    }
  })

  it("blocks unsafe filenames before the per-tenant uniqueness query", async () => {
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find")

    await expect(
      ensureUniqueTenantFilename(cast<Parameters<typeof ensureUniqueTenantFilename>[0]>({
        data: { filename: "../manifest.json", tenant: 1 },
        operation: "create",
        req: await createTestRequest(payload),
      })),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(find).not.toHaveBeenCalled()
  })

  it.each(unsafeFilenames)("projectMediaToDisk skips unsafe filename %s without writing outside tenant media", async (filename) => {
    await writeSentinels()
    const req = await reqWithLogger()

    await projectMediaToDisk(cast<Parameters<typeof projectMediaToDisk>[0]>({
      doc: { id: 10, tenant: 1, filename, updatedAt: "2026-06-03T00:00:00.000Z" },
      operation: "update",
      req: {
        ...req,
        file: testFile("evil"),
      },
    }))

    await expectSentinelsUntouched()
    expect(req.payload.logger.warn).toHaveBeenCalledWith(
      { tenantId: "1", filename },
      "[projection] unsafe media filename skipped",
    )
  })

  it.each(unsafeFilenames)("deleteMediaFile skips unsafe filename %s without deleting outside tenant media", async (filename) => {
    await writeSentinels()
    const req = await reqWithLogger()

    await deleteMediaFile(cast<Parameters<typeof deleteMediaFile>[0]>({
      doc: { id: 10, tenant: 1, filename },
      req,
    }))

    await expectSentinelsUntouched()
    expect(req.payload.logger.warn).toHaveBeenCalledWith(
      { tenantId: "1", filename },
      "[projection] unsafe media filename skipped",
    )
  })

  it("still writes and deletes ordinary tenant media filenames", async () => {
    const req = await reqWithLogger()

    await projectMediaToDisk(cast<Parameters<typeof projectMediaToDisk>[0]>({
      doc: { id: 10, tenant: 1, filename: "logo.png", updatedAt: "2026-06-03T00:00:00.000Z" },
      operation: "create",
      req: {
        ...req,
        file: testFile("safe"),
      },
    }))

    const projectedFile = path.join(tmpDir, "tenants", "1", "media", "logo.png")
    await expect(fs.readFile(projectedFile, "utf8")).resolves.toBe("safe")

    await deleteMediaFile(cast<Parameters<typeof deleteMediaFile>[0]>({
      doc: { id: 10, tenant: 1, filename: "logo.png" },
      req,
    }))

    await expect(fs.access(projectedFile)).rejects.toMatchObject({ code: "ENOENT" })
  })
})
