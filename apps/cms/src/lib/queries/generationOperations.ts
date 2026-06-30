import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"
import type { IntakeSubmission, SiteGenerationRun } from "@/payload-types"

export type GenerationRunFilter =
  | "all"
  | "new-requests"
  | "ready-for-ai"
  | "drafts-to-preview"
  | "waiting-for-checkout"
  | "launch-needed"
  | "live"
  | "needs-attention"

export type OperationsWorkflowState =
  | "New requests"
  | "Ready for AI"
  | "Drafts to preview"
  | "Waiting for checkout"
  | "Launch needed"
  | "Live"
  | "Needs attention"

export type OperationsWorkflowSummary = {
  state: OperationsWorkflowState
  label: string
  primaryAction: string
  helper: string
}

export interface ListGenerationOperationsOpts {
  page?: number
  pageSize?: number
  q?: string
  filter?: GenerationRunFilter
}

export type GenerationOperationsResult = {
  runs: PayloadFindResult<SiteGenerationRun>
  intakes: PayloadFindResult<IntakeSubmission>
}

const failedWhere = { status: { equals: "failed" } }
const newRequestsWhere = {
  or: [
    { status: { equals: "submitted" } },
    { status: { equals: "normalized" } },
  ],
}
const readyForAIWhere = {
  or: [
    { status: { equals: "queued" } },
    { status: { equals: "generating" } },
    { status: { equals: "generated" } },
    { status: { equals: "validating" } },
    { status: { equals: "applying" } },
  ],
}
const draftsToPreviewWhere = {
  or: [
    { status: { equals: "draft_ready" } },
  ],
}
const previewReadyWhere = { status: { equals: "preview_ready" } }

export function generationRunWhere(filter: GenerationRunFilter = "all", q?: string): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = []
  if (filter === "needs-attention") clauses.push(failedWhere)
  if (filter === "new-requests") clauses.push(newRequestsWhere)
  if (filter === "ready-for-ai") clauses.push({ or: [newRequestsWhere, readyForAIWhere] })
  if (filter === "drafts-to-preview") clauses.push(draftsToPreviewWhere)
  if (filter === "waiting-for-checkout" || filter === "launch-needed" || filter === "live") clauses.push(previewReadyWhere)

  const query = q?.trim()
  if (query) {
    clauses.push({
      or: [
        { idempotencyKey: { like: query } },
        { provider: { like: query } },
        { model: { like: query } },
        { promptVersion: { like: query } },
        { specHash: { like: query } },
      ],
    })
  }

  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0]!
  return { and: clauses }
}

export function intakeSubmissionWhere(filter: GenerationRunFilter = "all", q?: string): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = []
  if (filter === "needs-attention") clauses.push(failedWhere)
  if (filter === "new-requests") clauses.push(newRequestsWhere)
  if (filter === "ready-for-ai") clauses.push({ or: [newRequestsWhere, readyForAIWhere] })
  if (filter === "drafts-to-preview") clauses.push(draftsToPreviewWhere)
  if (filter === "waiting-for-checkout" || filter === "launch-needed" || filter === "live") clauses.push(previewReadyWhere)

  const query = q?.trim()
  if (query) {
    clauses.push({
      or: [
        { businessName: { like: query } },
        { contactEmail: { like: query } },
        { contactName: { like: query } },
        { idempotencyKey: { like: query } },
        { normalizedHash: { like: query } },
      ],
    })
  }

  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0]!
  return { and: clauses }
}

export async function listGenerationOperations(
  opts?: ListGenerationOperationsOpts,
  payload?: PayloadLikeFindClient,
): Promise<GenerationOperationsResult> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const filter = opts?.filter ?? "all"

  const [runs, intakes] = await Promise.all([
    client.find<SiteGenerationRun>({
      collection: "site-generation-runs",
      overrideAccess: true,
      where: generationRunWhere(filter, opts?.q),
      sort: "-updatedAt",
      depth: 2,
      page,
      limit,
    }),
    client.find<IntakeSubmission>({
      collection: "intake-submissions",
      overrideAccess: true,
      where: intakeSubmissionWhere(filter, opts?.q),
      sort: "-updatedAt",
      depth: 2,
      page,
      limit,
    }),
  ])

  return { runs, intakes }
}

export async function getGenerationRunForOperations(id: string | number): Promise<SiteGenerationRun | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({
      collection: "site-generation-runs",
      id,
      overrideAccess: true,
      depth: 2,
    })
  } catch {
    return null
  }
}

export async function getIntakeSubmissionForOperations(id: string | number): Promise<IntakeSubmission | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({
      collection: "intake-submissions",
      id,
      overrideAccess: true,
      depth: 2,
    })
  } catch {
    return null
  }
}

export type JsonSummary =
  | { kind: "empty" }
  | { kind: "text"; value: string }
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "list"; value: unknown[] }

