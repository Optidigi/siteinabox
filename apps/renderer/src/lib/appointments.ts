import {
  AppointmentAvailabilityResponseSchema,
  AppointmentBookingInputSchema,
  AppointmentBookingResponseSchema,
  AppointmentManagementRequestSchema,
  AppointmentManagementResponseSchema,
  type AppointmentBookingInput,
  type AppointmentAvailabilityQuery,
  type AppointmentManagementRequest,
} from "@siteinabox/contracts"
import { loadPublishedSnapshot } from "./snapshot"
import { publicHostFromProtectedRequest } from "./origin-protection"
import { readRuntimeSecret } from "./runtime-secret"

export const MAX_APPOINTMENT_BODY_BYTES = 16 * 1024

export type PublicAppointmentSite = {
  tenantId: string
}

export async function resolvePublicAppointmentSite(request: Request): Promise<PublicAppointmentSite | null> {
  const host = publicHostFromProtectedRequest(request)
  if (!host) return null
  const snapshot = await loadPublishedSnapshot(host)
  return snapshot ? { tenantId: snapshot.tenantId } : null
}

export function cmsAppointmentsAvailabilityEndpoint(
  tenantId: string,
  query: AppointmentAvailabilityQuery,
): URL | null {
  const baseUrl = process.env.SIAB_CMS_URL
  if (!baseUrl) return null
  const endpoint = new URL("/api/renderer/appointments/availability", baseUrl)
  endpoint.searchParams.set("tenantId", tenantId)
  endpoint.searchParams.set("from", query.from)
  if (query.to) endpoint.searchParams.set("to", query.to)
  return endpoint
}

export function cmsAppointmentsEndpoint(tenantId: string): URL | null {
  const baseUrl = process.env.SIAB_CMS_URL
  if (!baseUrl) return null
  const endpoint = new URL("/api/renderer/appointments", baseUrl)
  endpoint.searchParams.set("tenantId", tenantId)
  return endpoint
}

export function cmsAppointmentsManagementEndpoint(tenantId: string): URL | null {
  const baseUrl = process.env.SIAB_CMS_URL
  if (!baseUrl) return null
  const endpoint = new URL("/api/renderer/appointments/manage", baseUrl)
  endpoint.searchParams.set("tenantId", tenantId)
  return endpoint
}

const internalHeaders = (request: Request): Headers => {
  const headers = new Headers({ "content-type": "application/json" })
  const token = readRuntimeSecret(
    process.env.SIAB_RENDERER_API_TOKEN,
    process.env.SIAB_RENDERER_API_TOKEN_FILE,
  )
  if (token) headers.set("authorization", `Bearer ${token}`)
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor)
  return headers
}

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength

export async function readPublicAppointmentBody(request: Request): Promise<AppointmentBookingInput | null> {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_APPOINTMENT_BODY_BYTES) return null
    const text = await request.text()
    if (byteLength(text) > MAX_APPOINTMENT_BODY_BYTES) return null
    const parsed = AppointmentBookingInputSchema.safeParse(JSON.parse(text) as unknown)
    if (!parsed.success) return null
    const referrer = request.headers.get("referer") ?? request.headers.get("referrer")
    return parsed.data.pageUrl || !referrer ? parsed.data : { ...parsed.data, pageUrl: referrer }
  } catch {
    return null
  }
}

export async function readPublicAppointmentManagementBody(request: Request): Promise<AppointmentManagementRequest | null> {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_APPOINTMENT_BODY_BYTES) return null
    const text = await request.text()
    if (byteLength(text) > MAX_APPOINTMENT_BODY_BYTES) return null
    const parsed = AppointmentManagementRequestSchema.safeParse(JSON.parse(text) as unknown)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function fetchAppointmentAvailability(
  request: Request,
  site: PublicAppointmentSite,
  query: AppointmentAvailabilityQuery,
): Promise<Response> {
  const endpoint = cmsAppointmentsAvailabilityEndpoint(site.tenantId, query)
  if (!endpoint) return new Response(null, { status: 503 })
  return fetch(endpoint, { method: "GET", headers: internalHeaders(request), cache: "no-store" })
}

export async function submitAppointmentBooking(
  request: Request,
  site: PublicAppointmentSite,
  booking: AppointmentBookingInput,
): Promise<Response> {
  const endpoint = cmsAppointmentsEndpoint(site.tenantId)
  if (!endpoint) return new Response(null, { status: 503 })
  return fetch(endpoint, {
    method: "POST",
    headers: internalHeaders(request),
    body: JSON.stringify(booking),
    cache: "no-store",
  })
}

export async function manageAppointmentRequest(
  request: Request,
  site: PublicAppointmentSite,
  management: AppointmentManagementRequest,
): Promise<Response> {
  const endpoint = cmsAppointmentsManagementEndpoint(site.tenantId)
  if (!endpoint) return new Response(null, { status: 503 })
  return fetch(endpoint, {
    method: "POST",
    headers: internalHeaders(request),
    body: JSON.stringify(management),
    cache: "no-store",
  })
}

export const parseAppointmentAvailabilityResponse = (value: unknown) =>
  AppointmentAvailabilityResponseSchema.safeParse(value)

export const parseAppointmentBookingResponse = (value: unknown) =>
  AppointmentBookingResponseSchema.safeParse(value)

export const parseAppointmentManagementRequest = (value: unknown) =>
  AppointmentManagementRequestSchema.safeParse(value)

export const parseAppointmentManagementResponse = (value: unknown) =>
  AppointmentManagementResponseSchema.safeParse(value)
