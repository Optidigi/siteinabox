"use server"

import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"

const allowedStatuses = new Set(["not_checked", "verified", "failed"])

const text = (value: FormDataEntryValue | null): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

export async function updateTenantDomainVerificationAction(
  generationRunId: string | number,
  tenantId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const status = String(formData.get("status") ?? "")
  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported domain verification status.")
  }

  const payload = await getPayload({ config })
  await payload.update({
    collection: "tenants",
    id: tenantId as any,
    data: {
      domainVerification: {
        status,
        checkedAt: new Date().toISOString(),
        checkedBy: user.id,
        notes: text(formData.get("notes")),
      },
    } as any,
    depth: 0,
    overrideAccess: false,
    user,
  } as any)

  revalidatePath(`/operations/runs/${generationRunId}`)
}
