import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { emailPreferenceRequestEvidence, unsubscribeMarketing } from "@/lib/email/unsubscribe"

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const token = form?.get("token")
  if (typeof token !== "string") return NextResponse.json({ ok: false, message: "Token required" }, { status: 400 })
  try {
    await unsubscribeMarketing({
      payload: await getPayload({ config }), token, requiredAction: "manage_preferences",
      source: "email-unsubscribe", ...emailPreferenceRequestEvidence(request),
    })
  } catch {
    return NextResponse.redirect(new URL(`/email/preferences?status=invalid`, request.url), 303)
  }
  return NextResponse.redirect(new URL(`/email/preferences?status=unsubscribed`, request.url), 303)
}
