import type { MailIntent, MailRetryState, MailTenantRef } from "@/lib/email/sendEmail"

const ALERT_WINDOW_MINUTES = 15
const REPEATED_FAILURE_THRESHOLD = 3

const importantFailureIntents = new Set<MailIntent>([
  "auth.magic_link",
  "auth.password_reset",
  "preview.magic_link",
  "preview.site_ready",
  "privacy.data_export",
  "intake.internal_notification",
  "site.live_notice",
])

export type MailAlertPayload = {
  create?: (args: {
    collection: "operational-alerts"
    data: Record<string, unknown>
    overrideAccess: true
  }) => Promise<unknown>
  find?: (args: {
    collection: "mail-logs" | "operational-alerts"
    where: Record<string, unknown>
    limit: number
    depth: 0
    overrideAccess: true
  }) => Promise<{ totalDocs?: number; docs?: unknown[] }>
  update?: (args: {
    collection: "operational-alerts"
    id: string | number
    data: Record<string, unknown>
    depth: 0
    overrideAccess: true
  }) => Promise<unknown>
  logger?: {
    warn?: (message: string | Record<string, unknown>, meta?: string | Record<string, unknown>) => void
    error?: (message: string | Record<string, unknown>, meta?: string | Record<string, unknown>) => void
  }
}

export type MailFailureAlertInput = {
  flow: MailIntent
  tenant?: MailTenantRef
  sender: string
  recipient: string
  provider: string
  providerErrorCode?: string
  providerErrorMessage?: string
  retryState: MailRetryState
  failedAt: string
}

export async function recordMailFailureAlert(payload: MailAlertPayload | undefined, input: MailFailureAlertInput) {
  if (!payload) return

  const failureCount = await countRecentFailures(payload, input)
  const repeated = typeof failureCount === "number" && failureCount >= REPEATED_FAILURE_THRESHOLD
  const important = isImportantFailure(input)
  if (!repeated && !important) return

  const severity = input.retryState === "permanent" || important ? "error" : "warning"
  const reason = repeated ? "repeated_mail_failures" : "important_mail_failure"
  const alert = compactAlertData({
    severity,
    reason,
    flow: input.flow,
    tenant: formatTenantRef(input.tenant) ?? undefined,
    sender: input.sender,
    recipient: input.recipient,
    provider: input.provider,
    providerErrorCode: input.providerErrorCode,
    retryState: input.retryState,
    failuresInWindow: failureCount,
    windowMinutes: ALERT_WINDOW_MINUTES,
    action: suggestedAction(input),
  })
  const tenant = formatTenantRef(input.tenant)
  await upsertOperationalAlert(payload, {
    severity,
    source: "mail",
    dedupeKey: buildDedupeKey(input, reason),
    message: mailAlertMessage(input, reason),
    ...(tenant != null ? { tenant } : {}),
    metadata: alert,
    now: input.failedAt,
  })

  if (severity === "error") {
    payload.logger?.error?.("[mail] outbound delivery alert", alert)
  } else {
    payload.logger?.warn?.("[mail] outbound delivery alert", alert)
  }
}

function isImportantFailure(input: MailFailureAlertInput) {
  return input.retryState === "permanent" || importantFailureIntents.has(input.flow)
}

async function countRecentFailures(payload: MailAlertPayload, input: MailFailureAlertInput) {
  if (!payload.find) return undefined

  const since = new Date(Date.parse(input.failedAt) - ALERT_WINDOW_MINUTES * 60_000).toISOString()
  try {
    const result = await payload.find({
      collection: "mail-logs",
      where: {
        and: [
          { status: { equals: "failed" } },
          { flow: { equals: input.flow } },
          { sender: { equals: input.sender } },
          { recipient: { equals: input.recipient } },
          { failedAt: { greater_than_equal: since } },
          ...(formatTenantRef(input.tenant) != null
            ? [{ tenant: { equals: formatTenantRef(input.tenant) } }]
            : []),
        ],
      },
      limit: REPEATED_FAILURE_THRESHOLD,
      depth: 0,
      overrideAccess: true,
    })
    return typeof result.totalDocs === "number" ? result.totalDocs : result.docs?.length
  } catch (error) {
    payload.logger?.warn?.("[mail] failed to evaluate outbound delivery alert window", {
      flow: input.flow,
      tenant: formatTenantRef(input.tenant),
      provider: input.provider,
      error: error instanceof Error ? error.message : "Unknown mail alert query error",
    })
    return undefined
  }
}

function suggestedAction(input: MailFailureAlertInput) {
  if (input.retryState === "permanent") {
    return "Check sender/domain verification, recipient validity, and provider rejection code."
  }
  if (input.retryState === "retryable") {
    return "Check provider availability, SMTP connectivity, and retry the affected workflow when stable."
  }
  return "Check provider logs and recent mail-log failures for the same flow."
}

async function upsertOperationalAlert(
  payload: MailAlertPayload,
  input: {
    severity: string
    source: string
    dedupeKey: string
    message: string
    tenant?: string | number
    metadata: Record<string, unknown>
    now: string
  },
) {
  if (!payload.create) return

  try {
    const existing = payload.find
      ? await payload.find({
          collection: "operational-alerts",
          where: {
            and: [
              { dedupeKey: { equals: input.dedupeKey } },
              { status: { equals: "open" } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : undefined
    const doc = existing?.docs?.[0] as { id?: string | number; occurrenceCount?: unknown } | undefined
    if (doc?.id != null && payload.update) {
      const occurrenceCount = typeof doc.occurrenceCount === "number" ? doc.occurrenceCount + 1 : 2
      await payload.update({
        collection: "operational-alerts",
        id: doc.id,
        data: compactAlertData({
          severity: input.severity,
          message: input.message,
          tenant: input.tenant,
          metadata: input.metadata,
          occurrenceCount,
          lastSeenAt: input.now,
        }),
        depth: 0,
        overrideAccess: true,
      })
      return
    }

    await payload.create({
      collection: "operational-alerts",
      overrideAccess: true,
      data: compactAlertData({
        severity: input.severity,
        status: "open",
        source: input.source,
        dedupeKey: input.dedupeKey,
        message: input.message,
        tenant: input.tenant,
        metadata: input.metadata,
        occurrenceCount: 1,
        firstSeenAt: input.now,
        lastSeenAt: input.now,
      }),
    })
  } catch (error) {
    payload.logger?.warn?.("[mail] failed to write operational alert", {
      source: input.source,
      dedupeKey: input.dedupeKey,
      error: error instanceof Error ? error.message : "Unknown operational alert write error",
    })
  }
}

function buildDedupeKey(input: MailFailureAlertInput, reason: string) {
  return [
    "mail",
    reason,
    input.flow,
    formatTenantRef(input.tenant) ?? "platform",
    input.sender,
    input.recipient,
    input.provider,
    input.providerErrorCode ?? input.retryState,
  ].join(":").toLowerCase()
}

function mailAlertMessage(input: MailFailureAlertInput, reason: string) {
  if (reason === "repeated_mail_failures") return `Repeated outbound mail failures for ${input.flow}`
  return `Outbound mail failed for ${input.flow}`
}

function compactAlertData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ""))
}

function formatTenantRef(tenant: MailTenantRef) {
  if (tenant && typeof tenant === "object") return tenant.id
  return tenant
}
