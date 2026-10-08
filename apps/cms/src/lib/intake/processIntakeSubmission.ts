import {
  GenerationInputSchema,
  NormalizedIntakeSchema,
  SiteGenerationSpecSchema,
  type PublicIntakeSubmission,
  type SiteGenerationSpec,
  type ValidationReport,
} from "@siteinabox/contracts/generation"
import type { BuilderExecutionContext } from "@/lib/builder/executionContext"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import type { Payload, PayloadRequest, Where } from "payload"
import type { Config, IntakeSubmission, SiteGenerationRun } from "@/payload-types"
import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId } from "@/lib/relationshipId"
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
import { materializeTenantPrivacyDisclosure, withDerivedTenantPrivacyDisclosure } from "@/lib/legal/tenantPrivacyPage"
import type { MockGenerationFixture } from "./mockGeneration"
import { sitegenNormalizationContextFromIntake, sitegenOutputToGenerationSpec } from "@/lib/sitegen/normalize"
import { validateSitegenOutput } from "@/lib/sitegen/validate"
import { sitegenEligibilityFromIntake } from "@/lib/ai-generation/siteGenerationInput"

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

type CollectionSlug = keyof Config["collections"]
type CollectionDoc<T extends CollectionSlug> = Config["collections"][T]

type PayloadDoc = IntakeSubmission | SiteGenerationRun

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

const canonicalSpecFromProviderResult = (
  result: Awaited<ReturnType<typeof generateWithRetry>>["result"],
  normalized: SiteGenerationProviderRequest["normalized"],
): SiteGenerationSpec => {
  if (result.spec) return result.spec
  const parsedSpec = SiteGenerationSpecSchema.safeParse(result.parsedOutput)
  if (parsedSpec.success) return parsedSpec.data

  const output = validateSitegenOutput(result.parsedOutput, sitegenEligibilityFromIntake(normalized))
  if (!output.success) {
    throw new Error(`Structured Sitegen output failed semantic validation: ${output.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`)
  }
  return sitegenOutputToGenerationSpec(output.data, normalized, sitegenNormalizationContextFromIntake(normalized), { model: result.model })
}

// Every Local API entry must retain its live owned session. The adapter otherwise
// silently falls back to its root connection when a session disappears.
const withIntakeTransaction = async <T>(
  payload: Payload,
  executionContext: BuilderExecutionContext | undefined,
  operation: (req: Partial<PayloadRequest> | undefined, assertLive: () => void) => Promise<T>,
): Promise<T> => {
  const execute = async (req?: Partial<PayloadRequest>): Promise<T> => {
    const assertLive = () => {
      if (!executionContext) return
      if (!req) throw new Error("builder_transaction_lost")
      assertLiveBuilderTransaction(payload, req)
      if (executionContext.signal.aborted) throw new Error("builder_execution_aborted")
      if (Date.parse(executionContext.deadlineAt) <= Date.now()) throw new Error("builder_deadline_exceeded")
    }
    assertLive()
    const value = await operation(req, assertLive)
    assertLive()
    return value
  }
  return executionContext ? executionContext.withWrite(execute) : execute()
}

const updateIntake = async (
  payload: Payload,
  intake: IntakeSubmission,
  data: Partial<IntakeSubmission>,
  executionContext?: BuilderExecutionContext,
): Promise<IntakeSubmission> => withIntakeTransaction(payload, executionContext, async (req, assertLive) => {
  await payload.update({ collection: "intake-submissions", id: intake.id, data, depth: 0, overrideAccess: true, req })
  assertLive()
  return payload.findByID({ collection: "intake-submissions", id: intake.id, depth: 0, overrideAccess: true, req })
})

const updateRun = async (
  payload: Payload,
  run: SiteGenerationRun,
  data: Partial<SiteGenerationRun>,
  executionContext?: BuilderExecutionContext,
): Promise<SiteGenerationRun> => withIntakeTransaction(payload, executionContext, async (req, assertLive) => {
  await payload.update({ collection: "site-generation-runs", id: run.id, data, depth: 0, overrideAccess: true, req })
  assertLive()
  return payload.findByID({ collection: "site-generation-runs", id: run.id, depth: 0, overrideAccess: true, req })
})

