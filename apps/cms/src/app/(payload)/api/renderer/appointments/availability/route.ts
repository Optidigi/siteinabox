import { NextResponse, type NextRequest } from "next/server"
import { AppointmentAvailabilityQuerySchema } from "@siteinabox/contracts"
import config from "@/payload.config"
import { getPayload } from "payload"
import { AppointmentInputError, AppointmentUnavailableError, listAppointmentAvailability } from "@/lib/appointments/service"

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: responseHeaders })
  const tenantId = tenantIdFromRequest(req)
  if (tenantId == null) return NextResponse.json({ message: "tenantId is required" }, { status: 400, headers: responseHeaders })

  const parsedQuery = AppointmentAvailabilityQuerySchema.safeParse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  })
  if (!parsedQuery.success) return NextResponse.json({ message: "The availability range is invalid." }, { status: 400, headers: responseHeaders })

  try {
    const payload = await getPayload({ config })
    const availability = await listAppointmentAvailability({ payload, tenantId, query: parsedQuery.data })
    return NextResponse.json(availability, { status: 200, headers: responseHeaders })
  } catch (error) {
    if (error instanceof AppointmentInputError) return NextResponse.json({ message: error.message }, { status: 400, headers: responseHeaders })
    if (error instanceof AppointmentUnavailableError) return NextResponse.json({ message: "Appointment booking is temporarily unavailable." }, { status: 503, headers: responseHeaders })
    console.error("Appointment availability lookup failed", error)
    return NextResponse.json({ message: "Appointment booking is temporarily unavailable." }, { status: 500, headers: responseHeaders })
  }
}
