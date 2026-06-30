import {
  GenerationInputSchema,
  SiteGenerationSpecSchema,
  type PublicIntakeSubmission,
} from "@siteinabox/contracts/generation"
import type { Payload } from "payload"
import { generationWorkflowStatuses } from "@/collections/IntakeSubmissions"
import {
  applySiteGenerationSpec,
  siteGenerationSpecHash,
  validateSiteGenerationSpecForCms,
} from "@/lib/site-generation/applySiteGenerationSpec"
import {
  createSiteGenerationProviderRequest,
  resolveSiteGenerationProvider,
  type SiteGenerationProvider,
  type SiteGenerationProviderConfig,
  type SiteGenerationProviderRequest,
} from "@/lib/ai-generation/providers"
import { hashStableValue, normalizeIntakeSubmission } from "./normalizeIntake"
import type { MockGenerationFixture } from "./mockGeneration"

type WorkflowStatus = (typeof generationWorkflowStatuses)[number]

type Transition = {
  status: WorkflowStatus
  at: string
  message?: string
}

export type IntakeProcessingResult = {
  ok: boolean
  reused: boolean
  intakeSubmissionId?: string | number
  generationRunId?: string | number
  status: WorkflowStatus
  tenantId?: string | number
  pageIds?: Array<string | number>
  settingsId?: string | number
  error?: Record<string, unknown>
}

type PayloadDoc = Record<string, any>

const now = () => new Date().toISOString()

const transition = (status: WorkflowStatus, message?: string): Transition => ({
  status,
  at: now(),
  ...(message ? { message } : {}),
})

const appendTransition = (doc: PayloadDoc | null | undefined, status: WorkflowStatus, message?: string): Transition[] => [
  ...((doc?.statusTransitions as Transition[] | undefined) ?? []),
  transition(status, message),
]

const errorPayload = (err: unknown): Record<string, unknown> => ({
  message: err instanceof Error ? err.message : "Unknown intake generation error",
})

const retryableProviderError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err)
  return /429|rate|timeout|temporar|503|502|500/i.test(message)
}

const submittedBusinessName = (raw: PublicIntakeSubmission): string => {
  const value = "businessName" in raw ? raw.businessName : raw.company?.companyName
  return typeof value === "string" && value.trim() ? value.trim() : "Invalid intake"
}

const submittedContactName = (raw: PublicIntakeSubmission): string | null | undefined =>
  "contactName" in raw ? raw.contactName : "finalDetails" in raw ? raw.finalDetails.name : undefined

const submittedContactEmail = (raw: PublicIntakeSubmission): string | null | undefined =>
  "contactEmail" in raw ? raw.contactEmail : "finalDetails" in raw ? raw.finalDetails.email : undefined

const generateWithRetry = async (
  provider: SiteGenerationProvider,
  request: SiteGenerationProviderRequest,
  maxAttempts: number,
) => {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { attempt, result: await provider.generate(request) }
    } catch (err) {
      lastError = err
      if (provider.name === "mock" || attempt >= maxAttempts || !retryableProviderError(err)) break
    }
  }
  throw lastError
}

const findOne = async (payload: Payload, collection: string, where: Record<string, unknown>): Promise<PayloadDoc | null> => {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return (result.docs[0] as PayloadDoc | undefined) ?? null
}

const updateDoc = async (
  payload: Payload,
  collection: string,
  doc: PayloadDoc,
  data: Record<string, unknown>,
): Promise<PayloadDoc> =>
  await payload.update({
    collection,
    id: doc.id,
    data,
    depth: 0,
    overrideAccess: true,
  } as any) as PayloadDoc

const setIntakeStatus = async (
  payload: Payload,
  intake: PayloadDoc,
  status: WorkflowStatus,
  data: Record<string, unknown> = {},
): Promise<PayloadDoc> =>
  updateDoc(payload, "intake-submissions", intake, {
    ...data,
    status,
    statusTransitions: appendTransition(intake, status),
  })

const setRunStatus = async (
  payload: Payload,
  run: PayloadDoc,
  status: WorkflowStatus,
  data: Record<string, unknown> = {},
): Promise<PayloadDoc> =>
  updateDoc(payload, "site-generation-runs", run, {
    ...data,
    status,
    statusTransitions: appendTransition(run, status),
    ...(status === "preview_ready" || status === "failed" ? { completedAt: now() } : {}),
  })

const terminalResult = (intake: PayloadDoc, run: PayloadDoc | null, reused: boolean): IntakeProcessingResult => ({
  ok: intake.status === "preview_ready" || run?.status === "preview_ready",
  reused,
  intakeSubmissionId: intake.id,
  generationRunId: run?.id,
  status: (run?.status ?? intake.status) as WorkflowStatus,
  tenantId: run?.tenant ?? intake.tenant,
  pageIds: run?.pages,
  settingsId: run?.settings,
  error: (run?.errors ?? intake.error) as Record<string, unknown> | undefined,
})

