import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  normalizeKvkProfileResponse,
  normalizeKvkSearchResponse,
  searchKvk,
  validateKvkNumber,
  validateKvkSearchQuery,
} from "@/lib/intake/kvk"
import { POST as POST_PROFILE } from "@/app/(payload)/api/intake/kvk/profile/route"
import { POST as POST_SEARCH } from "@/app/(payload)/api/intake/kvk/search/route"

import { errLike } from "../_helpers/cast"
const ORIGINAL_ENV = { ...process.env }
const ORIGINAL_FETCH = globalThis.fetch

const request = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })

describe("KVK intake helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    globalThis.fetch = ORIGINAL_FETCH
  })

  it("validates search queries and profile numbers", () => {
    expect(validateKvkSearchQuery(" a ")).toEqual({
      ok: false,
      error: "Vul minimaal 2 tekens in om te zoeken.",
    })
    expect(validateKvkSearchQuery("123")).toEqual({
      ok: false,
      error: "Een KVK-nummer bestaat uit 8 cijfers.",
    })
    expect(validateKvkSearchQuery(" 12345678 ")).toEqual({ ok: true, query: "12345678" })
    expect(validateKvkSearchQuery("Optidigi")).toEqual({ ok: true, query: "Optidigi" })
    expect(validateKvkNumber("1234567")).toEqual({
      ok: false,
      error: "Een KVK-nummer bestaat uit 8 cijfers.",
    })
    expect(validateKvkNumber(" 12345678 ")).toEqual({ ok: true, kvkNumber: "12345678" })
  })

  it("normalizes search responses to the intake-facing shape", () => {
    expect(normalizeKvkSearchResponse({
      totaal: 1,
      resultaten: [{
        kvkNummer: "12345678",
        vestigingsnummer: "000012345678",
        naam: "Optidigi B.V.",
        type: "Hoofdvestiging",
        adres: { binnenlandsAdres: { plaats: "Amsterdam" } },
      }],
    })).toEqual({
      total: 1,
      results: [{
        id: "000012345678",
        kvkNumber: "12345678",
        branchNumber: "000012345678",
        name: "Optidigi B.V.",
        city: "Amsterdam",
        type: "Hoofdvestiging",
      }],
    })
  })

  it("normalizes profile responses without inferring intake brief fields", () => {
    expect(normalizeKvkProfileResponse({
      kvkNummer: "12345678",
      naam: "Holding Naam",
      handelsnamen: [{ naam: "Fallback Trade" }],
      sbiActiviteiten: [{ sbiCode: "6201", sbiOmschrijving: "Ontwikkelen van software", indHoofdactiviteit: "Ja" }],
      _embedded: {
        hoofdvestiging: {
          vestigingsnummer: "000012345678",
          eersteHandelsnaam: "Optidigi",
          handelsnamen: [{ naam: "Optidigi" }, { naam: "Optidigi" }],
          adressen: [{
            type: "bezoekadres",
            straatnaam: "Damrak",
            huisnummer: 1,
            postcode: "1012 LG",
            plaats: "Amsterdam",
          }],
          websites: [" https://optidigi.nl ", { url: "https://optidigi.nl" }],
          sbiActiviteiten: [
            { sbiCode: "6201", sbiOmschrijving: " Maken van software ", indHoofdactiviteit: "Ja" },
            { sbiCode: "0000" },
          ],
        },
      },
    })).toEqual({
      kvkNumber: "12345678",
      branchNumber: "000012345678",
      name: "Optidigi",
      tradeNames: ["Optidigi"],
      addresses: [{
        type: "bezoekadres",
        value: "Damrak 1 1012 LG Amsterdam",
        city: "Amsterdam",
        shielded: false,
      }],
      websites: ["https://optidigi.nl"],
      activities: [{
        code: "6201",
        description: "Maken van software",
        isMain: true,
      }],
    })
  })

  it("returns graceful unavailable data when the API key is missing", async () => {
    delete process.env.KVK_API_KEY

    const result = await searchKvk("Optidigi")

    expect(result).toEqual({
      ok: false,
      status: 503,
      data: {
        unavailable: true,
        error: "KVK zoeken is tijdelijk niet beschikbaar.",
      },
    })
  })
})

describe("KVK intake routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    globalThis.fetch = ORIGINAL_FETCH
  })

  it("rejects malformed route payloads before calling KVK", async () => {
    process.env.KVK_API_KEY = "test-key"
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const search = await POST_SEARCH(request("https://cms.test/api/intake/kvk/search", { query: "1" }))
    const profile = await POST_PROFILE(request("https://cms.test/api/intake/kvk/profile", { kvkNumber: "123" }))

    expect(search.status).toBe(400)
    expect(await search.json()).toEqual({ error: "Een KVK-nummer bestaat uit 8 cijfers." })
    expect(profile.status).toBe(400)
    expect(await profile.json()).toEqual({ error: "Een KVK-nummer bestaat uit 8 cijfers." })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps credentials server-side and returns normalized search results", async () => {
    process.env.KVK_API_KEY = "server-only-key"
    process.env.KVK_SEARCH_BASE_URL = "https://kvk.test/search"
    const fetchMock = vi.fn(async () => Response.json({
      totaal: 1,
      resultaten: [{ kvkNummer: "12345678", naam: "Optidigi" }],
    }))
    globalThis.fetch = fetchMock

    const res = await POST_SEARCH(request("https://cms.test/api/intake/kvk/search", { query: "Optidigi" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      total: 1,
      results: [{
        id: "12345678",
        kvkNumber: "12345678",
        branchNumber: null,
        name: "Optidigi",
        city: null,
        type: null,
      }],
    })
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://kvk.test/search?naam=Optidigi&resultatenPerPagina=5"), {
      headers: { apikey: "server-only-key" },
    })
  })

  it("returns a graceful route response when the API key is missing", async () => {
    delete process.env.KVK_API_KEY

    const res = await POST_PROFILE(request("https://cms.test/api/intake/kvk/profile", { kvkNumber: "12345678" }))

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      unavailable: true,
      error: "Bedrijfsgegevens ophalen lukt nu niet.",
    })
  })
})
