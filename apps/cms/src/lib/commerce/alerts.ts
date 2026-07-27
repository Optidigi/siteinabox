import "server-only"

import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"

export async function recordCommerceAdminException(input: {
  payload: Payload
  source: "payments" | "domains"
  code: string
  message: string
  tenant?: Parameters<typeof relationshipId>[0]
  subjectId: string | number
  metadata?: Record<string, unknown>
  severity?: "warning" | "error" | "critical"
  now?: string
}): Promise<void> {
  const now = input.now ?? new Date().toISOString()
  const tenantId = relationshipId(input.tenant)
  const dedupeKey = `commerce:${input.source}:${input.code}:${input.subjectId}`
  const existing = await input.payload.find({
    collection: "operational-alerts",
    where: { dedupeKey: { equals: dedupeKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const alert = existing.docs[0]
  if (alert) {
    await input.payload.update({
      collection: "operational-alerts",
      id: alert.id,
      data: {
        status: "open",
        severity: input.severity ?? "error",
        message: input.message,
        metadata: input.metadata ?? {},
        occurrenceCount: alert.occurrenceCount + 1,
        lastSeenAt: now,
      },
      depth: 0,
      overrideAccess: true,
    })
    return
  }
  await input.payload.create({
    collection: "operational-alerts",
    data: {
      status: "open",
      severity: input.severity ?? "error",
      source: input.source,
      dedupeKey,
      message: input.message,
      tenant: tenantId == null ? undefined : Number(tenantId),
      metadata: input.metadata ?? {},
      occurrenceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    depth: 0,
    overrideAccess: true,
  })
}
