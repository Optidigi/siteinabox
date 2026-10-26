import "server-only"
import {
  parseMicrosoftMailProvisioningRequest,
  type MicrosoftMailProvisioningRequest,
} from "./model.ts"
import {
  assertMicrosoftMailStateTransition,
  createMicrosoftMailProvisioningKey,
  type MicrosoftMailProvisioningState,
} from "./state.ts"

export type MicrosoftMailProvisioningStep =
  | "tenant_bootstrap"
  | "mca_acceptance"
  | "gdap"
  | "application_consent"
  | "subscription"
  | "domain_verification"
  | "info_forward"
  | "dkim_prepare"
  | "dns_prepare"
  | "mailbox_users"
  | "dns_cutover"
  | "dkim_enable"
  | "setup_email"

export type MicrosoftMailStepOutcome =
  | { kind: "complete"; data?: Record<string, unknown> }
  | { kind: "waiting"; code: string; state: MicrosoftMailProvisioningState; actionUrl?: string; message: string; data?: Record<string, unknown> }
  | { kind: "manual_review"; code: string }

export type MicrosoftMailProvisioningRun = {
  id: string | number
  idempotencyKey: string
  mode: "mock" | "live"
  tenantId: number
  domain: string
  tenantPrefix: string
  request: MicrosoftMailProvisioningRequest
  state: MicrosoftMailProvisioningState
  currentStep: MicrosoftMailProvisioningStep | null
  completedSteps: MicrosoftMailProvisioningStep[]
  data: Record<string, unknown>
  actionUrl: string | null
  issueCode: string | null
  createdAt: string
  updatedAt: string
}

export type MicrosoftMailProvisioningRunCreate = Omit<MicrosoftMailProvisioningRun, "id">

export type MicrosoftMailProvisioningStore = {
  findByIdempotencyKey(key: string): Promise<MicrosoftMailProvisioningRun | null>
  create(input: MicrosoftMailProvisioningRunCreate): Promise<MicrosoftMailProvisioningRun>
  update(
    id: string | number,
    patch: Partial<MicrosoftMailProvisioningRun>,
  ): Promise<MicrosoftMailProvisioningRun>
  get(id: string | number): Promise<MicrosoftMailProvisioningRun | null>
}

export type MicrosoftMailProvisioningContext = {
  run: MicrosoftMailProvisioningRun
  request: MicrosoftMailProvisioningRequest
}

export type MicrosoftMailProvisioningPorts = Record<
  Exclude<MicrosoftMailProvisioningStep, "setup_email">,
  (context: MicrosoftMailProvisioningContext) => Promise<MicrosoftMailStepOutcome>
> & {
  sendSetupEmail: (input: MicrosoftMailProvisioningContext & {
    user: MicrosoftMailProvisioningRequest["mailboxUsers"][number]
  }) => Promise<MicrosoftMailStepOutcome>
}

export class MicrosoftMailProvisioningInputError extends Error {
  readonly issues: Array<{ code: string; message: string; index?: number }>

  constructor(issues: MicrosoftMailProvisioningInputError["issues"]) {
    super("Microsoft mail provisioning request is invalid.")
    this.name = "MicrosoftMailProvisioningInputError"
    this.issues = issues
  }
}

export class MicrosoftMailProvisioningRunNotFoundError extends Error {
  constructor() {
    super("Microsoft mail provisioning run was not found.")
    this.name = "MicrosoftMailProvisioningRunNotFoundError"
  }
}

const steps: readonly MicrosoftMailProvisioningStep[] = [
  "tenant_bootstrap",
  "subscription",
  "mca_acceptance",
  "gdap",
  "application_consent",
  "domain_verification",
  "dkim_prepare",
  "dns_prepare",
  "mailbox_users",
  "info_forward",
  "dns_cutover",
  "dkim_enable",
  "setup_email",
]

const pendingStateFor: Record<MicrosoftMailProvisioningStep, MicrosoftMailProvisioningState> = {
  tenant_bootstrap: "tenant_pending",
  mca_acceptance: "consent_pending",
  gdap: "consent_pending",
  application_consent: "consent_pending",
  subscription: "subscription_pending",
  domain_verification: "domain_pending",
  info_forward: "exchange_pending",
  dkim_prepare: "exchange_pending",
  dns_prepare: "dns_pending",
  mailbox_users: "mailboxes_pending",
  dns_cutover: "dns_pending",
  dkim_enable: "exchange_pending",
  setup_email: "setup_mail_pending",
}

const appendStep = (
  existing: readonly MicrosoftMailProvisioningStep[],
  step: MicrosoftMailProvisioningStep,
): MicrosoftMailProvisioningStep[] => existing.includes(step)
  ? [...existing]
  : [...existing, step]