const setIntakeStatus = async (
  payload: Payload,
  intake: IntakeSubmission,
  status: WorkflowStatus,
  data: Partial<IntakeSubmission> = {},
  executionContext?: BuilderExecutionContext,
): Promise<IntakeSubmission> =>
  updateIntake(payload, intake, {
    ...data,
    status,
    statusTransitions: appendTransition(intake, status),
  }, executionContext)

const setRunStatus = async (
  payload: Payload,
  run: SiteGenerationRun,
  status: WorkflowStatus,
  data: Partial<SiteGenerationRun> = {},
  executionContext?: BuilderExecutionContext,
): Promise<SiteGenerationRun> =>
  updateRun(payload, run, {
    ...data,
    status,
    statusTransitions: appendTransition(run, status),
    ...(status === "preview_ready" || status === "failed" ? { completedAt: now() } : {}),
  }, executionContext)

const terminalResult = (intake: IntakeSubmission, run: SiteGenerationRun | null, reused: boolean): IntakeProcessingResult => ({
  ok: intake.status === "preview_ready" || run?.status === "preview_ready",
  reused,
  intakeSubmissionId: intake.id,
  generationRunId: run?.id,
  status: (run?.status ?? intake.status) as WorkflowStatus,
  tenantId: relationshipId(run?.tenant ?? intake.tenant) ?? undefined,
  pageIds: Array.isArray(run?.pages)
    ? run.pages.map((page) => relationshipId(page)).filter((id): id is string => id != null)
    : undefined,
  settingsId: relationshipId(run?.settings) ?? undefined,
  error: (run?.errors ?? intake.error) as Record<string, unknown> | undefined,
})

