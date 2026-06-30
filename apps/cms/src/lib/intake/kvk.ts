import { z } from "zod"

const DEFAULT_KVK_SEARCH_BASE_URL = "https://api.kvk.nl/api/v2/zoeken"
const DEFAULT_KVK_PROFILE_BASE_URL = "https://api.kvk.nl/api/v1/basisprofielen"
const KVK_SEARCH_PATH = "/api/v2/zoeken"
const KVK_PROFILE_PATH = "/api/v1/basisprofielen"
const RESULTS_PER_PAGE = "5"

export type KvkSearchResponse = {
  total: number
  results: KvkSearchResult[]
}

export type KvkSearchResult = {
  id: string
  kvkNumber: string
  branchNumber: string | null
  name: string
  city: string | null
  type: string | null
}

export type KvkCompanyProfile = {
  kvkNumber: string
  branchNumber: string | null
  name: string
  tradeNames: string[]
  addresses: KvkCompanyAddress[]
  websites: string[]
  activities: KvkCompanyActivity[]
}

export type KvkCompanyAddress = {
  type: string | null
  value: string | null
  city: string | null
  shielded: boolean
}

export type KvkCompanyActivity = {
  code: string | null
  description: string
  isMain: boolean
}

type KvkUnavailable = {
  unavailable: true
  error: string
}

type KvkServiceResult<T> =
  | { ok: true; status: 200; data: T }
  | { ok: false; status: 400 | 502 | 503; data: { error: string } | KvkUnavailable }

