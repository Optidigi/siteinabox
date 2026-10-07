import { describe, expect, it, vi } from "vitest"
import { fetchTenantMedia, resolveMediaTenantId } from "@/components/media/clientMedia"

const jsonResponse = (body: unknown, ok = true): Response =>
  Response.json(body, { status: ok ? 200 : 500 })

describe("client media helpers", () => {
  it("resolves a tenant member's populated tenant id", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ user: { role: "owner", tenants: [{ tenant: { id: 42 } }] } }),
    )

    await expect(resolveMediaTenantId({ fetcher })).resolves.toBe(42)
  })

  it("resolves a tenant member's raw tenant id", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ user: { role: "editor", tenants: [{ tenant: "tenant-a" }] } }),
    )

    await expect(resolveMediaTenantId({ fetcher })).resolves.toBe("tenant-a")
  })

  it("resolves a selected-site super-admin tenant from the current pathname", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user: { role: "super-admin", tenants: [] } }))
      .mockResolvedValueOnce(jsonResponse({ docs: [{ id: "site-123" }] }))

    await expect(
      resolveMediaTenantId({ fetcher, pathname: "/sites/demo-site/pages/9" }),
    ).resolves.toBe("site-123")
    expect(fetcher).toHaveBeenLastCalledWith("/api/tenants?where[slug][equals]=demo-site&limit=1")
  })

  it("does not guess a super-admin tenant outside a selected-site route", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ user: { role: "super-admin", tenants: [] } }),
    )

    await expect(resolveMediaTenantId({ fetcher, pathname: "/media" })).resolves.toBeNull()
  })

  it("fetches tenant media with an encoded tenant filter", async () => {
    const docs = [{ id: 1, filename: "hero.jpg" }]
    const fetcher = vi.fn(async () => jsonResponse({ docs }))

    await expect(fetchTenantMedia("tenant 1", fetcher)).resolves.toEqual(docs)
    expect(fetcher).toHaveBeenCalledWith(
      "/api/media?where[tenant][equals]=tenant%201&limit=200&sort=-updatedAt",
    )
  })

  it("returns an empty list when media loading fails", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, false))

    await expect(fetchTenantMedia(7, fetcher)).resolves.toEqual([])
  })
})

describe("malformed media boundary responses", () => {
  it("fails closed for a non-array media list", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ docs: "unsafe" }))
    await expect(fetchTenantMedia(7, fetcher)).resolves.toEqual([])
  })
  it("does not resolve a malformed populated tenant identity", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ user: { role: "owner", tenants: [{ tenant: { id: {} } }] } }))
    await expect(resolveMediaTenantId({ fetcher })).resolves.toBeNull()
  })
})
