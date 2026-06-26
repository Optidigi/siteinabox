import { promises as fs } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { projectPageToDisk } from "@/hooks/projectToDisk"

const tenantDir = (tenantId: number | string) =>
  path.join(process.env.DATA_DIR!, "tenants", String(tenantId))

const readJson = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"))

describe("projectPageToDisk", () => {
  beforeEach(async () => {
    await fs.rm(tenantDir(7), { recursive: true, force: true })
  })

  it("removes the old published slug projection when a published page is renamed", async () => {
    await fs.mkdir(path.join(tenantDir(7), "pages"), { recursive: true })
    await fs.writeFile(path.join(tenantDir(7), "pages", "old-home.json"), "{}")
    await fs.writeFile(
      path.join(tenantDir(7), "manifest.json"),
      JSON.stringify({
        tenantId: "7",
        version: 1,
        updatedAt: "2026-06-05T00:00:00.000Z",
        entries: [{ type: "page", key: "old-home", updatedAt: "2026-06-05T00:00:00.000Z" }],
      }),
    )

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({
        id: 7,
        slug: "amicare",
        domain: "ami-care.nl",
        siteManifest: { version: 1 },
      }),
      logger: { info: vi.fn() },
    }

    await projectPageToDisk({
      doc: {
        id: 10,
        tenant: 7,
        title: "Home",
        slug: "new-home",
        status: "published",
        blocks: [],
        updatedAt: "2026-06-05T12:00:00.000Z",
      },
      previousDoc: {
        id: 10,
        tenant: 7,
        title: "Home",
        slug: "old-home",
        status: "published",
        blocks: [],
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
      req: { payload },
    } as any)

    await expect(fs.access(path.join(tenantDir(7), "pages", "old-home.json"))).rejects.toThrow()
    await expect(fs.access(path.join(tenantDir(7), "pages", "new-home.json"))).resolves.toBeUndefined()

    const manifest = await readJson(path.join(tenantDir(7), "manifest.json"))
    expect(manifest.entries).toEqual([
      { type: "page", key: "new-home", updatedAt: "2026-06-05T12:00:00.000Z" },
    ])
  })

  it("does not project draft-import pages when skipProjection context is set", async () => {
    const payload = {
      find: vi.fn(),
      findByID: vi.fn(),
      logger: { info: vi.fn() },
    }

    await projectPageToDisk({
      doc: {
        id: 11,
        tenant: 7,
        title: "Imported",
        slug: "index",
        status: "published",
        blocks: [],
        updatedAt: "2026-06-05T12:00:00.000Z",
      },
      previousDoc: null,
      req: { payload, context: { skipProjection: true } },
    } as any)

    await expect(fs.access(path.join(tenantDir(7), "pages", "index.json"))).rejects.toThrow()
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
  })
})