const deliveryStates = (data: Record<string, unknown>): Record<string, string> => {
  const value = data.setupEmailStates
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, string>
    : {}
}

const providerStepStates = (data: Record<string, unknown>): Record<string, string> => {
  const value = data.providerStepStates
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, string>
    : {}
}

const clearDeliveredSetupEmails = (
  request: MicrosoftMailProvisioningRequest,
  states: Record<string, string>,
): MicrosoftMailProvisioningRequest => ({
  ...request,
  mailboxUsers: request.mailboxUsers.map((user) =>
    states[user.userPrincipalName] === "sent"
      ? { ...user, setupEmail: "" }
      : user),
})

const safeIssueCode = (error: unknown): string => {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return /^[a-z0-9_.-]{1,80}$/i.test(error.code) ? error.code : "provider_error"
  }
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return /^[A-Za-z0-9_.-]{1,80}$/.test(error.name) ? error.name : "provider_error"
  }
  return "provider_error"
}

const isIndeterminateWrite = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "name" in error && typeof error.name === "string" &&
    /Indeterminate(?:Write)?Error$/.test(error.name))

export async function startMicrosoftMailProvisioning(input: {
  request: unknown
  store: MicrosoftMailProvisioningStore
  ports: MicrosoftMailProvisioningPorts
  mode: "mock" | "live"
  confirmRealOrder?: boolean
  now?: () => Date
}): Promise<MicrosoftMailProvisioningRun> {
  const parsed = parseMicrosoftMailProvisioningRequest(input.request)
  if (!parsed.ok) throw new MicrosoftMailProvisioningInputError(parsed.issues)
  if (input.mode === "live" && input.confirmRealOrder !== true) {
    throw new Error("Live provisioning requires explicit confirmation of the billable Pax8 order.")
  }

  const request = parsed.value
  const idempotencyKey = `${createMicrosoftMailProvisioningKey({
    tenantId: request.tenantId,
    domain: request.domain,
    mailboxAddresses: request.mailboxUsers.map((user) => user.userPrincipalName),
    product: request.product,
  })}:${input.mode}`
  const existing = await input.store.findByIdempotencyKey(idempotencyKey)
  if (existing) {
    if (["ready", "manual_review", "failed", "cancelled"].includes(existing.state)) return existing
    return advanceMicrosoftMailProvisioning({
      run: existing,
      store: input.store,
      ports: input.ports,
      now: input.now,
    })
  }

  const now = input.now ?? (() => new Date())
  const created = await input.store.create({
    idempotencyKey,
    mode: input.mode,
    tenantId: request.tenantId,
    domain: request.domain,
    tenantPrefix: request.tenantPrefix,
    request,
    state: "prepared",
    currentStep: null,
    completedSteps: [],
    data: {},
    actionUrl: null,
    issueCode: null,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  })
  return advanceMicrosoftMailProvisioning({
    run: created,
    store: input.store,
    ports: input.ports,
    now,
  })
}

