import "server-only"

import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"

const SENSITIVE_METADATA_KEY =
  /(auth|token|secret|password|credential|transfer.?code|email|name|address|user.?agent|ip)/i
const EMAIL_VALUE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g

const isUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  const candidate = error as Error & {
    code?: unknown
    data?: { errors?: Array<{ message?: unknown }> }
  }
  return (
    candidate.code === "23505" ||
    /duplicate key value violates unique constraint/i.test(candidate.message) ||
    candidate.data?.errors?.some((entry) =>
      typeof entry.message === "string" &&
      /duplicate|unique/i.test(entry.message),
    ) === true
  )
}

export function sanitizeCommerceAlertMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_METADATA_KEY.test(key))
      .map(([key, value]) => {
        if (typeof value === "string") {
          return [key, value.replace(EMAIL_VALUE, "[redacted-email]").slice(0, 500)]
        }
        if (
          value == null ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return [key, value]
        }
        return [key, "[redacted-structured-value]"]
      }),
  )
}

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
  const metadata = sanitizeCommerceAlertMetadata(input.metadata)
  const findExisting = () => input.payload.find({
    collection: "operational-alerts",
    where: { dedupeKey: { equals: dedupeKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const updateExisting = async (
    alert: Awaited<ReturnType<typeof findExisting>>["docs"][number],
  ) => {
    await input.payload.update({
      collection: "operational-alerts",
      id: alert.id,
      data: {
        status: "open",
        severity: input.severity ?? "error",
        message: input.message,
        metadata,
        occurrenceCount: alert.occurrenceCount + 1,
        lastSeenAt: now,
      },
      depth: 0,
      overrideAccess: true,
    })
  }
  const existing = await findExisting()
  const alert = existing.docs[0]
  if (alert) {
    await updateExisting(alert)
    return
  }
  try {
    await input.payload.create({
      collection: "operational-alerts",
      data: {
        status: "open",
        severity: input.severity ?? "error",
        source: input.source,
        dedupeKey,
        message: input.message,
        tenant: tenantId == null ? undefined : Number(tenantId),
        metadata,
        occurrenceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const raced = (await findExisting()).docs[0]
    if (!raced) throw error
    await updateExisting(raced)
  }
}

export async function resolveCommerceAdminException(input: {
  payload: Payload
  source: "payments" | "domains"
  code: string
  subjectId: string | number
  now?: string
}): Promise<void> {
  const now = input.now ?? new Date().toISOString()
  const dedupeKey = `commerce:${input.source}:${input.code}:${input.subjectId}`
  const existing = await input.payload.find({
    collection: "operational-alerts",
    where: { dedupeKey: { equals: dedupeKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const alert = existing.docs[0]
  if (!alert || alert.status === "resolved") return
  await input.payload.update({
    collection: "operational-alerts",
    id: alert.id,
    data: {
      status: "resolved",
      resolvedAt: now,
      lastSeenAt: now,
    },
    depth: 0,
    overrideAccess: true,
  })
}
