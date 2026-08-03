import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { sendPlatformContactEmail } from "@/lib/contact/platformContact"
import { verifyTurnstile } from "@/lib/security/turnstile"
import config from "@/payload.config"

const MAX_CONTACT_BYTES = 32 * 1024

const formValue = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" ? value : undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

async function parseBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? ""
  if (contentType.includes("application/json")) {
    const body = await req.json()
    return isRecord(body) ? body : null
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await req.formData()
    return {
      name: formValue(form.get("name")),
      email: formValue(form.get("email")),
      phone: formValue(form.get("phone")),
      subjectTopic: formValue(form.get("subject_topic")) ?? formValue(form.get("subjectTopic")),
      message: formValue(form.get("message")),
      source: formValue(form.get("source")) ?? "siteinabox.nl/contact",
      turnstileToken: formValue(form.get("cf-turnstile-response")),
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  let user: unknown = null
  try {
    const auth = await payload.auth({ headers: req.headers })
    user = auth.user
  } catch {
    user = null
  }
  if (!user && hasUnvalidatedAuthSignal(req)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTACT_BYTES) {
    return NextResponse.json({ message: "Contact payload too large" }, { status: 413 })
  }

  let body: Record<string, unknown> | null
  try {
    body = await parseBody(req)
  } catch {
    return NextResponse.json({ message: "Invalid contact body" }, { status: 400 })
  }
  if (!body) return NextResponse.json({ message: "Contact body required" }, { status: 400 })

  const turnstileToken = body.turnstileToken ?? body["cf-turnstile-response"]
  const verification = await verifyTurnstile({
    token: turnstileToken,
  })
  if (!verification.ok) {
    const message = verification.status === 503
      ? "Contact verification temporarily unavailable"
      : "Contact verification failed"
    return NextResponse.json(
      { message, code: verification.code },
      { status: verification.status },
    )
  }

  const result = await sendPlatformContactEmail(payload, body)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }
  return NextResponse.json({ ok: true }, { status: 202 })
}