const processStoredIntakeGeneration = async (
  payload: Payload,
  input: {
    intake: IntakeSubmission
    normalized: SiteGenerationProviderRequest["normalized"]
    normalizedHash: string
    providerRequest: SiteGenerationProviderRequest
    idempotencyKey: string
    provider: SiteGenerationProvider
    mockFixture?: MockGenerationFixture
    maxGenerationAttempts: number
    executionContext?: BuilderExecutionContext
    retireUnspecifiedPages?: boolean
    pinTenantId?: string | number
  },
): Promise<IntakeProcessingResult> => {
  let intake = input.intake
  const existingRun = await withIntakeTransaction(payload, input.executionContext, (req) => findOneDoc(payload, "site-generation-runs", { idempotencyKey: { equals: input.idempotencyKey } }, req))
  if (existingRun) {
    await input.executionContext?.recordGenerationReferences({ intakeSubmissionId: Number(intake.id), generationRunId: Number(existingRun.id) })
    return terminalResult(intake, existingRun, true)
  }

  const createRun = (req?: Partial<PayloadRequest>) => payload.create({
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
    req,
  })
  let run = await withIntakeTransaction(payload, input.executionContext, createRun)
  await input.executionContext?.recordGenerationReferences({ intakeSubmissionId: Number(intake.id), generationRunId: Number(run.id) })

  intake = await setIntakeStatus(payload, intake, "queued", { generationRun: run.id }, input.executionContext)

  try {
    run = await setRunStatus(payload, run, "generating", { startedAt: now() }, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "generating", {}, input.executionContext)

    const generated = await generateWithRetry(input.provider, { ...input.providerRequest, executionContext: input.executionContext }, input.executionContext ? 1 : input.maxGenerationAttempts)
    const providerResult = generated.result
    const sourceSpec = withDerivedTenantPrivacyDisclosure(canonicalSpecFromProviderResult(providerResult, input.normalized))
    const sourceValidation = validateSiteGenerationSpecForCms(sourceSpec, { variantScope: "self-serve" })
    const spec = sourceValidation.valid ? materializeTenantPrivacyDisclosure(sourceSpec) : sourceSpec
    const specHash = siteGenerationSpecHash(spec)
    run = await setRunStatus(payload, run, "generated", {
      provider: providerResult.provider,
      model: providerResult.model,
      promptVersion: providerResult.promptVersion,
      generationInputHash: providerResult.inputHash,
      generationInput: providerResult.input,
      generationOutputHash: providerResult.outputHash,
      rawOutput: providerResult.rawOutput,
      parsedOutput: providerResult.parsedOutput as SiteGenerationRun["parsedOutput"],
      generationAttempts: generated.attempt,
      spec,
      specHash,
    }, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "generated", {}, input.executionContext)

    run = await setRunStatus(payload, run, "validating", {}, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "validating", {}, input.executionContext)
    const validationResult = sourceValidation.valid
      ? validateSiteGenerationSpecForCms(spec, { variantScope: "self-serve", allowSystemPages: true })
      : sourceValidation
    const validation: ValidationReport = {
      valid: validationResult.valid,
      issues: validationResult.issues,
    }
    if (!validation.valid) {
      const failure = { message: "Generated SiteGenerationSpec failed validation", validation }
      run = await setRunStatus(payload, run, "failed", { validation, errors: failure }, input.executionContext)
      intake = await setIntakeStatus(payload, intake, "failed", { error: failure }, input.executionContext)
      return terminalResult(intake, run, false)
    }

    run = await setRunStatus(payload, run, "applying", { validation }, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "applying", {}, input.executionContext)
    const mediaMode = providerResult.provider === "mock" ? "upload-generated-media" : "skip-generated-placeholders"
    const applyResult = await applySiteGenerationSpec(payload, spec, {
      variantScope: "self-serve",
      mediaMode,
      executionContext: input.executionContext,
      ...(input.retireUnspecifiedPages ? { retireUnspecifiedPages: true } : {}),
      ...(input.pinTenantId != null ? { pinTenantId: input.pinTenantId } : {}),
    })
    if (!applyResult.ok) {
      const failure = { message: "Generated SiteGenerationSpec could not be applied", validation: applyResult.validation }
      run = await setRunStatus(payload, run, "failed", { validation: applyResult.validation, applyResult, errors: failure }, input.executionContext)
      intake = await setIntakeStatus(payload, intake, "failed", { error: failure }, input.executionContext)
      return terminalResult(intake, run, false)
    }

    run = await setRunStatus(payload, run, "draft_ready", {
      applyResult: applyResult as SiteGenerationRun["applyResult"],
      tenant: applyResult.tenantId != null ? Number(applyResult.tenantId) : null,
      pages: (applyResult.pageIds ?? []).map((id) => Number(id)),
      settings: applyResult.settingsId != null ? Number(applyResult.settingsId) : null,
    }, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "draft_ready", {
      tenant: applyResult.tenantId != null ? Number(applyResult.tenantId) : null,
    }, input.executionContext)

    run = await setRunStatus(payload, run, "preview_ready", {}, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "preview_ready", {}, input.executionContext)
    return terminalResult(intake, run, false)
  } catch (err) {
    const failure = errorPayload(err)
    run = await setRunStatus(payload, run, "failed", { errors: failure }, input.executionContext)
    intake = await setIntakeStatus(payload, intake, "failed", { error: failure }, input.executionContext)
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
    executionContext?: BuilderExecutionContext
  } = {},
): Promise<IntakeProcessingResult> {
  const mockFixture = options.mockFixture ?? "generic"
  const provider = options.provider ?? resolveSiteGenerationProvider({
    ...options.providerConfig,
    mockFixture,
  })
  const maxGenerationAttempts = Math.min(2, Math.max(1, options.maxGenerationAttempts ?? (provider.name === "mock" ? 1 : 2)))

  let normalized
  let normalizedHash
  let providerRequest: SiteGenerationProviderRequest | undefined
  let idempotencyKey: string
  try {
    normalized = normalizeIntakeSubmission(raw)
    normalizedHash = hashStableValue(normalized)
    providerRequest = createSiteGenerationProviderRequest(normalized)
    idempotencyKey = `${provider.name}:${provider.model}:${provider.promptVersion}:${providerRequest.inputHash}`
  } catch (err) {
    const rawHash = hashStableValue(raw)
    idempotencyKey = `${provider.name}:${provider.model}:${provider.promptVersion}:invalid:${rawHash}`
    const existing = await withIntakeTransaction(payload, options.executionContext, (req) => findOneDoc(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } }, req))
    if (existing) return terminalResult(existing, null, true)
    const failure = errorPayload(err)
    const createIntake = (req?: Partial<PayloadRequest>) => payload.create({
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
      req,
    })
    const intake = await withIntakeTransaction(payload, options.executionContext, createIntake)
    await options.executionContext?.recordGenerationReferences({ intakeSubmissionId: Number(intake.id) })
    return terminalResult(intake, null, false)
  }

  if (!providerRequest) {
    throw new Error("Generation provider request was not created")
  }

  const existingIntake = await withIntakeTransaction(payload, options.executionContext, (req) => findOneDoc(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } }, req))
  const createIntake = (req?: Partial<PayloadRequest>) => payload.create({
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
    req,
  })
  let intake = existingIntake ?? (await withIntakeTransaction(payload, options.executionContext, createIntake))
  await options.executionContext?.recordGenerationReferences({ intakeSubmissionId: Number(intake.id) })

  intake = await setIntakeStatus(payload, intake, "normalized", { normalized, normalizedHash }, options.executionContext)

  return processStoredIntakeGeneration(payload, {
    intake,
    normalized,
    normalizedHash,
    providerRequest,
    idempotencyKey,
    provider,
    mockFixture,
    maxGenerationAttempts,
    executionContext: options.executionContext,
  })
}

