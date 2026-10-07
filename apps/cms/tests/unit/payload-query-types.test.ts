import { describe, expect, expectTypeOf, it, vi } from "vitest"
import type { CollectionSlug, PaginatedDocs, Payload, RequiredDataFromCollectionSlug } from "payload"
import type { Media, Page } from "@/payload-types"
const mockedClient = vi.hoisted(() => ({ find: vi.fn<PayloadFindClient<"pages" | "site-settings">["find"]>() }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("payload", async () => ({
  ...await vi.importActual<typeof import("payload")>("payload"),
  getPayload: vi.fn(async () => mockedClient),
}))

import { getMediaUsage } from "@/lib/queries/mediaUsage"
import { createSiteSettingsData } from "@/lib/queries/siteSettingsDefaults"
import { DEFAULT_APPOINTMENT_SCHEDULE } from "@siteinabox/contracts"
import { findAllPaginated, normaliseFindResult, type PayloadFindArgs, type PayloadFindClient } from "@/lib/queries/paginate"

// Compiler assertions exercise actual generated contracts without suppressing errors.
describe("collection-aware Payload query types", () => {
  it("rejects the destructive media usage query when its complete reference walk cannot finish", async () => {
    mockedClient.find.mockReset()
    mockedClient.find.mockImplementation(async (args) => ({
      docs: [], totalDocs: 1001, totalPages: 1001, page: args.page ?? 1, limit: args.limit ?? 50,
      pagingCounter: 1, hasNextPage: args.collection === "pages", hasPrevPage: false,
    }))
    await expect(getMediaUsage(42)).rejects.toThrow("Pagination walk exhausted")
    const pageCalls = mockedClient.find.mock.calls.filter(([args]) => args.collection === "pages")
    expect(pageCalls).toHaveLength(1000)
    for (const [args] of pageCalls) expect(args.where).toEqual({ tenant: { equals: 42 } })
  })

  it("creates complete typed site settings while retaining disabled booking defaults", () => {
    expectTypeOf(createSiteSettingsData).returns.toEqualTypeOf<RequiredDataFromCollectionSlug<"site-settings">>()
    const data = createSiteSettingsData("42", "Fixture", "https://fixture.example")
    expect(data.tenant).toBe(42)
    expect(data.chrome).toEqual({ navbar: { variant: "navbar-01", placement: "sticky" }, footer: { variant: "footer-01" } })
    expect(data.consent).toEqual({ variant: "consent-01" })
    expect(data.appointments).toEqual(DEFAULT_APPOINTMENT_SCHEDULE)
  })

  it("accepts the installed Local API and derives pages from the collection slug", () => {
    expectTypeOf<Pick<Payload, "find">>().toExtend<PayloadFindClient<"pages">>()
    const pageQuery = (client: Pick<Payload, "find">) => findAllPaginated(client, { collection: "pages" })
    expectTypeOf(pageQuery).returns.toEqualTypeOf<Promise<Page[]>>()
  })

  it("rejects invented collection slugs and mismatched generated document results", () => {
    expectTypeOf<"invented-collection">().not.toExtend<CollectionSlug>()
    expectTypeOf<{ collection: "media" }>().not.toExtend<PayloadFindArgs<"pages">>()
    expectTypeOf<{ find: (args: PayloadFindArgs<"pages">) => Promise<PaginatedDocs<Media>> }>()
      .not.toExtend<PayloadFindClient<"pages">>()
  })

  it("normalises Payload's optional page field while retaining pagination metadata", () => {
    const result: PaginatedDocs<Page> = {
      docs: [], totalDocs: 0, totalPages: 1, limit: 50, pagingCounter: 1,
      hasNextPage: false, hasPrevPage: false,
    }
    expect(normaliseFindResult(result)).toEqual({ ...result, page: 1 })
  })
})
