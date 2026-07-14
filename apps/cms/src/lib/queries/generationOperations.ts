import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  findAllPaginated,
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"
import type { IntakeSubmission, SiteGenerationRun } from "@/payload-types"

export type GenerationRunFilter =
  | "all"
  | "preview-ready"
  | "checkout-completed"
  | "live"
  | "needs-attention"

export type OperationsWorkflowState =
  | "Preview ready"
  | "Checkout completed"
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

export type OperationsStatusMetric = {
  key: "preview-ready" | "checkout-completed" | "live" | "needs-attention"
  value: number
  tone: "neutral" | "success" | "warning"
  href: string
}

export type OperationsAttentionRow = {
  id: string
  kind: "intake" | "run"
  title: string
  subject: string
  detail: string
  updatedAt: string | null
  href: string
}

export type GenerationOperationsOverview = {
  metrics: OperationsStatusMetric[]
  attention: OperationsAttentionRow[]
}

const failedWhere = { status: { equals: "failed" } }
const previewCandidateWhere = {
  or: [
    { status: { equals: "draft_ready" } },
    { status: { equals: "preview_ready" } },
  ],
}
const dashboardRunWhere = { or: [failedWhere, previewCandidateWhere] }

export function generationRunWhere(filter: GenerationRunFilter = "all", q?: string): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = []
  if (filter === "all") clauses.push(dashboardRunWhere)
  if (filter === "needs-attention") clauses.push(failedWhere)
  if (filter === "preview-ready" || filter === "checkout-completed" || filter === "live") clauses.push(previewCandidateWhere)

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
  if (filter === "all" || filter === "needs-attention") clauses.push(failedWhere)
  if (filter === "preview-ready" || filter === "checkout-completed" || filter === "live") clauses.push({ id: { equals: "__none__" } })

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

const operationsStateForFilter = (filter: GenerationRunFilter): OperationsWorkflowState | null => {
  if (filter === "preview-ready") return "Preview ready"
  if (filter === "checkout-completed") return "Checkout completed"
  if (filter === "live") return "Live"
  if (filter === "needs-attention") return "Needs attention"
  return null
}

const paginatedResult = <T>(docs: T[], page: number, limit: number): PayloadFindResult<T> => {
  const totalDocs = docs.length
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * limit
  return {
    docs: docs.slice(start, start + limit),
    totalDocs,
    totalPages,
    page: currentPage,
    limit,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
  }
}

export async function listOperationRuns(
  opts?: ListGenerationOperationsOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult<SiteGenerationRun>> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const runs = await findAllPaginated<SiteGenerationRun>(client, {
    collection: "site-generation-runs",
    overrideAccess: true,
    where: generationRunWhere("all"),
    sort: "-updatedAt",
    depth: 2,
    pageSize: 250,
  })
  const query = opts?.q?.trim().toLocaleLowerCase()
  const searched = query
    ? runs.filter((run) => [
      relationLabel(run.tenant, ""),
      run.idempotencyKey,
      run.provider,
      run.model,
      run.promptVersion,
      run.specHash,
    ].some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(query)))
    : runs
  const state = operationsStateForFilter(opts?.filter ?? "all")
  return paginatedResult(state ? searched.filter((run) => workflowSummaryForGenerationRun(run).state === state) : searched, page, limit)
}

export async function listOperationIntakes(
  opts?: ListGenerationOperationsOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult<IntakeSubmission>> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const submissions = await findAllPaginated<IntakeSubmission>(client, {
    collection: "intake-submissions",
    overrideAccess: true,
    where: intakeSubmissionWhere("all", opts?.q),
    sort: "-updatedAt",
    depth: 2,
    pageSize: 250,
  })
  return paginatedResult(submissions, page, limit)
}

