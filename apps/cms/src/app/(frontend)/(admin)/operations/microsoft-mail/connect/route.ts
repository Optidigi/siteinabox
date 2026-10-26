import { NextResponse } from "next/server"
import { requireRole } from "@/lib/authGate"
import { beginPartnerConnection } from "@/lib/microsoftMailProvisioning/partnerConnection"

export async function GET() {
  const { user } = await requireRole(["super-admin"])
  const { url, cookie } = beginPartnerConnection(String(user.id))
  const response = NextResponse.redirect(url)
  response.cookies.set("siab-ms-partner-state", cookie, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600,
    path: new URL(process.env.MICROSOFT_PARTNER_APP_REDIRECT_URI!).pathname })
  response.headers.set("cache-control", "no-store")
  response.headers.set("referrer-policy", "no-referrer")
  return response
}
