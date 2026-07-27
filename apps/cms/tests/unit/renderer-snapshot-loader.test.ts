import { afterEach, describe, expect, it, vi } from "vitest"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"
import { fixturePublishedSiteSnapshot } from "../../../renderer/src/fixtures/published-site"
import type { PublishedSiteSnapshot } from "@siteinabox/contracts/generation"
import { cast } from "../_helpers/cast"

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

  it("accepts canonical provider tenant snapshots from CMS responses", async () => {
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

  it("accepts an explicit alias allowlist and rejects a cross-tenant routing envelope", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_CMS_URL: "https://admin.snapshot.test",
    }
    const routedSnapshot = {
      ...fixturePublishedSiteSnapshot,
      tenantId: "42",
      tenantSlug: "snapshot-studio",
      domain: "snapshot.test",
      siteUrl: "https://snapshot.test",
      manifest: {
        ...fixturePublishedSiteSnapshot.manifest,
        tenantId: "42",
      },
      settings: {
        ...fixturePublishedSiteSnapshot.settings,
        siteUrl: "https://snapshot.test",
      },
    }
    const response = {
      routing: {
        version: 1,
        requestedHost: "www.snapshot.test",
        canonicalHost: "snapshot.test",
        activeHosts: ["snapshot.test", "www.snapshot.test"],
      },
      tenant: {
        id: 42,
        slug: "snapshot-studio",
        domain: "snapshot.test",
        status: "active",
      },
      snapshotId: 10,
      snapshot: routedSnapshot,
    }
    const fetch = vi.fn(async () => Response.json(response))
    vi.stubGlobal("fetch", fetch)
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await expect(loadPublishedSnapshot("www.snapshot.test")).resolves.toMatchObject({
      tenantId: "42",
      domain: "snapshot.test",
    })

    vi.mocked(fetch).mockResolvedValueOnce(Response.json({
      ...response,
      snapshot: {
        ...routedSnapshot,
        tenantId: "99",
        manifest: { ...routedSnapshot.manifest, tenantId: "99" },
      },
    }))
    await expect(loadPublishedSnapshot("www.snapshot.test")).rejects.toThrow(
      "CMS routing response failed contract validation",
    )
  })

  it("keeps the bounded legacy snapshot response readable during rolling deployment", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      SIAB_CMS_URL: "https://admin.snapshot.test",
    }
    const legacySnapshot = {
      ...amicarePublishedSiteSnapshot,
      settings: {
        ...amicarePublishedSiteSnapshot.settings,
        aliases: [{ host: "www.ami-care.nl" }],
      },
    }
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ snapshot: legacySnapshot })))
    const { loadPublishedSnapshot } = await importSnapshotLib()

    await expect(loadPublishedSnapshot("www.ami-care.nl")).resolves.toMatchObject({ domain: "ami-care.nl" })
    await expect(loadPublishedSnapshot("unlisted.example.com")).resolves.toBeNull()
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
    }

    expect(findPublishedPage(cast<PublishedSiteSnapshot>(snapshotWithDraft), "/draft-offer")).toBeNull()

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "development",
      SIAB_RENDERER_FIXTURE_MODE: "1",
      SIAB_CMS_URL: "",
    }
    await expect(listPublishedPaths("localhost")).resolves.toEqual(["/", "/services", "/about"])
  })
})
