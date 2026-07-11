"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { retryLegalDelivery } from "@/lib/legal/retryLegalDelivery"

export async function retryLegalDeliveryAction(deliveryId: string, formData: FormData) {
  const { user } = await requireRole(["super-admin"])
  const requestHeaders = await headers()
  const reason = String(formData.get("reason") ?? "")
  const requestId = requestHeaders.get("x-request-id")
  try {
    await retryLegalDelivery({
      payload: await getPayload({ config }), deliveryId, actorUserId: user.id, actorEmail: user.email, reason,
      requestId,
    })
  } catch (error) {
    console.error("Legal delivery retry failed", { error, deliveryId, requestId })
    redirect(`/legal/deliveries/${deliveryId}?retry=failed`)
  }
  redirect(`/legal/deliveries/${deliveryId}?retry=queued`)
}