export async function getGenerationOperationsOverview(
  payload?: PayloadLikeFindClient,
): Promise<GenerationOperationsOverview> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const [runs, intakes] = await Promise.all([
    findAllPaginated<SiteGenerationRun>(client, {
      collection: "site-generation-runs",
      overrideAccess: true,
      where: generationRunWhere("all"),
      sort: "-updatedAt",
      depth: 2,
      pageSize: 250,
    }),
    findAllPaginated<IntakeSubmission>(client, {
      collection: "intake-submissions",
      overrideAccess: true,
      where: intakeSubmissionWhere("all"),
      sort: "-updatedAt",
      depth: 2,
      pageSize: 250,
    }),
  ])

  const counts = new Map<OperationsWorkflowState, number>([
    ["Preview ready", 0],
    ["Checkout completed", 0],
    ["Live", 0],
    ["Needs attention", 0],
  ])
  for (const run of runs) {
    const state = workflowSummaryForGenerationRun(run).state
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  for (const submission of intakes) {
    const state = workflowSummaryForIntakeSubmission(submission).state
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }

  const attention: OperationsAttentionRow[] = [
    ...intakes.map((submission) => {
      const summary = workflowSummaryForIntakeSubmission(submission)
      return {
        id: `intake-${submission.id}`,
        kind: "intake" as const,
        title: submission.businessName,
        subject: summary.label,
        detail: summary.helper,
        updatedAt: submission.updatedAt ?? submission.createdAt ?? null,
        href: `/operations/intakes/${submission.id}`,
      }
    }),
    ...runs.flatMap((run) => {
      const summary = workflowSummaryForGenerationRun(run)
      return summary.state === "Needs attention" ? [{
        id: `run-${run.id}`,
        kind: "run" as const,
        title: relationLabel(run.tenant, "Draft site"),
        subject: summary.label,
        detail: summary.helper,
        updatedAt: run.updatedAt ?? null,
        href: `/operations/runs/${run.id}`,
      }] : []
    }),
  ].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())

  return {
    metrics: [
      { key: "preview-ready", value: counts.get("Preview ready") ?? 0, tone: "neutral", href: "/operations/runs?status=preview-ready" },
      { key: "checkout-completed", value: counts.get("Checkout completed") ?? 0, tone: "neutral", href: "/operations/runs?status=checkout-completed" },
      { key: "live", value: counts.get("Live") ?? 0, tone: "success", href: "/operations/runs?status=live" },
      { key: "needs-attention", value: counts.get("Needs attention") ?? 0, tone: "warning", href: "/operations" },
    ],
    attention,
  }
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

const postPaymentAutomationFailed = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const state = (value as { postPaymentAutomation?: unknown }).postPaymentAutomation
  return jsonStatus(state) === "failed" || jsonStatus(state) === "blocked"
}

export function workflowSummaryForGenerationRun(run: Pick<SiteGenerationRun, "status" | "validation" | "applyResult" | "clientApproval" | "payment" | "tenant" | "errors">): OperationsWorkflowSummary {
  const issueCount = extractIssueCount(run.validation) + extractIssueCount(run.applyResult)
  if (run.status === "failed" || issueCount > 0 || postPaymentAutomationFailed(run.errors)) {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Open client",
      helper: "A workflow step needs operator recovery.",
    }
  }

  if (tenantIsLive(run.tenant)) {
    return {
      state: "Live",
      label: "Live",
      primaryAction: "Open client",
      helper: "The site is active for visitors.",
    }
  }

  if (run.status === "draft_ready") {
    return {
      state: "Preview ready",
      label: "Prepare preview",
      primaryAction: "Open client",
      helper: "Draft content is ready for the operator preview gate.",
    }
  }

  if (run.status === "preview_ready") {
    const approved = jsonStatus(run.clientApproval) === "approved"
    const paid = isPaymentSatisfied(run.payment)
    const domainVerified = tenantDomainVerified(run.tenant)

    if (approved && paid && domainVerified) {
      return {
        state: "Checkout completed",
        label: "Activating",
        primaryAction: "Open client",
        helper: "Checkout is complete; automatic activation is expected.",
      }
    }

    if (approved && paid) {
      return {
        state: "Checkout completed",
        label: "Provisioning",
        primaryAction: "Open client",
        helper: "Payment is complete; provider automation is working.",
      }
    }

    if (approved) {
      return {
        state: "Preview ready",
        label: "Checkout open",
        primaryAction: "Open client",
        helper: "The client approved; payment is still open.",
      }
    }

    return {
      state: "Preview ready",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Send the preview email when the site is ready for the client.",
    }
  }

  return {
    state: "Needs attention",
    label: "Not actionable",
    primaryAction: "Open client",
    helper: "This item is outside the normal Operations queue.",
  }
}

export function workflowSummaryForIntakeSubmission(submission: Pick<IntakeSubmission, "status" | "generationRun" | "reviewedGenerationInput">): OperationsWorkflowSummary {
  if (submission.status === "failed") {
    return {
      state: "Needs attention",
      label: "Needs attention",
      primaryAction: "Open client",
      helper: "Intake automation failed and needs recovery.",
    }
  }

  if ((submission.status === "submitted" || submission.status === "normalized") && !relationId(submission.generationRun)) {
    if (reviewedBriefApproved(submission.reviewedGenerationInput)) {
      return {
        state: "Needs attention",
        label: "Generation recovery",
        primaryAction: "Open client",
        helper: "The reviewed brief is ready for draft generation recovery.",
      }
    }

    return {
      state: "Needs attention",
      label: "Intake not processed",
      primaryAction: "Open client",
      helper: "The request has no linked draft and needs recovery.",
    }
  }

  if (submission.status === "preview_ready") {
    return {
      state: "Preview ready",
      label: "Send preview",
      primaryAction: "Send preview",
      helper: "Draft site is ready for client checkout.",
    }
  }

  return {
    state: "Needs attention",
    label: "Not actionable",
    primaryAction: "Open client",
    helper: "This intake record is outside the normal Operations queue.",
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
