import type { APIRoute } from "astro"
import { AppointmentAvailabilityQuerySchema } from "@siteinabox/contracts"
import {
  fetchAppointmentAvailability,
  parseAppointmentAvailabilityResponse,
  resolvePublicAppointmentSite,
} from "../../../lib/appointments"

const jsonResponse = (body: Record<string, unknown>, status: number, headers?: HeadersInit): Response => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...headers,
  },
})

export const GET: APIRoute = async ({ request }) => {
  const site = await resolvePublicAppointmentSite(request)
  if (!site) return jsonResponse({ ok: false, error: "site_not_found" }, 404)
  const url = new URL(request.url)
  const parsedQuery = AppointmentAvailabilityQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  })
  if (!parsedQuery.success) return jsonResponse({ ok: false, error: "invalid_range" }, 400)

  try {
    const response = await fetchAppointmentAvailability(request, site, parsedQuery.data)
    if (!response.ok) {
      if (response.status === 400) return jsonResponse({ ok: false, error: "invalid_range" }, 400)
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after")
        return jsonResponse(
          { ok: false, error: "too_many_requests" },
          429,
          retryAfter ? { "retry-after": retryAfter } : undefined,
        )
      }
      if (response.status === 503) return jsonResponse({ ok: false, error: "unavailable" }, 503)
      return jsonResponse({ ok: false, error: "unavailable" }, 502)
    }
    const body: unknown = await response.json()
    const parsed = parseAppointmentAvailabilityResponse(body)
    if (!parsed.success) return jsonResponse({ ok: false, error: "unavailable" }, 502)
    return jsonResponse(parsed.data, 200)
  } catch {
    return jsonResponse({ ok: false, error: "unavailable" }, 502)
  }
}

const methodNotAllowed: APIRoute = () => jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" })
export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
