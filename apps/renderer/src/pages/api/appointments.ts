import type { APIRoute } from "astro"
import {
  parseAppointmentBookingResponse,
  readPublicAppointmentBody,
  resolvePublicAppointmentSite,
  submitAppointmentBooking,
} from "../../lib/appointments"

const jsonResponse = (body: Record<string, unknown>, status: number, headers?: HeadersInit): Response => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...headers,
  },
})

export const POST: APIRoute = async ({ request }) => {
  const site = await resolvePublicAppointmentSite(request)
  if (!site) return jsonResponse({ ok: false, error: "site_not_found" }, 404)
  const booking = await readPublicAppointmentBody(request)
  if (!booking) return jsonResponse({ ok: false, error: "invalid_request" }, 400)

  try {
    const response = await submitAppointmentBooking(request, site, booking)
    if (response.status === 409) return jsonResponse({ ok: false, error: "slot_unavailable" }, 409)
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after")
      return jsonResponse(
        { ok: false, error: "too_many_requests" },
        429,
        retryAfter ? { "retry-after": retryAfter } : undefined,
      )
    }
    if (response.status === 400) return jsonResponse({ ok: false, error: "invalid_request" }, 400)
    if (response.status === 413) return jsonResponse({ ok: false, error: "payload_too_large" }, 413)
    if (response.status === 503) return jsonResponse({ ok: false, error: "unavailable" }, 503)
    if (!response.ok) return jsonResponse({ ok: false, error: "unavailable" }, 502)
    const body: unknown = await response.json()
    const parsed = parseAppointmentBookingResponse(body)
    if (!parsed.success) return jsonResponse({ ok: false, error: "unavailable" }, 502)
    return jsonResponse(parsed.data, 201)
  } catch {
    return jsonResponse({ ok: false, error: "unavailable" }, 502)
  }
}

const methodNotAllowed: APIRoute = () => jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" })
export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