export async function processStoredIntakeSubmission(
  payload: Payload,
  intakeSubmissionId: string | number,
  options: {
    mockFixture?: MockGenerationFixture
    provider?: SiteGenerationProvider
    providerConfig?: SiteGenerationProviderConfig
    maxGenerationAttempts?: number
    executionContext?: BuilderExecutionContext
    retireUnspecifiedPages?: boolean
    pinTenantId?: string | number
  } = {},
): Promise<IntakeProcessingResult> {
  const mockFixture = options.mockFixture ?? "generic"
  const provider = options.provider ?? resolveSiteGenerationProvider({
    ...options.providerConfig,
    mockFixture,
  })
  const maxGenerationAttempts = Math.min(2, Math.max(1, options.maxGenerationAttempts ?? (provider.name === "mock" ? 1 : 2)))

  let intake = await withIntakeTransaction(payload, options.executionContext, (req) => payload.findByID({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    depth: 0,
    overrideAccess: true,
    req,
  }))

  const normalized = NormalizedIntakeSchema.parse(intake.normalized)
  const normalizedHash = hashStableValue(normalized)
  if (intake.normalizedHash && intake.normalizedHash !== normalizedHash) {
    throw new Error("Stored intake normalized hash does not match the normalized intake payload.")
  }

  const providerRequest = createSiteGenerationProviderRequest(normalized)
  const idempotencyKey = [
    "stored",
    intake.id,
    provider.name,
    provider.model,
    provider.promptVersion,
    providerRequest.inputHash,
  ].join(":")

  if (intake.status !== "normalized") {
    intake = await setIntakeStatus(payload, intake, "normalized", { normalized, normalizedHash }, options.executionContext)
  }

  return processStoredIntakeGeneration(payload, {
    intake,
    normalized,
    normalizedHash,
    providerRequest,
    idempotencyKey,
    provider,
    mockFixture,
    maxGenerationAttempts,
    executionContext: options.executionContext,
    retireUnspecifiedPages: options.retireUnspecifiedPages,
    pinTenantId: options.pinTenantId,
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
    executionContext?: BuilderExecutionContext
  } = {},
): Promise<IntakeProcessingResult> {
  const mockFixture = options.mockFixture ?? "generic"
  const provider = options.provider ?? resolveSiteGenerationProvider({
    ...options.providerConfig,
    mockFixture,
  })
  const maxGenerationAttempts = Math.min(2, Math.max(1, options.maxGenerationAttempts ?? (provider.name === "mock" ? 1 : 2)))

  const intake = await withIntakeTransaction(payload, options.executionContext, (req) => payload.findByID({
    collection: "intake-submissions",
    id: intakeSubmissionId,
    depth: 0,
    overrideAccess: true,
    req,
  }))

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
    executionContext: options.executionContext,
  })
}