const SENSITIVE_KEY = /(api[_-]?key|authorization|bearer|cookie|password|secret|token|rawoutput|raw_output|generationinput|generation_input)/i

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return value
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}...` : value
  if (typeof value !== "object") return value
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => summarizeValue(entry, depth + 1))
  }
  if (depth >= 3) return "[object]"

  const out: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]"
      continue
    }
    out[key] = summarizeValue(nested, depth + 1)
  }
  return out
}

export function summarizeJson(value: unknown): JsonSummary {
  if (value == null || value === "") return { kind: "empty" }
  if (typeof value === "string") return { kind: "text", value: value.length > 500 ? `${value.slice(0, 500)}...` : value }
  const summarized = summarizeValue(value)
  if (Array.isArray(summarized)) return { kind: "list", value: summarized }
  if (summarized && typeof summarized === "object") return { kind: "object", value: summarized as Record<string, unknown> }
  return { kind: "text", value: String(summarized) }
}

export function extractIssueCount(value: unknown): number {
  if (!value || typeof value !== "object") return 0
  const issues = (value as { issues?: unknown }).issues
  return Array.isArray(issues) ? issues.length : 0
}

const jsonStatus = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const status = (value as { status?: unknown }).status
  return typeof status === "string" ? status : null
}

const isPaymentSatisfied = (value: unknown): boolean => {
  const status = jsonStatus(value)
  return status === "completed" || status === "waived"
}

const tenantDomainVerified = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return jsonStatus((value as { domainVerification?: unknown }).domainVerification) === "verified"
}

const tenantIsLive = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const tenant = value as { activeSnapshot?: unknown }
  return relationId(tenant.activeSnapshot) !== null
}

const reviewedBriefApproved = (value: unknown): boolean =>
  jsonStatus(value) === "admin-approved"

export function workflowSummaryForGenerationRun(run: Pick<SiteGenerationRun, "status" | "validation" | "applyResult" | "clientApproval" | "payment" | "tenant">): OperationsWorkflowSummary {
  const issueCount = extractIssueCount(run.validation) + extractIssueCount(run.applyResult)
  if (run.status === "failed" || issueCount > 0) {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Review intake",
      helper: "Review the request before continuing.",
    }
  }

  if (tenantIsLive(run.tenant)) {
    return {
      state: "Live",
      label: "Live",
      primaryAction: "Send handoff email",
      helper: "The site is active for visitors.",
    }
  }

  if (run.status === "draft_ready") {
    return {
      state: "Drafts to preview",
      label: "Open draft",
      primaryAction: "Open draft",
      helper: "Review the draft before sending a preview.",
    }
  }

  if (run.status === "preview_ready") {
    const approved = jsonStatus(run.clientApproval) === "approved"
    const paid = isPaymentSatisfied(run.payment)
    const domainVerified = tenantDomainVerified(run.tenant)

    if (approved && paid && domainVerified) {
      return {
        state: "Launch needed",
        label: "Launch site",
        primaryAction: "Launch site",
        helper: "Checkout is complete and the domain is ready.",
      }
    }

    if (approved && paid) {
      return {
        state: "Launch needed",
        label: "Register domain",
        primaryAction: "Register domain",
        helper: "Checkout is complete; prepare the domain and launch.",
      }
    }

    if (approved) {
      return {
        state: "Waiting for checkout",
        label: "Waiting for checkout",
        primaryAction: "Waiting for checkout",
        helper: "Client approval and payment are the remaining checkout gate.",
      }
    }

    return {
      state: "Waiting for checkout",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Share the preview and wait for client checkout.",
    }
  }

  return {
    state: "Ready for AI",
    label: "Send to AI",
    primaryAction: "Open draft",
    helper: "The AI draft is being prepared.",
  }
}

export function workflowSummaryForIntakeSubmission(submission: Pick<IntakeSubmission, "status" | "generationRun" | "reviewedGenerationInput">): OperationsWorkflowSummary {
  if (submission.status === "failed") {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Review intake",
      helper: "Review the request before continuing.",
    }
  }

  if ((submission.status === "submitted" || submission.status === "normalized") && !relationId(submission.generationRun)) {
    if (reviewedBriefApproved(submission.reviewedGenerationInput)) {
      return {
        state: "Ready for AI",
        label: "Send to AI",
        primaryAction: "Send to AI",
        helper: "The reviewed brief is ready for AI generation.",
      }
    }

    return {
      state: "New requests",
      label: "Review intake",
      primaryAction: "Review intake",
      helper: "Review intake details and prepare the brief.",
    }
  }

  if (submission.status === "preview_ready") {
    return {
      state: "Waiting for checkout",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Draft site is ready for client checkout.",
    }
  }

  return {
    state: "Ready for AI",
    label: "Send to AI",
    primaryAction: "Send to AI",
    helper: "The reviewed brief is being turned into a draft site.",
  }
}

export function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "number" || typeof value === "string") return String(value)
  if (typeof value === "object" && "id" in value) return String((value as { id: string | number }).id)
  return null
}

export function relationLabel(value: unknown, fallback = "Record"): string {
  if (value == null) return fallback
  if (typeof value === "number" || typeof value === "string") return String(value)
  if (typeof value !== "object") return fallback
  const doc = value as { name?: unknown; title?: unknown; slug?: unknown; domain?: unknown; id?: unknown }
  const label = doc.name ?? doc.title ?? doc.slug ?? doc.domain ?? doc.id
  return label == null ? fallback : String(label)
}

export function relationSlug(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("slug" in value)) return null
  const slug = (value as { slug?: unknown }).slug
  return typeof slug === "string" && slug ? slug : null
}