export async function advanceMicrosoftMailProvisioning(input: {
  run: MicrosoftMailProvisioningRun
  store: MicrosoftMailProvisioningStore
  ports: MicrosoftMailProvisioningPorts
  now?: () => Date
}): Promise<MicrosoftMailProvisioningRun> {
  const now = input.now ?? (() => new Date())
  let run = input.run
  if (["ready", "manual_review", "failed", "cancelled"].includes(run.state)) return run

  for (const step of steps) {
    if (run.completedSteps.includes(step)) continue
    const priorStepState = providerStepStates(run.data)[step]
    if (priorStepState === "started" || priorStepState === "uncertain") {
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        issueCode: "provider_step_outcome_unknown",
        updatedAt: now().toISOString(),
      })
    }
    if (step === "setup_email") {
      const states = deliveryStates(run.data)
      const uncertain = Object.values(states).some((state) => state === "sending" || state === "manual_review")
      if (uncertain) {
        return input.store.update(run.id, {
          state: transition(run.state, "manual_review"),
          currentStep: step,
          issueCode: "setup_mail_outcome_unknown",
          updatedAt: now().toISOString(),
        })
      }
    }

    run = await input.store.update(run.id, {
      state: transition(run.state, pendingStateFor[step]),
      currentStep: step,
      actionUrl: null,
      issueCode: null,
      data: { ...run.data, providerStepStates: { ...providerStepStates(run.data), [step]: "started" } },
      updatedAt: now().toISOString(),
    })

    if (step === "setup_email") {
      const sent = await sendSetupEmails({ ...input, run, now })
      if (!sent.completedSteps.includes("setup_email")) return sent
      run = sent
      continue
    }

    let outcome: MicrosoftMailStepOutcome
    try {
      outcome = await input.ports[step]({ run, request: run.request })
    } catch (error) {
      if (error instanceof Error && (error.name === "MicrosoftTokenRequestError" || /MICROSOFT_PARTNER_RECONNECT_REQUIRED/.test(error.message))) {
        return input.store.update(run.id, {
          state: run.state,
          data: { ...run.data, providerStepStates: { ...providerStepStates(run.data), [step]: "waiting" } },
          issueCode: "MICROSOFT_PARTNER_CONNECTION_REQUIRED", updatedAt: now().toISOString(),
        })
      }
      const manual = isIndeterminateWrite(error)
      return input.store.update(run.id, {
        state: transition(run.state, manual ? "manual_review" : "failed"),
        data: { ...run.data, providerStepStates: { ...providerStepStates(run.data), [step]: manual ? "uncertain" : "failed" } },
        issueCode: safeIssueCode(error),
        updatedAt: now().toISOString(),
      })
    }
    if (outcome.kind === "waiting") {
      return input.store.update(run.id, {
        state: transition(run.state, outcome.state),
        data: {
          ...run.data,
          providerStepStates: { ...providerStepStates(run.data), [step]: "waiting" },
          ...(outcome.data ?? {}),
        },
        actionUrl: outcome.actionUrl ?? null,
        issueCode: outcome.code,
        updatedAt: now().toISOString(),
      })
    }
    if (outcome.kind === "manual_review") {
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        data: { ...run.data, providerStepStates: { ...providerStepStates(run.data), [step]: "uncertain" } },
        issueCode: outcome.code,
        updatedAt: now().toISOString(),
      })
    }
    run = await input.store.update(run.id, {
      completedSteps: appendStep(run.completedSteps, step),
      data: {
        ...run.data,
        providerStepStates: { ...providerStepStates(run.data), [step]: "completed" },
        ...(outcome.data ?? {}),
      },
      updatedAt: now().toISOString(),
    })
  }

  return input.store.update(run.id, {
    state: transition(run.state, "ready"),
    currentStep: null,
    actionUrl: null,
    issueCode: null,
    updatedAt: now().toISOString(),
  })
}

const sendSetupEmails = async (input: {
  run: MicrosoftMailProvisioningRun
  store: MicrosoftMailProvisioningStore
  ports: MicrosoftMailProvisioningPorts
  now: () => Date
}): Promise<MicrosoftMailProvisioningRun> => {
  let run = input.run
  let states = deliveryStates(run.data)
  for (const user of run.request.mailboxUsers) {
    if (states[user.userPrincipalName] === "sent") continue
    if (states[user.userPrincipalName] === "sending" || states[user.userPrincipalName] === "manual_review") {
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        issueCode: "setup_mail_outcome_unknown",
        updatedAt: input.now().toISOString(),
      })
    }
    if (!user.setupEmail) {
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        issueCode: "setup_mail_recipient_missing",
        updatedAt: input.now().toISOString(),
      })
    }

    states = { ...states, [user.userPrincipalName]: "sending" }
    run = await input.store.update(run.id, {
      data: { ...run.data, setupEmailStates: states },
      updatedAt: input.now().toISOString(),
    })

    let outcome: MicrosoftMailStepOutcome
    try {
      outcome = await input.ports.sendSetupEmail({
        run,
        request: run.request,
        user,
      })
    } catch (error) {
      states = { ...states, [user.userPrincipalName]: "manual_review" }
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        data: { ...run.data, setupEmailStates: states },
        issueCode: isIndeterminateWrite(error) ? "setup_mail_outcome_unknown" : safeIssueCode(error),
        updatedAt: input.now().toISOString(),
      })
    }
    if (outcome.kind !== "complete") {
      states = { ...states, [user.userPrincipalName]: "manual_review" }
      return input.store.update(run.id, {
        state: transition(run.state, "manual_review"),
        data: { ...run.data, setupEmailStates: states },
        issueCode: outcome.kind === "manual_review" ? outcome.code : "setup_mail_pending_review",
        updatedAt: input.now().toISOString(),
      })
    }

    states = { ...states, ...deliveryStates(outcome.data ?? {}), [user.userPrincipalName]: "sent" }
    const request = clearDeliveredSetupEmails(run.request, states)
    run = await input.store.update(run.id, {
      request,
      data: { ...run.data, ...(outcome.data ?? {}), setupEmailStates: states },
      updatedAt: input.now().toISOString(),
    })
  }
  return input.store.update(run.id, {
    completedSteps: appendStep(run.completedSteps, "setup_email"),
    updatedAt: input.now().toISOString(),
  })
}

const transition = (
  current: MicrosoftMailProvisioningState,
  next: MicrosoftMailProvisioningState,
): MicrosoftMailProvisioningState => current === next
  ? current
  : assertMicrosoftMailStateTransition(current, next)
