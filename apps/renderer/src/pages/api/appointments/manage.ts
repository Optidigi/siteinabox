import type { APIRoute } from "astro"
import {
  manageAppointmentRequest,
  parseAppointmentManagementResponse,
  readPublicAppointmentManagementBody,
  resolvePublicAppointmentSite,
} from "../../../lib/appointments"

const jsonResponse = (body: Record<string, unknown>, status: number): Response => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  },
})

export const POST: APIRoute = async ({ request }) => {
  const site = await resolvePublicAppointmentSite(request)
  if (!site) return jsonResponse({ ok: false, error: "site_not_found" }, 404)
  const management = await readPublicAppointmentManagementBody(request)
  if (!management) return jsonResponse({ ok: false, error: "invalid_request" }, 400)
  try {
    const upstream = await manageAppointmentRequest(request, site, management)
    const body: unknown = await upstream.json().catch(() => null)
    if (upstream.ok) {
      const parsed = parseAppointmentManagementResponse(body)
      return parsed.success
        ? jsonResponse(parsed.data, upstream.status)
        : jsonResponse({ ok: false, error: "unavailable" }, 502)
    }
    if (upstream.status === 404) return jsonResponse({ ok: false, error: "not_found" }, 404)
    if (upstream.status === 409) return jsonResponse({ ok: false, error: "conflict" }, 409)
    if (upstream.status === 400) return jsonResponse({ ok: false, error: "invalid_request" }, 400)
    return jsonResponse({ ok: false, error: "unavailable" }, 502)
  } catch {
    return jsonResponse({ ok: false, error: "unavailable" }, 502)
  }
}

const methodNotAllowed: APIRoute = () => jsonResponse({ ok: false, error: "method_not_allowed" }, 405)
export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
