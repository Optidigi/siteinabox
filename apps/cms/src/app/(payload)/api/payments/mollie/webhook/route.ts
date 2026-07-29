import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { queueMolliePaymentSync } from "@/lib/jobs/syncMolliePaymentTask"

export async function POST(req: NextRequest) {
  const maximumBodyBytes = 4_096
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/x-www-form-urlencoded") {
    return NextResponse.json({ ok: false, message: "Unsupported webhook content type" }, { status: 415 })
  }
  const declaredLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBodyBytes) {
    return NextResponse.json({ ok: false, message: "Webhook body is too large" }, { status: 413 })
  }
  const rawBody = await req.text()
  if (Buffer.byteLength(rawBody, "utf8") > maximumBodyBytes) {
    return NextResponse.json({ ok: false, message: "Webhook body is too large" }, { status: 413 })
  }
  const params = new URLSearchParams(rawBody)
  const paymentId = params.get("id")?.trim()
  if (!paymentId || !/^tr_[A-Za-z0-9_-]+$/.test(paymentId) || params.getAll("id").length !== 1) {
    return NextResponse.json({ ok: false, message: "Mollie payment id is required" }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    await queueMolliePaymentSync(payload, paymentId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { ok: false, message: "Mollie webhook enqueue failed" },
      { status: 503 },
    )
  }
}
