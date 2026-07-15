import { afterEach, describe, expect, it, vi } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { fixturePublishedSiteSnapshot } from "../../../renderer/src/fixtures/published-site"

const ORIGINAL_ENV = { ...process.env }

async function importSnapshotLib() {
  return import("../../../renderer/src/lib/snapshot")
}

describe("renderer snapshot loader environment gates", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  it("does not allow fixture mode in production", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_RENDERER_FIXTURE_MODE: "1",
      SIAB_CMS_URL: "",
    }
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await expect(loadPublishedSnapshot("renderer.example.test")).rejects.toThrow("SIAB_CMS_URL is required")
  })

  it("allows fixture mode outside production", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "development",
      SIAB_RENDERER_FIXTURE_MODE: "1",
      SIAB_CMS_URL: "",
    }
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await expect(loadPublishedSnapshot("localhost")).resolves.toMatchObject({
      tenantSlug: "fixture-studio",
    })
  })

  it("sends the renderer bearer token when configured", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_CMS_URL: "https://admin.snapshot.test",
      SIAB_RENDERER_API_TOKEN: "loader-secret",
    }
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ snapshot: null }),
    }))
    vi.stubGlobal("fetch", fetch)
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await loadPublishedSnapshot("www.snapshot.test")

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://admin.snapshot.test/api/renderer/snapshot?host=www.snapshot.test",
      }),
      expect.objectContaining({
        headers: { authorization: "Bearer loader-secret" },
        cache: "no-store",
      }),
    )
  })

  it("resolves root, subpage, and unknown paths from validated snapshots", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_CMS_URL: "https://admin.snapshot.test",
    }
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        snapshot: fixturePublishedSiteSnapshot,
      }),
    }))
    vi.stubGlobal("fetch", fetch)
    const { listPublishedPaths, resolvePublishedPage } = await importSnapshotLib()

    await expect(resolvePublishedPage("/", "renderer.example.test")).resolves.toMatchObject({
      page: { slug: "index", title: "Home" },
      pathname: "/",
    })
    await expect(resolvePublishedPage("/services", "renderer.example.test")).resolves.toMatchObject({
      page: { slug: "services", title: "Services" },
      pathname: "/services",
    })
    await expect(resolvePublishedPage("/missing", "renderer.example.test")).resolves.toBeNull()
    await expect(listPublishedPaths("renderer.example.test")).resolves.toEqual(["/", "/services", "/about"])
  })

  it("accepts official tenant snapshots from CMS responses", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_CMS_URL: "https://admin.snapshot.test",
    }
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        snapshot: amicarePublishedSiteSnapshot,
      }),
    }))
    vi.stubGlobal("fetch", fetch)
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await expect(loadPublishedSnapshot("ami-care.nl")).resolves.toMatchObject({
      tenantSlug: "amicare",
      domain: "ami-care.nl",
    })
  })

  it("excludes draft-like pages from renderer page lookup defensively", async () => {
    const { findPublishedPage, listPublishedPaths } = await importSnapshotLib()
    const snapshotWithDraft = {
      ...fixturePublishedSiteSnapshot,
      pages: [
        ...fixturePublishedSiteSnapshot.pages,
        {
          ...fixturePublishedSiteSnapshot.pages[0]!,
          id: "draft-offer",
          slug: "draft-offer",
          title: "Draft Offer",
          status: "draft",
        },
      ],
    } as any

    expect(findPublishedPage(snapshotWithDraft, "/draft-offer")).toBeNull()

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "development",
      SIAB_RENDERER_FIXTURE_MODE: "1",
      SIAB_CMS_URL: "",
    }
    await expect(listPublishedPaths("localhost")).resolves.toEqual(["/", "/services", "/about"])
  })
})
