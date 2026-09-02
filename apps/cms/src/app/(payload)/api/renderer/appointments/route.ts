import { NextResponse, type NextRequest } from "next/server"
import { AppointmentBookingInputSchema, AppointmentBookingResponseSchema } from "@siteinabox/contracts"
import config from "@/payload.config"
import { getPayload } from "payload"
import { AppointmentConflictError, AppointmentInputError, AppointmentUnavailableError, bookAppointment } from "@/lib/appointments/service"

const MAX_APPOINTMENT_BODY_BYTES = 16 * 1024

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SIAB_RENDERER_API_TOKEN
  if (!expected) return process.env.NODE_ENV !== "production"
  return req.headers.get("authorization") === `Bearer ${expected}`
}

const tenantIdFromRequest = (req: NextRequest): number | null => {
  const value = req.nextUrl.searchParams.get("tenantId")?.trim() ?? ""
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const responseHeaders = { "cache-control": "no-store" }

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: responseHeaders })
  const tenantId = tenantIdFromRequest(req)
  if (tenantId == null) return NextResponse.json({ message: "tenantId is required" }, { status: 400, headers: responseHeaders })
  const declaredLength = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_APPOINTMENT_BODY_BYTES) {
    return NextResponse.json({ message: "The appointment request is too large." }, { status: 413, headers: responseHeaders })
  }

  let body: unknown
  try {
    const text = await req.text()
    if (new TextEncoder().encode(text).byteLength > MAX_APPOINTMENT_BODY_BYTES) {
      return NextResponse.json({ message: "The appointment request is too large." }, { status: 413, headers: responseHeaders })
    }
    body = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ message: "The appointment request could not be read." }, { status: 400, headers: responseHeaders })
  }

  const parsed = AppointmentBookingInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "The appointment details are invalid." }, { status: 400, headers: responseHeaders })

  try {
    const payload = await getPayload({ config })
    const booking = await bookAppointment({ payload, tenantId, booking: parsed.data })
    const response = AppointmentBookingResponseSchema.parse(booking)
    return NextResponse.json(response, { status: 201, headers: responseHeaders })
  } catch (error) {
    if (error instanceof AppointmentConflictError) return NextResponse.json({ message: error.message }, { status: 409, headers: responseHeaders })
    if (error instanceof AppointmentInputError) return NextResponse.json({ message: error.message }, { status: 400, headers: responseHeaders })
    if (error instanceof AppointmentUnavailableError) return NextResponse.json({ message: "Appointment booking is temporarily unavailable." }, { status: 503, headers: responseHeaders })
    console.error("Appointment booking failed", error)
    return NextResponse.json({ message: "Appointment booking is temporarily unavailable." }, { status: 500, headers: responseHeaders })
  }
}

const methodNotAllowed = () => NextResponse.json({ message: "Please submit an appointment with POST." }, { status: 405, headers: { ...responseHeaders, allow: "POST" } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
