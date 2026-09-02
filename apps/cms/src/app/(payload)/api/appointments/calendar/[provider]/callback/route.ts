import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  AppointmentCalendarError,
  assertCalendarCallbackRequest,
  completeCalendarAuthorization,
  getCalendarOAuthReturnPath,
  isAppointmentCalendarProvider,
} from "@/lib/appointments/calendar"

const redirectResult = (origin: string, returnPath: string, status: string, provider: string): NextResponse => {
  const url = new URL(returnPath, origin)
  url.searchParams.set("calendar", status)
  url.searchParams.set("provider", provider)
  const response = NextResponse.redirect(url, 303)
  response.headers.set("cache-control", "no-store")
  return response
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider: providerValue } = await context.params
  if (!isAppointmentCalendarProvider(providerValue)) return new Response("Not found", { status: 404 })
  const url = new URL(request.url)
  let authority: string
  try {
    authority = assertCalendarCallbackRequest(request.headers, providerValue).origin
  } catch (error) {
    if (error instanceof AppointmentCalendarError) return new Response(error.message, { status: error.statusCode })
    return new Response("Invalid calendar callback authority.", { status: 403 })
  }
  const payload = await getPayload({ config })
  const state = url.searchParams.get("state")?.trim() ?? ""
  const returnPath = await getCalendarOAuthReturnPath(payload, state, providerValue).catch(() => "/appointments")
  if (url.searchParams.has("error") || !url.searchParams.get("code")) {
    return redirectResult(authority, returnPath, "error", providerValue)
  }
  try {
    const result = await completeCalendarAuthorization({
      payload,
      provider: providerValue,
      state,
      code: url.searchParams.get("code") ?? "",
      headers: request.headers,
    })
    return redirectResult(authority, result.returnPath, "connected", result.provider)
  } catch (error) {
    if (error instanceof AppointmentCalendarError && error.statusCode === 403) return new Response(error.message, { status: 403 })
    return redirectResult(authority, returnPath, "error", providerValue)
  }
}
