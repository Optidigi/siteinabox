import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun } from "@/payload-types"

export const generationRunPaymentStatuses = [
  "not_started",
  "pending_provider",
  "completed",
  "waived",
  "canceled",
  "failed",
  "expired",
] as const

export type GenerationRunPaymentStatus = (typeof generationRunPaymentStatuses)[number]

export type GenerationRunPaymentState = {
  status: GenerationRunPaymentStatus
  provider: string | null
  externalReference: string | null
  actor: string | number | null
  completedAt: string | null
  waivedAt: string | null
  updatedAt: string | null
  note: string | null
  checkoutUrl: string | null
  customerEmail: string | null
  clientSlug: string | null
  amount: string | null
  currency: string | null
  providerStatus: string | null
  webhookProcessedAt: string | null
}

export type GenerationRunPaymentInput = {
  status: Extract<GenerationRunPaymentStatus, "completed" | "waived">
  actor: string | number
  provider?: string | null
  externalReference?: string | null
  note?: string | null
  now?: string
}

const isPaymentStatus = (status: unknown): status is GenerationRunPaymentStatus =>
  generationRunPaymentStatuses.includes(status as GenerationRunPaymentStatus)

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeGenerationRunPaymentState(value: unknown): GenerationRunPaymentState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const status = isPaymentStatus(source.status) ? source.status : "not_started"

  return {
    status,
    provider: cleanText(source.provider),
    externalReference: cleanText(source.externalReference),
    actor: typeof source.actor === "string" || typeof source.actor === "number" ? source.actor : null,
    completedAt: cleanText(source.completedAt),
    waivedAt: cleanText(source.waivedAt),
    updatedAt: cleanText(source.updatedAt),
    note: cleanText(source.note),
    checkoutUrl: cleanText(source.checkoutUrl),
    customerEmail: cleanText(source.customerEmail),
    clientSlug: cleanText(source.clientSlug),
    amount: cleanText(source.amount),
    currency: cleanText(source.currency),
    providerStatus: cleanText(source.providerStatus),
    webhookProcessedAt: cleanText(source.webhookProcessedAt),
  }
}

export function createPendingProviderPaymentState(now = new Date().toISOString()): GenerationRunPaymentState {
  return {
    status: "pending_provider",
    provider: null,
    externalReference: null,
    actor: null,
    completedAt: null,
    waivedAt: null,
    updatedAt: now,
    note: "Payment provider not selected; operator completion or waiver is required before activation.",
    checkoutUrl: null,
    customerEmail: null,
    clientSlug: null,
    amount: null,
    currency: null,
    providerStatus: null,
    webhookProcessedAt: null,
  }
}

export function createOperationalPaymentState(input: GenerationRunPaymentInput): GenerationRunPaymentState {
  const now = input.now ?? new Date().toISOString()
  return {
    status: input.status,
    provider: cleanText(input.provider) ?? "manual",
    externalReference: cleanText(input.externalReference),
    actor: input.actor,
    completedAt: input.status === "completed" ? now : null,
    waivedAt: input.status === "waived" ? now : null,
    updatedAt: now,
    note: cleanText(input.note),
    checkoutUrl: null,
    customerEmail: null,
    clientSlug: null,
    amount: null,
    currency: null,
    providerStatus: null,
    webhookProcessedAt: null,
  }
}

export function isActivationPaymentSatisfied(value: unknown): boolean {
  const state = normalizeGenerationRunPaymentState(value)
  return state.status === "completed" || state.status === "waived"
}

export async function recordGenerationRunPaymentState(
  payload: Payload,
  generationRunId: string | number,
  input: GenerationRunPaymentInput,
): Promise<SiteGenerationRun> {
  const payment = createOperationalPaymentState(input)
  return payload.update({
    collection: "site-generation-runs",
    id: generationRunId as any,
    data: { payment } as any,
    depth: 0,
    overrideAccess: true,
    user: { id: input.actor } as any,
  }) as Promise<SiteGenerationRun>
}
