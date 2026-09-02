import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { AppointmentManagementRequestSchema } from "@siteinabox/contracts"
import {
  AppointmentConflictError,
  AppointmentInputError,
  AppointmentManagementNotFoundError,
  AppointmentUnavailableError,
  manageAppointment,
} from "@/lib/appointments/service"

const MAX_BODY_BYTES = 16 * 1024
const responseHeaders = { "cache-control": "no-store" }

const authorized = (request: NextRequest): boolean => {
  const expected = process.env.SIAB_RENDERER_API_TOKEN
  if (!expected) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${expected}`
}

const tenantIdFromRequest = (request: NextRequest): number | null => {
  const value = request.nextUrl.searchParams.get("tenantId")?.trim() ?? ""
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: responseHeaders })
  const tenantId = tenantIdFromRequest(request)
  if (tenantId == null) return NextResponse.json({ message: "tenantId is required" }, { status: 400, headers: responseHeaders })
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return NextResponse.json({ message: "The appointment request is too large." }, { status: 413, headers: responseHeaders })
  let body: unknown
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return NextResponse.json({ message: "The appointment request is too large." }, { status: 413, headers: responseHeaders })
    body = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ message: "The appointment request could not be read." }, { status: 400, headers: responseHeaders })
  }
  const parsed = AppointmentManagementRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "The appointment management request is invalid." }, { status: 400, headers: responseHeaders })
  try {
    const payload = await getPayload({ config })
    const response = await manageAppointment({ payload, tenantId, request: parsed.data })
    return NextResponse.json(response, { status: 200, headers: responseHeaders })
  } catch (error) {
    if (error instanceof AppointmentManagementNotFoundError) return NextResponse.json({ message: error.message }, { status: 404, headers: responseHeaders })
    if (error instanceof AppointmentConflictError) return NextResponse.json({ message: error.message }, { status: 409, headers: responseHeaders })
    if (error instanceof AppointmentInputError) return NextResponse.json({ message: error.message }, { status: 400, headers: responseHeaders })
    if (error instanceof AppointmentUnavailableError) return NextResponse.json({ message: "Appointment management is temporarily unavailable." }, { status: 503, headers: responseHeaders })
    console.error("Appointment management failed", error)
    return NextResponse.json({ message: "Appointment management is temporarily unavailable." }, { status: 500, headers: responseHeaders })
  }
}

const methodNotAllowed = () => NextResponse.json({ message: "Please manage an appointment with POST." }, { status: 405, headers: { ...responseHeaders, allow: "POST" } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
