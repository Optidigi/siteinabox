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
  | "draft-sites"
  | "waiting-on-client"
  | "ready-to-go-live"
  | "live"
  | "needs-attention"

export type OperationsWorkflowState =
  | "New requests"
  | "Draft sites"
  | "Waiting on client"
  | "Ready to go live"
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
const draftSitesWhere = {
  or: [
    { status: { equals: "queued" } },
    { status: { equals: "generating" } },
    { status: { equals: "generated" } },
    { status: { equals: "validating" } },
    { status: { equals: "applying" } },
    { status: { equals: "draft_ready" } },
  ],
}
const waitingOnClientWhere = { status: { equals: "preview_ready" } }
const readyToGoLiveWhere = { status: { equals: "preview_ready" } }

export function generationRunWhere(filter: GenerationRunFilter = "all", q?: string): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = []
  if (filter === "needs-attention") clauses.push(failedWhere)
  if (filter === "new-requests") clauses.push(newRequestsWhere)
  if (filter === "draft-sites") clauses.push(draftSitesWhere)
  if (filter === "waiting-on-client") clauses.push(waitingOnClientWhere)
  if (filter === "ready-to-go-live" || filter === "live") clauses.push(readyToGoLiveWhere)

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
  if (filter === "draft-sites") clauses.push(draftSitesWhere)
  if (filter === "waiting-on-client") clauses.push(waitingOnClientWhere)
  if (filter === "ready-to-go-live" || filter === "live") clauses.push(readyToGoLiveWhere)

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

export function workflowSummaryForGenerationRun(run: Pick<SiteGenerationRun, "status" | "validation" | "applyResult" | "clientApproval" | "payment" | "tenant">): OperationsWorkflowSummary {
  const issueCount = extractIssueCount(run.validation) + extractIssueCount(run.applyResult)
  if (run.status === "failed" || issueCount > 0) {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Open site",
      helper: "Review the request before continuing.",
    }
  }

  if (tenantIsLive(run.tenant)) {
    return {
      state: "Live",
      label: "Live",
      primaryAction: "Open site",
      helper: "The site is active for visitors.",
    }
  }

  if (run.status === "draft_ready") {
    return {
      state: "Draft sites",
      label: "Draft site",
      primaryAction: "Open site",
      helper: "Review the draft before sending a preview.",
    }
  }

  if (run.status === "preview_ready") {
    const approved = jsonStatus(run.clientApproval) === "approved"
    const paid = isPaymentSatisfied(run.payment)
    const domainVerified = tenantDomainVerified(run.tenant)

    if (approved && paid && domainVerified) {
      return {
        state: "Ready to go live",
        label: "Domain verified",
        primaryAction: "Go live",
        helper: "Approved, payment handled, and domain verified.",
      }
    }

    if (approved && paid) {
      return {
        state: "Waiting on client",
        label: "Payment",
        primaryAction: "Domain verified",
        helper: "Confirm the domain before going live.",
      }
    }

    if (approved) {
      return {
        state: "Waiting on client",
        label: "Approved",
        primaryAction: "Waive payment",
        helper: "Payment is the remaining client gate.",
      }
    }

    return {
      state: "Waiting on client",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Share the preview and wait for approval.",
    }
  }

  return {
    state: "Draft sites",
    label: "Generate draft",
    primaryAction: "Open site",
    helper: "The draft site is being prepared.",
  }
}

export function workflowSummaryForIntakeSubmission(submission: Pick<IntakeSubmission, "status" | "generationRun">): OperationsWorkflowSummary {
  if (submission.status === "failed") {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Review intake",
      helper: "Review the request before continuing.",
    }
  }

  if ((submission.status === "submitted" || submission.status === "normalized") && !relationId(submission.generationRun)) {
    return {
      state: "New requests",
      label: "New request",
      primaryAction: "Approve brief",
      helper: "Review intake details and approve the brief.",
    }
  }

  if (submission.status === "preview_ready") {
    return {
      state: "Waiting on client",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Draft site is ready for client review.",
    }
  }

  return {
    state: "Draft sites",
    label: "Generate draft",
    primaryAction: "Generate draft",
    helper: "The approved brief is being turned into a draft site.",
  }
}

export function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "number" || typeof value === "string") return String(value)
  if (typeof value === "object" && "id" in value) return String((value as { id: string | number }).id)
  return null
}

export function relationLabel(value: unknown, fallback = "Record"): string {
  if (value == null) return "-"
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
