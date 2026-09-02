import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  AppointmentCalendarError,
  isAppointmentCalendarProvider,
  startCalendarAuthorization,
} from "@/lib/appointments/calendar"
import { AppointmentCalendarAdminError, requireAppointmentCalendarAdmin } from "@/lib/appointments/calendarAdmin"

const methodNotAllowed = () => new Response("Please start calendar authorisation with POST.", { status: 405, headers: { allow: "POST" } })

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider: providerValue } = await context.params
  if (!isAppointmentCalendarProvider(providerValue)) return new Response("Not found", { status: 404 })
  try {
    const payload = await getPayload({ config })
    const formData = await request.formData().catch(() => null)
    if (!formData) return new Response("Invalid request", { status: 400 })
    const admin = await requireAppointmentCalendarAdmin({
      payload,
      headers: request.headers,
      requestedTenantId: typeof formData.get("tenantId") === "string" ? String(formData.get("tenantId")) : null,
    })
    const result = await startCalendarAuthorization({
      payload,
      user: admin.user,
      tenantId: admin.tenantId,
      provider: providerValue,
      returnPath: typeof formData.get("returnPath") === "string" ? String(formData.get("returnPath")) : null,
      headers: request.headers,
    })
    const response = NextResponse.redirect(result.authorizationUrl, 303)
    response.headers.set("cache-control", "no-store")
    return response
  } catch (error) {
    if (error instanceof AppointmentCalendarAdminError || error instanceof AppointmentCalendarError) {
      return new Response(error.message, { status: error.statusCode, headers: { "cache-control": "no-store" } })
    }
    return new Response("Calendar authorisation is temporarily unavailable.", { status: 503, headers: { "cache-control": "no-store" } })
  }
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
