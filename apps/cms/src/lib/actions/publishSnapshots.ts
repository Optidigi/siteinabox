"use server"

import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { activatePublishedSnapshot, publishSiteSnapshot } from "@/lib/publish/siteSnapshots"

const checkbox = (value: FormDataEntryValue | null): boolean => value === "on" || value === "true"
const text = (value: FormDataEntryValue | null): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

export async function publishGenerationRunSnapshotAction(
  generationRunId: string | number,
  tenantId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  await publishSiteSnapshot(payload, {
    tenantId,
    generationRunId,
    activate: checkbox(formData.get("activate")),
    manualActivation: checkbox(formData.get("manualActivation")),
    publishedBy: user.id,
    activationReason: text(formData.get("reason")),
  })
  revalidatePath(`/generation-runs/${generationRunId}`)
}

export async function activateSnapshotAction(
  generationRunId: string | number,
  snapshotId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  await activatePublishedSnapshot(payload, {
    snapshotId,
    manualActivation: checkbox(formData.get("manualActivation")),
    activatedBy: user.id,
    activationReason: text(formData.get("reason")),
  })
  revalidatePath(`/generation-runs/${generationRunId}`)
}

export async function rollbackSnapshotAction(
  generationRunId: string | number,
  snapshotId: string | number,
  formData: FormData,
): Promise<void> {
  const { user } = await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  await activatePublishedSnapshot(payload, {
    snapshotId,
    manualActivation: checkbox(formData.get("manualActivation")),
    activatedBy: user.id,
    activationReason: text(formData.get("reason")) ?? "manual rollback",
    rollback: true,
  })
  revalidatePath(`/generation-runs/${generationRunId}`)
}
