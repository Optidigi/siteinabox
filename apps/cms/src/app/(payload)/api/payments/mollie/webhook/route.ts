import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { queueMolliePaymentSync } from "@/lib/jobs/syncMolliePaymentTask"

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/x-www-form-urlencoded") {
    return NextResponse.json({ ok: false, message: "Unsupported webhook content type" }, { status: 415 })
  }
  const rawBody = await req.text()
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
