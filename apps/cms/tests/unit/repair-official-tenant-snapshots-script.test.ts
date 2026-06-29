import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import {
  parseArgs,
  themeHash,
  verifyThemeParity,
} from "../../scripts/repair-official-tenant-snapshots"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const scriptPath = path.resolve(__dirname, "../../scripts/repair-official-tenant-snapshots.ts")

describe("official tenant snapshot repair script", () => {
  it("defaults to dry-run for the active official tenant", () => {
    expect(parseArgs([])).toEqual({
      apply: false,
      tenants: ["amicare"],
    })
  })

  it("requires an explicit apply flag before mutation mode", () => {
    expect(parseArgs(["--apply"])).toMatchObject({ apply: true })
    expect(parseArgs(["--", "--apply"])).toMatchObject({ apply: true })
    expect(parseArgs(["--dry-run"])).toMatchObject({ apply: false })
  })

  it("targets only the Amicare official tenant", () => {
    expect(parseArgs(["--tenant=ami-care"])).toMatchObject({ tenants: ["amicare"] })
    expect(parseArgs(["--tenant=amicare"])).toMatchObject({ tenants: ["amicare"] })
    expect(() => parseArgs(["--tenant=customer"])).toThrow(/Unsupported --tenant/)
    expect(() => parseArgs(["--tenant=customer"])).toThrow(/Unsupported --tenant/)
  })

  it("compares active snapshot, projected theme, and renderer route theme", async () => {
    const activeTheme = { colors: { accent: "#2563eb" } }
    const payload = {
      findByID: vi.fn(async () => ({
        id: 10,
        status: "active",
        snapshot: { theme: activeTheme },
      })),
    }
    const helpers = {
      resolvePublishedSnapshotByHost: vi.fn(async () => ({
        snapshotId: 10,
        snapshot: { theme: activeTheme },
      })),
    }

    const result = await verifyThemeParity(
      payload as any,
      helpers as any,
      { id: 1, domain: "ami-care.nl", activeSnapshot: 10 },
      { colors: { accent: "#2563eb" } },
    )

    expect(result).toMatchObject({
      activeSnapshotId: 10,
      rendererSnapshotId: 10,
      activeEqualsProjected: true,
      rendererEqualsActive: true,
      rendererEqualsProjected: true,
      activeThemeHash: themeHash(activeTheme),
      rendererThemeHash: themeHash(activeTheme),
      projectedThemeHash: themeHash(activeTheme),
    })
  })

  it("uses publishSiteSnapshot and does not directly mutate published snapshots", () => {
    const source = fs.readFileSync(scriptPath, "utf8")

    expect(source).toContain("publishSiteSnapshot(payload")
    expect(source).not.toMatch(/payload\.create\(\{\s*collection:\s*["']published-site-snapshots/s)
    expect(source).not.toMatch(/payload\.update\(\{\s*collection:\s*["']published-site-snapshots/s)
  })
})
