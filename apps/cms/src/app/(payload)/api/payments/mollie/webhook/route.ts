import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { applyMollieWebhookPayment, isIgnorableMollieWebhookError } from "@/lib/payments/molliePayments"
import { verifyMollieWebhookSignature } from "@/lib/payments/mollieAdapter"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyMollieWebhookSignature(rawBody, req.headers.get("x-mollie-signature"))) {
    return NextResponse.json({ ok: false, message: "Invalid webhook signature" }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const paymentId = params.get("id")?.trim()
  if (!paymentId) {
    return NextResponse.json({ ok: false, message: "Mollie payment id is required" }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    await applyMollieWebhookPayment(payload, paymentId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isIgnorableMollieWebhookError(err)) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, message: "Mollie webhook failed" }, { status: 422 })
  }
}
