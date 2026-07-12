import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { emailPreferenceRequestEvidence, unsubscribeMarketing } from "@/lib/email/unsubscribe"

async function readRequest(request: Request) {
  const queryToken = new URL(request.url).searchParams.get("token")
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { token?: unknown } | null
    return { token: typeof body?.token === "string" ? body.token : queryToken, oneClick: false }
  }
  const form = await request.formData().catch(() => null)
  const token = form?.get("token")
  return {
    token: typeof token === "string" ? token : queryToken,
    oneClick: form?.get("List-Unsubscribe") === "One-Click",
  }
}

export async function POST(request: Request) {
  const { token, oneClick } = await readRequest(request)
  if (!token) return NextResponse.json({ ok: false, message: "Token required" }, { status: 400 })
  try {
    await unsubscribeMarketing({
      payload: await getPayload({ config }), token,
      requiredAction: "unsubscribe_marketing",
      source: oneClick ? "list-unsubscribe" : "email-unsubscribe",
      ...emailPreferenceRequestEvidence(request),
    })
  } catch {
    // Do not disclose whether an address or preference exists.
    return NextResponse.json({ ok: false, message: "Invalid or expired token" }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
