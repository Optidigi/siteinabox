import { loadPublishedSnapshot } from "./snapshot"
import { publicHostFromProtectedRequest } from "./origin-protection"

export const MAX_FORM_DATA_BYTES = 32_768
export const MAX_FORM_BODY_BYTES = 64 * 1024
export const MAX_FORM_FIELD_BYTES = 32_768

type FormRecord = Record<string, unknown>

export type CmsFormCreatePayload = {
  tenant: string
  formName: string
  pageUrl?: string
  data: Record<string, string>
  email?: string
  name?: string
  message?: string
}

export type FormIngressResult =
  | { ok: true; payload: CmsFormCreatePayload; forwardedFor: string | null }
  | { ok: false; status: number; code: string; message: string }

class FormIngressError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

const isRecord = (value: unknown): value is FormRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const cleanEmail = (value: unknown): string | undefined => {
  const email = cleanText(value)?.toLowerCase()
  if (!email || email.includes("\n") || email.includes("\r")) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined
  return email
}

const firstCleanText = (record: FormRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = cleanText(record[key])
    if (value) return value
  }
  return undefined
}

const assertFieldSize = (key: string, value: string): void => {
  if (byteLength(value) > MAX_FORM_FIELD_BYTES) {
    throw new FormIngressError(413, "field_too_large", `${key} is too large.`)
  }
}

const assertDataSize = (data: Record<string, string>): void => {
  const bytes = byteLength(JSON.stringify(data))
  if (bytes > MAX_FORM_DATA_BYTES) {
    throw new FormIngressError(413, "payload_too_large", "The form submission is too large.")
  }
}

const requestBodyTooLarge = (request: Request): boolean => {
  const raw = request.headers.get("content-length")
  if (!raw) return false
  const length = Number.parseInt(raw, 10)
  return Number.isFinite(length) && length > MAX_FORM_BODY_BYTES
}

const readTextBody = async (request: Request): Promise<string> => {
  if (requestBodyTooLarge(request)) {
    throw new FormIngressError(413, "payload_too_large", "The form submission is too large.")
  }
  const text = await request.text()
  if (byteLength(text) > MAX_FORM_BODY_BYTES) {
    throw new FormIngressError(413, "payload_too_large", "The form submission is too large.")
  }
  return text
}

const stringsFromRecord = (record: FormRecord): Record<string, string> => {
  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string") continue
    assertFieldSize(key, value)
    data[key] = value
  }
  return data
}

async function parseSubmissionRecord(request: Request): Promise<FormRecord> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""

  if (contentType.includes("application/json")) {
    const text = await readTextBody(request)
    try {
      const parsed = JSON.parse(text) as unknown
      if (!isRecord(parsed)) throw new Error("Expected an object")
      return parsed
    } catch {
      throw new FormIngressError(400, "invalid_json", "The form submission could not be read.")
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(await readTextBody(request))
    return Object.fromEntries(params.entries())
  }

  if (contentType.includes("multipart/form-data")) {
    if (requestBodyTooLarge(request)) {
      throw new FormIngressError(413, "payload_too_large", "The form submission is too large.")
    }
    const formData = await request.formData()
    const record: FormRecord = {}
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") {
        throw new FormIngressError(400, "unsupported_field", "File uploads are not supported by this form.")
      }
      assertFieldSize(key, value)
      record[key] = value
    }
    return record
  }

  throw new FormIngressError(415, "unsupported_media_type", "Please submit the form as JSON or form data.")
}

export function cmsFormsEndpoint(): URL | null {
  const baseUrl = process.env.SIAB_CMS_URL
  if (!baseUrl) return null
  return new URL("/api/forms", baseUrl)
}

export function normalizeFormPayload(record: FormRecord, tenantId: string, request: Request): CmsFormCreatePayload {
  const nestedData = isRecord(record.data) ? stringsFromRecord(record.data) : null
  const data = nestedData ?? stringsFromRecord(record)
  assertDataSize(data)

  const formName = cleanText(record.formName) ?? cleanText(data.formName) ?? "Website form"
  const referrer = request.headers.get("referer") ?? request.headers.get("referrer")
  const pageUrl = cleanText(record.pageUrl) ?? cleanText(record.url) ?? cleanText(data.pageUrl) ?? cleanText(referrer)
  const email = cleanEmail(record.email) ?? cleanEmail(data.email) ?? cleanEmail(data.contactEmail)
  const name = cleanText(record.name) ?? firstCleanText(data, ["name", "naam", "fullName"])
  const message = cleanText(record.message) ?? firstCleanText(data, ["message", "bericht", "notes"])

  return {
    tenant: tenantId,
    formName,
    ...(pageUrl ? { pageUrl } : {}),
    data,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(message ? { message } : {}),
  }
}

export async function buildCmsFormPayload(request: Request): Promise<FormIngressResult> {
  try {
    const host = publicHostFromProtectedRequest(request)
    const snapshot = await loadPublishedSnapshot(host)
    if (!snapshot) {
      return {
        ok: false,
        status: 404,
        code: "site_not_found",
        message: "This site is not ready to receive form submissions.",
      }
    }

    const record = await parseSubmissionRecord(request)
    return {
      ok: true,
      payload: normalizeFormPayload(record, snapshot.tenantId, request),
      forwardedFor: request.headers.get("x-forwarded-for"),
    }
  } catch (error) {
    if (error instanceof FormIngressError) {
      return { ok: false, status: error.status, code: error.code, message: error.message }
    }
    throw error
  }
}
