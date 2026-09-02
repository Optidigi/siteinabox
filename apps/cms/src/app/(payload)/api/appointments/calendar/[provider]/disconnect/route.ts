import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { browserOriginMatchesAuthority } from "@/lib/requestAuthority"
import { AppointmentCalendarError, disconnectCalendarConnection, isAppointmentCalendarProvider, safeAppointmentReturnPath } from "@/lib/appointments/calendar"
import { AppointmentCalendarAdminError, requireAppointmentCalendarAdmin } from "@/lib/appointments/calendarAdmin"

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider: providerValue } = await context.params
  if (!isAppointmentCalendarProvider(providerValue)) return new Response("Not found", { status: 404 })
  if (!browserOriginMatchesAuthority(request.headers, { originRequired: true })) return new Response("Cross-origin request rejected.", { status: 403 })
  const formData = await request.formData().catch(() => null)
  if (!formData) return new Response("Invalid request", { status: 400 })
  try {
    const payload = await getPayload({ config })
    const admin = await requireAppointmentCalendarAdmin({
      payload,
      headers: request.headers,
      requestedTenantId: typeof formData.get("tenantId") === "string" ? String(formData.get("tenantId")) : null,
    })
    await disconnectCalendarConnection({ payload, tenantId: admin.tenantId, provider: providerValue })
    const authority = new URL(request.url).origin
    const response = NextResponse.redirect(new URL(`${safeAppointmentReturnPath(typeof formData.get("returnPath") === "string" ? String(formData.get("returnPath")) : null)}?calendar=disconnected&provider=${providerValue}`, authority), 303)
    response.headers.set("cache-control", "no-store")
    return response
  } catch (error) {
    if (error instanceof AppointmentCalendarAdminError || error instanceof AppointmentCalendarError) return new Response(error.message, { status: error.statusCode, headers: { "cache-control": "no-store" } })
    return new Response("Calendar disconnection is temporarily unavailable.", { status: 503 })
  }
}

export const GET = () => new Response("Please disconnect a calendar with POST.", { status: 405, headers: { allow: "POST" } })
