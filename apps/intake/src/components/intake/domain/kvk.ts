import type {
  CompanyDetails,
  KvkCompanyProfile,
  KvkSearchResponse,
  KvkSearchResult,
  ManualCompanyDetails,
} from "./types";

export function getSearchError(query: string) {
  const value = query.trim();
  const digitsOnly = /^\d+$/.test(value);

  if (!value) return "";
  if (digitsOnly && value.length > 8)
    return "Een KVK-nummer bestaat uit 8 cijfers.";
  if (!digitsOnly && value.length < 2)
    return "Vul minimaal 2 tekens in om te zoeken.";

  return "";
}

export function canSearchKvk(query: string) {
  const value = query.trim();
  const digitsOnly = /^\d+$/.test(value);

  if (!value) return false;
  if (digitsOnly) return value.length === 8;

  return value.length >= 2;
}

export function getRegionFromCompany(
  company: KvkSearchResult | null,
  manualDetails: ManualCompanyDetails,
) {
  if (company?.city) return `${company.city} en omgeving`;

  return getRegionFromAddress(manualDetails.address);
}

export function getRegionFromCompanyDetails(company: CompanyDetails) {
  return getRegionFromAddress(company.address);
}

export function getRegionFromAddress(value: string) {
  const address = value.trim();
  if (!address) return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const lastPart = parts.at(-1) ?? "";
  const withoutPostcode = lastPart
    .replace(/\b\d{4}\s?[A-Z]{2}\b/gi, "")
    .trim();
  const withoutSuffix = withoutPostcode
    .replace(/\s+en\s+omgeving$/i, "")
    .trim();
  const words = withoutSuffix.split(/\s+/).filter(Boolean);
  const city = words.length > 1 ? (words.at(-1) ?? "") : withoutSuffix;

  return city ? `${city} en omgeving` : "";
}

export async function searchKvk(
  query: string,
  signal: AbortSignal,
): Promise<KvkSearchResponse> {
  const endpoint =
    import.meta.env.PUBLIC_KVK_SEARCH_ENDPOINT ?? "/api/intake/kvk/search";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "KVK zoeken is tijdelijk niet beschikbaar.");
  }

  return response.json();
}

export async function getKvkProfile(
  kvkNumber: string,
  signal: AbortSignal,
): Promise<KvkCompanyProfile> {
  const endpoint =
    import.meta.env.PUBLIC_KVK_PROFILE_ENDPOINT ?? "/api/intake/kvk/profile";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ kvkNumber }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Bedrijfsgegevens ophalen lukt nu niet.");
  }

  return response.json();
}
