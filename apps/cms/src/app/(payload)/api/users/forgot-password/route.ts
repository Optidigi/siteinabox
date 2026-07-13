import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { SUPER_ADMIN_RESET_TOKEN_TTL_MS } from "@/lib/auth/passwordRecovery"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"

const genericResponse = () => NextResponse.json({
  message: "If an eligible account exists, a password reset email has been sent.",
})

export async function POST(req: Request) {
  let email: string
  try {
    const body = await req.json() as { email?: unknown }
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 })
  }
  if (!email) return NextResponse.json({ message: "Invalid request" }, { status: 400 })

  const payload = await getPayload({ config })
  let caller: any = null
  try {
    caller = (await payload.auth({ headers: req.headers })).user
  } catch {
    caller = null
  }
  // Authenticated tenant users do not have a password-recovery capability and
  // must not bypass the anonymous rate limit to flood a super-admin mailbox.
  if (caller && caller.role !== "super-admin") {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }
  if (!caller && hasUnvalidatedAuthSignal(req)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }
  const users = await payload.find({
    collection: "users",
    where: { and: [
      { email: { equals: email } },
      { role: { equals: "super-admin" } },
    ] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  // Keep tenant users and unknown addresses indistinguishable. Tenant users
  // are passwordless and must never receive a Payload password reset token.
  if (users.docs.length === 0) return genericResponse()

  try {
    await payload.forgotPassword({
      collection: "users",
      data: { email },
      expiration: SUPER_ADMIN_RESET_TOKEN_TTL_MS,
      overrideAccess: true,
    })
    return genericResponse()
  } catch (error) {
    payload.logger.error({ err: error }, "Super-admin password reset email failed")
    return NextResponse.json({ message: "Could not send password reset email" }, { status: 500 })
  }
}
