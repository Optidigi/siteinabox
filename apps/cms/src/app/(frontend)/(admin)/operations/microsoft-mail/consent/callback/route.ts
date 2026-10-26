import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { completePartnerConnection } from "@/lib/microsoftMailProvisioning/partnerConnection"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const { user } = await requireRole(["super-admin"])
  const store = await cookies()
  const cookie = store.get("siab-ms-partner-state")?.value
  store.set("siab-ms-partner-state", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: new URL(request.url).pathname })
  const incoming = new URL(request.url)
  const destination = new URL("/operations/microsoft-mail", process.env.SITE_URL)
  try {
    const code = incoming.searchParams.get("code")
    const state = incoming.searchParams.get("state")
    if (!cookie || !code || !state || incoming.searchParams.has("error")) throw new Error("Incomplete partner connection response.")
    await completePartnerConnection({ payload: await getPayload({ config }), code, state, cookie, actorId: String(user.id) })
    destination.searchParams.set("partnerConnection", "connected")
  } catch {
    destination.searchParams.set("partnerConnection", "failed")
  }
  return NextResponse.redirect(destination, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } })
}
