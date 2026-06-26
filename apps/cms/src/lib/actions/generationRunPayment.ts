"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import {
  recordGenerationRunPaymentState,
  type GenerationRunPaymentStatus,
} from "@/lib/payments/generationRunPayment"
import { createMollieCheckoutForGenerationRun } from "@/lib/payments/molliePayments"

const allowedOperatorStatuses = new Set<GenerationRunPaymentStatus>(["completed", "waived"])

export async function recordGenerationRunPaymentAction(
  generationRunId: string | number,
  status: GenerationRunPaymentStatus,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  if (!allowedOperatorStatuses.has(status)) {
    throw new Error("Unsupported payment status mutation.")
  }

  const payload = await getPayload({ config })
  await recordGenerationRunPaymentState(payload, generationRunId, {
    status: status as "completed" | "waived",
    actor: user.id,
    provider: String(formData.get("provider") ?? ""),
    externalReference: String(formData.get("externalReference") ?? ""),
    note: String(formData.get("note") ?? ""),
  })

  revalidatePath(`/generation-runs/${generationRunId}`)
}

export async function createGenerationRunMollieCheckoutAction(
  generationRunId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  const result = await createMollieCheckoutForGenerationRun(payload, {
    runId: generationRunId,
    customerEmail: String(formData.get("customerEmail") ?? ""),
    actor: user.id,
  })

  revalidatePath(`/generation-runs/${generationRunId}`)
  redirect(result.checkoutUrl)
}