const processStoredIntakeGeneration = async (
  payload: Payload,
  input: {
    intake: PayloadDoc
    normalized: SiteGenerationProviderRequest["normalized"]
    normalizedHash: string
    providerRequest: SiteGenerationProviderRequest
    idempotencyKey: string
    provider: SiteGenerationProvider
    mockFixture?: MockGenerationFixture
    maxGenerationAttempts: number
  },
): Promise<IntakeProcessingResult> => {
  let intake = input.intake
  const existingRun = await findOne(payload, "site-generation-runs", { idempotencyKey: { equals: input.idempotencyKey } })
  if (existingRun) return terminalResult(intake, existingRun, true)

  let run = await payload.create({
    collection: "site-generation-runs",
    data: {
      intakeSubmission: intake.id,
      status: "queued",
      idempotencyKey: input.idempotencyKey,
      normalizedIntake: input.normalized,
      normalizedIntakeHash: input.normalizedHash,
      provider: input.provider.name,
      model: input.provider.model,
      promptVersion: input.provider.promptVersion,
      generationInputHash: input.providerRequest.inputHash,
      generationInput: input.providerRequest.input,
      mockFixture: input.mockFixture,
      statusTransitions: [transition("queued")],
    },
    depth: 0,
    overrideAccess: true,
  } as any) as PayloadDoc

  intake = await setIntakeStatus(payload, intake, "queued", { generationRun: run.id })

  try {
    run = await setRunStatus(payload, run, "generating", { startedAt: now() })
    intake = await setIntakeStatus(payload, intake, "generating")

    const generated = await generateWithRetry(input.provider, input.providerRequest, input.maxGenerationAttempts)
    const providerResult = generated.result
    const spec = providerResult.spec ?? providerResult.parsedOutput
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new Error("Generation provider returned no SiteGenerationSpec object")
    }
    const specHash = siteGenerationSpecHash(spec as any)
    run = await setRunStatus(payload, run, "generated", {
      provider: providerResult.provider,
      model: providerResult.model,
      promptVersion: providerResult.promptVersion,
      generationInputHash: providerResult.inputHash,
      generationInput: providerResult.input,
      generationOutputHash: providerResult.outputHash,
      rawOutput: providerResult.rawOutput,
      parsedOutput: providerResult.parsedOutput,
      generationAttempts: generated.attempt,
      spec,
      specHash,
    })
    intake = await setIntakeStatus(payload, intake, "generated")

    run = await setRunStatus(payload, run, "validating")
    intake = await setIntakeStatus(payload, intake, "validating")
    const validation = validateSiteGenerationSpecForCms(spec as any, { variantScope: "self-serve" })
    if (!validation.valid) {
      const failure = { message: "Generated SiteGenerationSpec failed validation", validation }
      run = await setRunStatus(payload, run, "failed", { validation, errors: failure })
      intake = await setIntakeStatus(payload, intake, "failed", { error: failure })
      return terminalResult(intake, run, false)
    }

    run = await setRunStatus(payload, run, "applying", { validation })
    intake = await setIntakeStatus(payload, intake, "applying")
    const parsedSpec = SiteGenerationSpecSchema.parse(spec)
    const applyResult = await applySiteGenerationSpec(payload, parsedSpec)
    if (!applyResult.ok) {
      const failure = { message: "Generated SiteGenerationSpec could not be applied", validation: applyResult.validation }
      run = await setRunStatus(payload, run, "failed", { validation: applyResult.validation, applyResult, errors: failure })
      intake = await setIntakeStatus(payload, intake, "failed", { error: failure })
      return terminalResult(intake, run, false)
    }

    run = await setRunStatus(payload, run, "draft_ready", {
      applyResult,
      tenant: applyResult.tenantId,
      pages: applyResult.pageIds ?? [],
      settings: applyResult.settingsId,
    })
    intake = await setIntakeStatus(payload, intake, "draft_ready", { tenant: applyResult.tenantId })

    run = await setRunStatus(payload, run, "preview_ready")
    intake = await setIntakeStatus(payload, intake, "preview_ready")
    return terminalResult(intake, run, false)
  } catch (err) {
    const failure = errorPayload(err)
    run = await setRunStatus(payload, run, "failed", { errors: failure })
    intake = await setIntakeStatus(payload, intake, "failed", { error: failure })
    return terminalResult(intake, run, false)
  }
}

