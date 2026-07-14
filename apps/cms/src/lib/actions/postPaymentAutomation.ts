"use server"

import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import {
  retryPostPaymentAutomation,
  type PostPaymentAutomationRetryStep,
} from "@/lib/payments/postPaymentActivation"

const allowedSteps = new Set<PostPaymentAutomationRetryStep>([
  "mollie_subscription",
  "domain_provisioning",
  "refresh_provisioning",
  "activation_gate",
  "publish_activate",
])

export async function retryPostPaymentAutomationAction(
  generationRunId: string | number,
  step: PostPaymentAutomationRetryStep,
): Promise<void> {
  await requireRole(["super-admin"])
  if (!allowedSteps.has(step)) {
    throw new Error("Unsupported post-payment automation retry step.")
  }

  const payload = await getPayload({ config })
  await retryPostPaymentAutomation(payload, generationRunId, step)
  revalidatePath(`/operations/runs/${generationRunId}`)
}
