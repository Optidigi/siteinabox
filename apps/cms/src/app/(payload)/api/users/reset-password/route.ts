import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function POST(req: Request) {
  let password: string
  let token: string
  try {
    const body = await req.json() as { password?: unknown; token?: unknown }
    password = typeof body.password === "string" ? body.password : ""
    token = typeof body.token === "string" ? body.token : ""
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 })
  }
  if (password.length < 8 || !token) {
    return NextResponse.json({ message: "Invalid or expired reset token" }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const users = await payload.find({
    collection: "users",
    where: { and: [
      { resetPasswordToken: { equals: token } },
      { resetPasswordExpiration: { greater_than: new Date().toISOString() } },
      { role: { equals: "super-admin" } },
    ] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (users.docs.length === 0) {
    return NextResponse.json({ message: "Invalid or expired reset token" }, { status: 400 })
  }

  try {
    await payload.resetPassword({
      collection: "users",
      data: { password, token },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ message: "Invalid or expired reset token" }, { status: 400 })
  }
}