export async function processIntakeSubmission(
  payload: Payload,
  raw: PublicIntakeSubmission,
  options: {
    mockFixture?: MockGenerationFixture
    provider?: SiteGenerationProvider
    providerConfig?: SiteGenerationProviderConfig
    maxGenerationAttempts?: number
  } = {},
): Promise<IntakeProcessingResult> {
  const mockFixture = options.mockFixture ?? "generic"
  const provider = options.provider ?? resolveSiteGenerationProvider({
    ...options.providerConfig,
    mockFixture,
  })
  const maxGenerationAttempts = Math.max(1, options.maxGenerationAttempts ?? (provider.name === "mock" ? 1 : 2))

  let normalized
  let normalizedHash
  let providerRequest: SiteGenerationProviderRequest | undefined
  let idempotencyKey
  try {
    normalized = normalizeIntakeSubmission(raw)
    normalizedHash = hashStableValue(normalized)
    providerRequest = createSiteGenerationProviderRequest(normalized)
    idempotencyKey = `${provider.name}:${provider.model}:${provider.promptVersion}:${providerRequest.inputHash}`
  } catch (err) {
    const rawHash = hashStableValue(raw)
    idempotencyKey = `${provider.name}:${provider.model}:${provider.promptVersion}:invalid:${rawHash}`
    const existing = await findOne(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
    if (existing) return terminalResult(existing, null, true)
    const failure = errorPayload(err)
    const intake = await payload.create({
      collection: "intake-submissions",
      data: {
        businessName: submittedBusinessName(raw),
        contactName: submittedContactName(raw),
        contactEmail: submittedContactEmail(raw),
        source: raw.source ?? "public-intake",
        status: "failed",
        idempotencyKey,
        raw,
        error: failure,
        statusTransitions: [transition("submitted"), transition("failed", "Normalization failed")],
      },
      depth: 0,
      overrideAccess: true,
    } as any) as PayloadDoc
    return terminalResult(intake, null, false)
  }

  if (!providerRequest) {
    throw new Error("Generation provider request was not created")
  }

  const existingIntake = await findOne(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
  let intake = existingIntake ?? await payload.create({
    collection: "intake-submissions",
    data: {
      businessName: normalized.businessName,
      contactName: normalized.contact?.name,
      contactEmail: normalized.contact?.email,
      source: raw.source ?? "public-intake",
      status: "submitted",
      idempotencyKey,
      raw,
      normalized,
      normalizedHash,
      statusTransitions: [transition("submitted")],
    },
    depth: 0,
    overrideAccess: true,
  } as any) as PayloadDoc

  intake = await setIntakeStatus(payload, intake, "normalized", { normalized, normalizedHash })

  return processStoredIntakeGeneration(payload, {
    intake,
    normalized,
    normalizedHash,
    providerRequest,
    idempotencyKey,
    provider,
    mockFixture,
    maxGenerationAttempts,
  })
}

export async function processReviewedIntakeSubmission(
  payload: Payload,
  intakeSubmissionId: string | number,
  options: {
    mockFixture?: MockGenerationFixture
    provider?: SiteGenerationProvider
    providerConfig?: SiteGenerationProviderConfig
    maxGenerationAttempts?: number
  } = {},
): Promise<IntakeProcessingResult> {
  const mockFixture = options.mockFixture ?? "generic"
  const provider = options.provider ?? resolveSiteGenerationProvider({
    ...options.providerConfig,
    mockFixture,
  })
  const maxGenerationAttempts = Math.max(1, options.maxGenerationAttempts ?? (provider.name === "mock" ? 1 : 2))

  const intake = await payload.findByID({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    depth: 0,
    overrideAccess: true,
  } as any) as PayloadDoc

  if (!intake.reviewedGenerationInput) {
    throw new Error("Reviewed GenerationInput is required before draft generation.")
  }
  const reviewedGenerationInput = GenerationInputSchema.parse(intake.reviewedGenerationInput)
  if (reviewedGenerationInput.status !== "admin-approved") {
    throw new Error("Reviewed GenerationInput must be admin-approved before draft generation.")
  }

  const normalized = reviewedGenerationInput.normalizedIntake
  const normalizedHash = hashStableValue(normalized)
  if (intake.normalizedHash && intake.normalizedHash !== normalizedHash) {
    throw new Error("Reviewed GenerationInput must match the intake submission normalized hash.")
  }

  const providerRequest = createSiteGenerationProviderRequest(normalized, reviewedGenerationInput)
  const idempotencyKey = [
    "reviewed",
    intake.id,
    provider.name,
    provider.model,
    provider.promptVersion,
    providerRequest.inputHash,
  ].join(":")

  return processStoredIntakeGeneration(payload, {
    intake,
    normalized,
    normalizedHash,
    providerRequest,
    idempotencyKey,
    provider,
    mockFixture,
    maxGenerationAttempts,
  })
}