const kvkSearchResultSchema = z.object({
  kvkNummer: z.string(),
  vestigingsnummer: z.string().optional(),
  naam: z.string(),
  type: z.string().optional(),
  adres: z
    .object({
      binnenlandsAdres: z
        .object({
          plaats: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

const kvkSearchResponseSchema = z.object({
  totaal: z.number().catch(0),
  resultaten: z.array(kvkSearchResultSchema).catch([]),
})

const kvkErrorResponseSchema = z.object({
  fout: z
    .array(z.object({
      code: z.string().optional(),
      omschrijving: z.string().optional(),
    }))
    .optional(),
})

const addressSchema = z.object({
  type: z.string().optional(),
  indAfgeschermd: z.string().optional(),
  volledigAdres: z.string().optional(),
  straatnaam: z.string().optional(),
  huisnummer: z.number().optional(),
  huisletter: z.string().optional(),
  huisnummerToevoeging: z.string().optional(),
  postcode: z.string().optional(),
  plaats: z.string().optional(),
  land: z.string().optional(),
}).passthrough()

const websiteSchema = z.union([
  z.string(),
  z.object({ url: z.string().optional() }).passthrough(),
])

const sbiActivitySchema = z.object({
  sbiCode: z.string().optional(),
  sbiOmschrijving: z.string().optional(),
  indHoofdactiviteit: z.string().optional(),
}).passthrough()

const tradeNameSchema = z.object({
  naam: z.string().optional(),
  volgorde: z.number().optional(),
}).passthrough()

const locationProfileSchema = z.object({
  vestigingsnummer: z.string().optional(),
  eersteHandelsnaam: z.string().optional(),
  handelsnamen: z.array(tradeNameSchema).nullish(),
  adressen: z.array(addressSchema).nullish(),
  websites: z.array(websiteSchema).nullish(),
  sbiActiviteiten: z.array(sbiActivitySchema).nullish(),
}).passthrough().nullish()

const ownerProfileSchema = z.object({
  adressen: z.array(addressSchema).nullish(),
  websites: z.array(websiteSchema).nullish(),
}).passthrough().nullish()

const kvkProfileResponseSchema = z.object({
  kvkNummer: z.string(),
  naam: z.string().optional(),
  handelsnamen: z.array(tradeNameSchema).nullish(),
  sbiActiviteiten: z.array(sbiActivitySchema).nullish(),
  _embedded: z.object({
    hoofdvestiging: locationProfileSchema,
    eigenaar: ownerProfileSchema,
  }).passthrough().optional(),
}).passthrough()

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null
}

function normalizeWebsite(website: z.infer<typeof websiteSchema>) {
  return typeof website === "string" ? cleanText(website) : cleanText(website.url)
}

function normalizeAddress(address: z.infer<typeof addressSchema>): KvkCompanyAddress {
  const shielded = address.indAfgeschermd?.toLowerCase() === "ja"

  return {
    type: cleanText(address.type),
    value: shielded
      ? null
      : cleanText(address.volledigAdres)
        ?? cleanText([
          address.straatnaam,
          [
            address.huisnummer,
            address.huisletter,
            address.huisnummerToevoeging,
          ].filter(Boolean).join(""),
          address.postcode,
          address.plaats,
        ].filter(Boolean).join(" ")),
    city: cleanText(address.plaats),
    shielded,
  }
}

function normalizeActivity(activity: z.infer<typeof sbiActivitySchema>) {
  const description = cleanText(activity.sbiOmschrijving)

  if (!description) return null

  return {
    code: cleanText(activity.sbiCode),
    description,
    isMain: activity.indHoofdactiviteit?.toLowerCase() === "ja",
  }
}

function unavailable(message: string): KvkServiceResult<never> {
  return {
    ok: false,
    status: 503,
    data: { unavailable: true, error: message },
  }
}

function getKvkApiKey() {
  return process.env.KVK_API_KEY?.trim() ?? ""
}

function getSearchBaseUrl() {
  const searchBaseUrl = process.env.KVK_SEARCH_BASE_URL?.trim()
  if (searchBaseUrl) return searchBaseUrl

  const apiBaseUrl = process.env.KVK_API_BASE_URL?.trim()
  if (apiBaseUrl) return `${apiBaseUrl.replace(/\/+$/, "")}${KVK_SEARCH_PATH}`

  return DEFAULT_KVK_SEARCH_BASE_URL
}

function getProfileBaseUrl() {
  const profileBaseUrl = process.env.KVK_PROFILE_BASE_URL?.trim()
  if (profileBaseUrl) return profileBaseUrl

  const apiBaseUrl = process.env.KVK_API_BASE_URL?.trim()
  if (apiBaseUrl) return `${apiBaseUrl.replace(/\/+$/, "")}${KVK_PROFILE_PATH}`

  return DEFAULT_KVK_PROFILE_BASE_URL
}

export function validateKvkSearchQuery(query: unknown): { ok: true; query: string } | { ok: false; error: string } {
  const value = typeof query === "string" ? query.trim() : ""
  const digitsOnly = /^\d+$/.test(value)

  if (!value) return { ok: false, error: "Vul minimaal 2 tekens in om te zoeken." }
  if (digitsOnly && value.length !== 8) return { ok: false, error: "Een KVK-nummer bestaat uit 8 cijfers." }
  if (!digitsOnly && value.length < 2) return { ok: false, error: "Vul minimaal 2 tekens in om te zoeken." }

  return { ok: true, query: value }
}

export function validateKvkNumber(kvkNumber: unknown): { ok: true; kvkNumber: string } | { ok: false; error: string } {
  const value = typeof kvkNumber === "string" ? kvkNumber.trim() : ""

  if (!/^\d{8}$/.test(value)) return { ok: false, error: "Een KVK-nummer bestaat uit 8 cijfers." }

  return { ok: true, kvkNumber: value }
}

export function normalizeKvkSearchResponse(responseBody: unknown): KvkSearchResponse {
  const data = kvkSearchResponseSchema.parse(responseBody)

  return {
    total: data.totaal,
    results: data.resultaten.map((result) => ({
      id: result.vestigingsnummer ?? result.kvkNummer,
      kvkNumber: result.kvkNummer,
      branchNumber: result.vestigingsnummer ?? null,
      name: result.naam,
      city: result.adres?.binnenlandsAdres?.plaats ?? null,
      type: result.type ?? null,
    })),
  }
}

export function normalizeKvkProfileResponse(responseBody: unknown): KvkCompanyProfile {
  const data = kvkProfileResponseSchema.parse(responseBody)
  const mainLocation = data._embedded?.hoofdvestiging
  const owner = data._embedded?.eigenaar
  const addresses = (mainLocation?.adressen?.length ? mainLocation.adressen : owner?.adressen ?? [])
    .map(normalizeAddress)
  const websites = (mainLocation?.websites?.length ? mainLocation.websites : owner?.websites ?? [])
    .map(normalizeWebsite)
    .filter((website): website is string => Boolean(website))
  const activities = (mainLocation?.sbiActiviteiten?.length ? mainLocation.sbiActiviteiten : data.sbiActiviteiten ?? [])
    .map(normalizeActivity)
    .filter((activity): activity is NonNullable<ReturnType<typeof normalizeActivity>> => Boolean(activity))
  const tradeNames = (mainLocation?.handelsnamen?.length ? mainLocation.handelsnamen : data.handelsnamen ?? [])
    .map((tradeName) => cleanText(tradeName.naam))
    .filter((tradeName): tradeName is string => Boolean(tradeName))

  return {
    kvkNumber: data.kvkNummer,
    branchNumber: mainLocation?.vestigingsnummer ?? null,
    name: cleanText(mainLocation?.eersteHandelsnaam) ?? cleanText(data.naam) ?? "Onbekend bedrijf",
    tradeNames: Array.from(new Set(tradeNames)),
    addresses,
    websites: Array.from(new Set(websites)),
    activities,
  }
}

export async function searchKvk(query: string): Promise<KvkServiceResult<KvkSearchResponse>> {
  const apiKey = getKvkApiKey()
  if (!apiKey) return unavailable("KVK zoeken is tijdelijk niet beschikbaar.")

  const kvkUrl = new URL(getSearchBaseUrl())
  const digitsOnly = /^\d+$/.test(query)
  kvkUrl.searchParams.set(digitsOnly ? "kvkNummer" : "naam", query)
  kvkUrl.searchParams.set("resultatenPerPagina", RESULTS_PER_PAGE)

  const response = await fetch(kvkUrl, {
    headers: {
      apikey: apiKey,
    },
  })
  const responseBody = await response.json().catch(() => null)

  if (!response.ok) {
    const errorData = kvkErrorResponseSchema.safeParse(responseBody)
    const isNoResults = errorData.success
      && errorData.data.fout?.some((error) => error.code === "IPD5200")

    if (response.status === 404 && isNoResults) {
      return { ok: true, status: 200, data: { total: 0, results: [] } }
    }

    return { ok: false, status: 502, data: { error: "KVK zoeken is tijdelijk niet beschikbaar." } }
  }

  return { ok: true, status: 200, data: normalizeKvkSearchResponse(responseBody) }
}

export async function getKvkProfile(kvkNumber: string): Promise<KvkServiceResult<KvkCompanyProfile>> {
  const apiKey = getKvkApiKey()
  if (!apiKey) return unavailable("Bedrijfsgegevens ophalen lukt nu niet.")

  const profileBaseUrl = getProfileBaseUrl().replace(/\/+$/, "")
  const response = await fetch(`${profileBaseUrl}/${kvkNumber}`, {
    headers: {
      apikey: apiKey,
    },
  })
  const responseBody = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false, status: 502, data: { error: "Bedrijfsgegevens ophalen lukt nu niet." } }
  }

  return { ok: true, status: 200, data: normalizeKvkProfileResponse(responseBody) }
}
