import { createHash } from "node:crypto"
import Module from "node:module"
import { pathToFileURL } from "node:url"
import type { Payload } from "payload"
import {
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
} from "@siteinabox/contracts/fixtures/tenants"
import type { PublishedSiteSnapshot, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { OfficialTenantSiteGenerationSpecSchema, formatContractValidationIssues } from "@siteinabox/contracts/generation"

type TenantKey = "amicare"
export type RendererSeedProfile = "staging" | "production"

export type CliOptions = {
  execute: boolean
  profile: RendererSeedProfile
  tenants: TenantKey[]
  approve: boolean
  verifyDomain: boolean
  waivePayment: boolean
  promotePages: boolean
  publish: boolean
  activate: boolean
}

export type RendererSeedFixture = {
  key: TenantKey
  profile: RendererSeedProfile
  profileLabel: string
  label: string
  slug: string
  domain: string
  siteUrl: string
  sourceMediaBaseUrl: string
  importMediaBaseUrl?: string
  mediaBaseNote: string
  sourceSpec: SiteGenerationSpec
  publishedSnapshot: PublishedSiteSnapshot
}

type ApplySiteGenerationSpecFn = typeof import("@/lib/site-generation/applySiteGenerationSpec")["applySiteGenerationSpec"]
type SiteGenerationSpecHashFn = typeof import("@/lib/site-generation/applySiteGenerationSpec")["siteGenerationSpecHash"]
type ApplySiteGenerationSpecResult = Awaited<ReturnType<ApplySiteGenerationSpecFn>>

type ApplySuccessResult = Extract<ApplySiteGenerationSpecResult, { ok: boolean }> & {
  ok: true
  tenantId: string | number
  pageIds: Array<string | number>
  settingsId: string | number
}

const GENERATED_AT = "2026-06-26T00:00:00.000Z"

const fixture = (
  input: Omit<RendererSeedFixture, "siteUrl" | "sourceSpec" | "publishedSnapshot"> & {
    sourceSpec: SiteGenerationSpec
    publishedSnapshot: PublishedSiteSnapshot
    siteUrl?: string
  },
): RendererSeedFixture => ({
  ...input,
  siteUrl: input.siteUrl ?? `https://${input.domain}`,
})

export const RENDERER_SEED_FIXTURES: Record<RendererSeedProfile, Record<TenantKey, RendererSeedFixture>> = {
  staging: {
    amicare: fixture({
      key: "amicare",
      profile: "staging",
      profileLabel: "staging",
      label: "Amicare renderer staging",
      slug: "amicare-renderer",
      domain: "amicare.optidigi.nl",
      sourceMediaBaseUrl: "https://ami-care.nl",
      mediaBaseNote: "Loads legacy Amicare media from ami-care.nl while the staging renderer host stays on optidigi.nl.",
      sourceSpec: amicareSiteGenerationSpec,
      publishedSnapshot: amicarePublishedSiteSnapshot,
    }),
  },
  production: {
    amicare: fixture({
      key: "amicare",
      profile: "production",
      profileLabel: "production live cutover",
      label: "Amicare renderer production live cutover",
      slug: "ami-care",
      domain: "ami-care.nl",
      sourceMediaBaseUrl: "https://ami-care.nl",
      mediaBaseNote: "Uses the current Amicare legacy media origin because no separate durable media host exists yet; validate media after routing before final cutover.",
      sourceSpec: amicareSiteGenerationSpec,
      publishedSnapshot: amicarePublishedSiteSnapshot,
    }),
  },
}

const operatorActor = (profile: RendererSeedProfile) => `renderer-${profile}-bootstrap`
const promptVersion = (profile: RendererSeedProfile) => `renderer-${profile}-bootstrap-v1`

type SiteGenerationHelpers = {
  applySiteGenerationSpec: ApplySiteGenerationSpecFn
  siteGenerationSpecHash: SiteGenerationSpecHashFn
  validateSiteGenerationSpecForCms: typeof import("@/lib/site-generation/applySiteGenerationSpec")["validateSiteGenerationSpecForCms"]
}

type ExecuteHelpers = SiteGenerationHelpers & {
  promoteGenerationRunPages: typeof import("@/lib/site-generation/promoteGenerationRunPages")["promoteGenerationRunPages"]
  activatePublishedSnapshot: typeof import("@/lib/publish/siteSnapshots")["activatePublishedSnapshot"]
  retargetPublishedSiteSnapshot: typeof import("@/lib/publish/retargetSnapshot")["retargetPublishedSiteSnapshot"]
  recordGenerationRunPaymentState: typeof import("@/lib/payments/generationRunPayment")["recordGenerationRunPaymentState"]
}

const installServerOnlyShim = () => {
  const loader = Module as unknown as {
    _load?: (request: string, parent: unknown, isMain: boolean) => unknown
    _siabServerOnlyShimInstalled?: boolean
  }
  if (loader._siabServerOnlyShimInstalled || !loader._load) return
  const originalLoad = loader._load
  loader._load = (request, parent, isMain) => {
    if (request === "server-only" || request.includes("/node_modules/server-only/")) return {}
    return originalLoad(request, parent, isMain)
  }
  loader._siabServerOnlyShimInstalled = true
}

const loadSiteGenerationHelpers = async (): Promise<SiteGenerationHelpers> => {
  installServerOnlyShim()
  const siteGeneration = await import("@/lib/site-generation/applySiteGenerationSpec")
  return {
    applySiteGenerationSpec: siteGeneration.applySiteGenerationSpec,
    siteGenerationSpecHash: siteGeneration.siteGenerationSpecHash,
    validateSiteGenerationSpecForCms: siteGeneration.validateSiteGenerationSpecForCms,
  }
}

const loadExecuteHelpers = async (): Promise<ExecuteHelpers> => {
  installServerOnlyShim()
  const [siteGeneration, promotion, publishing, retargeting, payment] = await Promise.all([
    loadSiteGenerationHelpers(),
    import("@/lib/site-generation/promoteGenerationRunPages"),
    import("@/lib/publish/siteSnapshots"),
    import("@/lib/publish/retargetSnapshot"),
    import("@/lib/payments/generationRunPayment"),
  ])
  return {
    ...siteGeneration,
    promoteGenerationRunPages: promotion.promoteGenerationRunPages,
    activatePublishedSnapshot: publishing.activatePublishedSnapshot,
    retargetPublishedSiteSnapshot: retargeting.retargetPublishedSiteSnapshot,
    recordGenerationRunPaymentState: payment.recordGenerationRunPaymentState,
  }
}

const usage = () => `
Usage:
  pnpm tsx scripts/seed-renderer-staging-tenants.ts [dry-run|--execute] [--profile=staging|production] [--tenant=amicare]

Dry-run is the default. Mutating options require --execute.

Options:
  dry-run, --dry-run Dry-run explicitly. This is also the default.
  --execute          Apply CMS mutations.
  --profile=<name>   Use staging or production profile. Defaults to staging.
  --tenant=<name>    Seed only amicare. Defaults to amicare.
  --approve          Mark the profile generation run approved.
  --verify-domain    Mark the profile tenant domainVerification.status verified.
  --waive-payment    Record an operator payment waiver on the run.
  --promote-pages    Promote approved run pages to published.
  --publish          Publish an immutable renderer snapshot.
  --activate         Publish and activate with manualActivation=true. Requires --publish.
`

export const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    execute: false,
    profile: "staging",
    tenants: ["amicare"],
    approve: false,
    verifyDomain: false,
    waivePayment: false,
    promotePages: false,
    publish: false,
    activate: false,
  }

  for (const arg of argv) {
    if (arg === "--") continue
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim())
      process.exit(0)
    }
    if (arg === "dry-run" || arg === "--dry-run") options.execute = false
    else if (arg === "--execute") options.execute = true
    else if (arg === "--approve") options.approve = true
    else if (arg === "--verify-domain") options.verifyDomain = true
    else if (arg === "--waive-payment") options.waivePayment = true
    else if (arg === "--promote-pages") options.promotePages = true
    else if (arg === "--publish") options.publish = true
    else if (arg === "--activate") options.activate = true
    else if (arg.startsWith("--profile=")) {
      const profile = arg.slice("--profile=".length)
      if (profile !== "staging" && profile !== "production") {
        throw new Error(`Unsupported --profile value "${profile}". Use staging or production.`)
      }
      options.profile = profile
    }
    else if (arg.startsWith("--tenant=")) {
      const tenant = arg.slice("--tenant=".length)
      if (tenant !== "amicare") {
        throw new Error(`Unsupported --tenant value "${tenant}". Use amicare.`)
      }
      options.tenants = [tenant]
    } else {
      throw new Error(`Unknown argument "${arg}".\n${usage().trim()}`)
    }
  }

  if (options.activate && !options.publish) {
    throw new Error("--activate requires --publish so activation uses the newly published snapshot.")
  }
  if (!options.execute) {
    const mutatingFlags = [
      options.approve && "--approve",
      options.verifyDomain && "--verify-domain",
      options.waivePayment && "--waive-payment",
      options.promotePages && "--promote-pages",
      options.publish && "--publish",
      options.activate && "--activate",
    ].filter(Boolean)
    if (mutatingFlags.length > 0) {
      throw new Error(`${mutatingFlags.join(", ")} require --execute.`)
    }
  }

  return options
}

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const stableHash = (value: unknown): string =>
  createHash("sha256").update(stableStringify(value)).digest("hex")

function absolutizeRootRelativeUrl(value: string, baseUrl: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return value
  return new URL(value, baseUrl).toString()
}

function absolutizeGeneratedMediaUrls(value: unknown, baseUrl: string): unknown {
  if (Array.isArray(value)) return value.map((item) => absolutizeGeneratedMediaUrls(item, baseUrl))
  if (!value || typeof value !== "object") return value

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => {
      if (key === "url" && typeof entry === "string") return [key, absolutizeRootRelativeUrl(entry, baseUrl)]
      return [key, absolutizeGeneratedMediaUrls(entry, baseUrl)]
    }),
  )
}

const nextPublishedSnapshotVersion = async (
  payload: Payload,
  tenantId: string | number,
): Promise<number> => {
  const result = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { tenant: { equals: tenantId } },
    sort: "-version",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const latest = result.docs[0] as { version?: number } | undefined
  return Number.isFinite(latest?.version) ? Number(latest!.version) + 1 : 1
}

const requireSuccessfulApplyResult = (
  result: ApplySiteGenerationSpecResult,
  fixture: RendererSeedFixture,
): ApplySuccessResult => {
  if (!result.ok) {
    throw new Error(`${fixture.key} importer rejected the ${fixture.profile} spec: ${JSON.stringify(result.validation.issues, null, 2)}`)
  }
  if (result.tenantId == null || !Array.isArray(result.pageIds) || result.settingsId == null) {
    throw new Error(`${fixture.key} importer succeeded without tenant, page, or settings ids.`)
  }
  return result as ApplySuccessResult
}

const importMediaBaseUrl = (fixture: RendererSeedFixture) => fixture.importMediaBaseUrl ?? fixture.sourceMediaBaseUrl

export const cloneForRendererSeedProfile = (
  fixture: RendererSeedFixture,
  options: { mediaBaseUrl?: string } = {},
): SiteGenerationSpec => {
  const source = structuredClone(fixture.sourceSpec)
  const spec = {
    ...source,
    intake: {
      ...source.intake,
      tenantSlug: fixture.slug,
      primaryDomain: fixture.domain,
      siteUrl: fixture.siteUrl,
      goals: [
        ...(source.intake.goals ?? []),
        `Renderer-hosted ${fixture.profileLabel} bootstrap without tenant source generation`,
      ],
    },
    tenant: {
      ...source.tenant,
      slug: fixture.slug,
      domain: fixture.domain,
      status: "provisioning",
    },
    settings: {
      ...source.settings,
      siteUrl: fixture.siteUrl,
      aliases: [],
    },
    generatedAt: GENERATED_AT,
    generator: {
      ...source.generator,
      name: operatorActor(fixture.profile),
      version: fixture.profile === "production" ? "live-cutover-v1" : "phase-4",
    },
  }
  return absolutizeGeneratedMediaUrls(spec, options.mediaBaseUrl ?? fixture.sourceMediaBaseUrl) as SiteGenerationSpec
}

export const selectRendererSeedFixtures = (options: Pick<CliOptions, "profile" | "tenants">): RendererSeedFixture[] =>
  options.tenants.map((tenant) => RENDERER_SEED_FIXTURES[options.profile][tenant])

export const parseRendererSeedSpecForCms = (
  fixture: RendererSeedFixture,
  spec: SiteGenerationSpec,
  helpers: Pick<SiteGenerationHelpers, "validateSiteGenerationSpecForCms">,
  label = "spec",
): SiteGenerationSpec => {
  const validation = helpers.validateSiteGenerationSpecForCms(spec)
  if (!validation.valid) {
    throw new Error(`${fixture.key} ${fixture.profile} ${label} failed CMS validation: ${JSON.stringify(validation.issues, null, 2)}`)
  }

  const parsed = OfficialTenantSiteGenerationSpecSchema.safeParse(spec)
  if (!parsed.success) {
    throw new Error(`${fixture.key} ${fixture.profile} ${label} failed official tenant contract validation: ${formatContractValidationIssues(parsed.error)}`)
  }

  return parsed.data
}

const findOne = async <T>(
  payload: Payload,
  collection: string,
  where: Record<string, unknown>,
): Promise<T | undefined> => {
  const result = await payload.find({
    collection: collection as any,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return result.docs[0] as T | undefined
}

const transition = (status: string, message: string, at: string) => ({ status, message, at })

const upsertIntakeSubmission = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  spec: SiteGenerationSpec,
  now: string,
) => {
  const idempotencyKey = `renderer-${fixture.profile}:${fixture.key}:intake:v1`
  const normalizedHash = stableHash(spec.intake)
  const data = {
    businessName: spec.intake.businessName,
    contactName: spec.intake.contact?.name ?? null,
    contactEmail: spec.intake.contact?.email ?? spec.settings.contactEmail ?? null,
    source: "operator",
    status: "preview_ready",
    idempotencyKey,
    raw: {
      source: operatorActor(fixture.profile),
      profile: fixture.profile,
      fixture: fixture.key,
      domain: fixture.domain,
      slug: fixture.slug,
      mediaBaseUrl: fixture.sourceMediaBaseUrl,
      importMediaBaseUrl: importMediaBaseUrl(fixture),
    },
    normalized: spec.intake,
    normalizedHash,
    statusTransitions: [
      transition("submitted", `Renderer ${fixture.profileLabel} seed submitted by operator script.`, now),
      transition("preview_ready", `Renderer ${fixture.profileLabel} seed applied to draft CMS data.`, now),
    ],
    error: null,
  }
  const existing = await findOne<any>(payload, "intake-submissions", { idempotencyKey: { equals: idempotencyKey } })
  if (existing) {
    const doc = await payload.update({
      collection: "intake-submissions",
      id: existing.id,
      data,
      depth: 0,
      overrideAccess: true,
    } as any)
    return { doc: doc as any, operation: "updated" as const }
  }
  const doc = await payload.create({
    collection: "intake-submissions",
    data,
    depth: 0,
    overrideAccess: true,
  } as any)
  return { doc: doc as any, operation: "created" as const }
}

const upsertGenerationRun = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  intakeId: string | number,
  spec: SiteGenerationSpec,
  applyResult: ApplySuccessResult,
  specHash: string,
  now: string,
) => {
  const idempotencyKey = `renderer-${fixture.profile}:${fixture.key}:run:v1`
  const normalizedIntakeHash = stableHash(spec.intake)
  const runData: Record<string, unknown> = {
    intakeSubmission: intakeId,
    status: "preview_ready",
    idempotencyKey,
    normalizedIntake: spec.intake,
    normalizedIntakeHash,
    provider: "fixture",
    model: `fixture:${fixture.key}`,
    promptVersion: promptVersion(fixture.profile),
    generationInputHash: normalizedIntakeHash,
    generationInput: {
      profile: fixture.profile,
      fixture: fixture.key,
      domain: fixture.domain,
      slug: fixture.slug,
      siteUrl: fixture.siteUrl,
      mediaBaseUrl: fixture.sourceMediaBaseUrl,
      importMediaBaseUrl: importMediaBaseUrl(fixture),
      mediaBaseNote: fixture.mediaBaseNote,
    },
    generationOutputHash: specHash,
    rawOutput: null,
    parsedOutput: spec,
    generationAttempts: 1,
    mockFixture: fixture.key,
    specHash,
    spec,
    validation: applyResult.validation,
    applyResult,
    tenant: applyResult.tenantId,
    pages: applyResult.pageIds ?? [],
    settings: applyResult.settingsId,
    statusTransitions: [
      transition("queued", `Renderer ${fixture.profileLabel} seed queued by operator script.`, now),
      transition("applying", "Validated SiteGenerationSpec applied through CMS importer.", now),
      transition("preview_ready", "Draft pages/settings are ready for preview and optional publish.", now),
    ],
    startedAt: now,
    completedAt: now,
    errors: null,
  }

  const existing = await findOne<any>(payload, "site-generation-runs", { idempotencyKey: { equals: idempotencyKey } })
  if (existing) {
    const doc = await payload.update({
      collection: "site-generation-runs",
      id: existing.id,
      data: runData,
      depth: 0,
      overrideAccess: true,
    } as any)
    return { doc: doc as any, operation: "updated" as const }
  }
  const doc = await payload.create({
    collection: "site-generation-runs",
    data: runData,
    depth: 0,
    overrideAccess: true,
  } as any)
  return { doc: doc as any, operation: "created" as const }
}

const linkIntake = async (
  payload: Payload,
  intakeId: string | number,
  runId: string | number,
  tenantId: string | number | undefined,
) => {
  await payload.update({
    collection: "intake-submissions",
    id: intakeId as any,
    data: {
      generationRun: runId,
      tenant: tenantId,
    } as any,
    depth: 0,
    overrideAccess: true,
  })
}

const markApproved = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  runId: string | number,
  now: string,
) => {
  await payload.update({
    collection: "site-generation-runs",
    id: runId as any,
    data: {
      clientApproval: {
        status: "approved",
        approvedAt: now,
        source: operatorActor(fixture.profile),
      },
    } as any,
    depth: 0,
    overrideAccess: true,
  })
}

const verifyDomain = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  tenantId: string | number,
  now: string,
) => {
  await payload.update({
    collection: "tenants",
    id: tenantId as any,
    data: {
      domainVerification: {
        status: "verified",
        checkedAt: now,
        notes: `Manually verified for ${fixture.profileLabel} host ${fixture.domain}. DNS/proxy routing remains operator-owned.`,
      },
    } as any,
    depth: 0,
    overrideAccess: true,
  })
}

export const buildRetargetOptionsForRendererSeedFixture = (
  fixture: RendererSeedFixture,
  tenantId: string | number,
  version: number,
  now: string,
) => ({
  tenantId,
  tenantSlug: fixture.slug,
  domain: fixture.domain,
  siteUrl: fixture.siteUrl,
  mediaBaseUrl: fixture.sourceMediaBaseUrl,
  aliases: [],
  manifestVersion: version,
  publishedAt: now,
})

const trimEnvUrl = (value: string | undefined, fallback: string) =>
  (value?.trim() || fallback).replace(/\/+$/, "")

const publicPostHogAnalyticsConfig = (
  fixture: RendererSeedFixture,
  tenantId: string | number,
  version: number,
) => {
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!projectToken) return null

  return {
    enabled: true,
    provider: "posthog" as const,
    consentMode: "required" as const,
    posthogHost: trimEnvUrl(process.env.POSTHOG_PUBLIC_HOST, "https://r.siteinabox.nl"),
    posthogUiHost: trimEnvUrl(process.env.POSTHOG_HOST, "https://eu.posthog.com"),
    posthogProjectToken: projectToken,
    conversionGoals: {
      acceptedForms: true as const,
      contactClicks: [],
    },
    dashboardVisible: true,
    schemaVersion: 1,
    tenantId: String(tenantId),
    tenantSlug: fixture.slug,
    siteId: String(tenantId),
    siteDomain: fixture.domain,
    themeId: null,
    siteBuildId: process.env.SIAB_SITE_BUILD_ID || null,
    manifestVersion: version,
  }
}

const analyticsConsentSettings = () => ({
  enabled: true,
  provider: "posthog" as const,
  consentStorageKey: "siab_cookie_consent_v1",
  consentVersion: "2026-06",
  captureSections: true,
  captureActions: true,
  captureForms: true,
})

const pagePathForSlug = (slug: string | null | undefined) =>
  !slug || slug === "home" || slug === "index" ? "/" : `/${slug}`

export const injectRendererSeedAnalytics = (
  snapshot: PublishedSiteSnapshot,
  fixture: RendererSeedFixture,
  tenantId: string | number,
  version: number,
): PublishedSiteSnapshot => {
  const analytics = publicPostHogAnalyticsConfig(fixture, tenantId, version)
  if (!analytics) return snapshot

  return {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      analytics: {
        ...(snapshot.settings.analytics ?? {}),
        ...analytics,
      },
      analyticsConsent: snapshot.settings.analyticsConsent ?? analyticsConsentSettings(),
    },
    pages: snapshot.pages.map((page) => {
      const pageSlug = page.slug
      const pagePath = pagePathForSlug(pageSlug)
      const existingAnalytics =
        page.analytics && typeof page.analytics === "object" && !Array.isArray(page.analytics)
          ? page.analytics as Record<string, unknown>
          : {}
      return {
        ...page,
        analytics: {
          ...existingAnalytics,
          schemaVersion: 1,
          tenantId: String(tenantId),
          tenantSlug: fixture.slug,
          siteId: String(tenantId),
          siteDomain: fixture.domain,
          pageId: existingAnalytics.pageId ?? null,
          pageSlug,
          pagePath,
          themeId: existingAnalytics.themeId ?? null,
          siteBuildId: process.env.SIAB_SITE_BUILD_ID || existingAnalytics.siteBuildId || null,
          manifestVersion: version,
        },
      }
    }),
  }
}

const createStagingPublishedSnapshot = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  tenantId: string | number,
  generationRunId: string | number,
  helpers: ExecuteHelpers,
  options: CliOptions,
  now: string,
) => {
  const version = await nextPublishedSnapshotVersion(payload, tenantId)
  const snapshot = helpers.retargetPublishedSiteSnapshot(
    fixture.publishedSnapshot,
    buildRetargetOptionsForRendererSeedFixture(fixture, tenantId, version, now),
  )
  const snapshotWithAnalytics = injectRendererSeedAnalytics(snapshot, fixture, tenantId, version)
  const hash = stableHash(snapshotWithAnalytics)
  const snapshotDoc = await payload.create({
    collection: "published-site-snapshots" as any,
    data: {
      tenant: tenantId,
      sourceGenerationRun: generationRunId,
      snapshotKey: `${snapshotWithAnalytics.tenantSlug}-v${version}-${hash.slice(0, 12)}`,
      version,
      status: "drafted",
      domain: snapshotWithAnalytics.domain,
      snapshotHash: hash,
      snapshot: snapshotWithAnalytics,
      publishedAt: snapshotWithAnalytics.publishedAt,
      activationReason: options.activate
        ? `Renderer ${fixture.profileLabel} activation for ${fixture.domain}`
        : `Renderer ${fixture.profileLabel} parity snapshot for ${fixture.domain}`,
    },
    depth: 0,
    overrideAccess: true,
  } as any) as any

  if (!options.activate) return { snapshot: snapshotDoc, activated: false }
  const activated = await helpers.activatePublishedSnapshot(payload, {
    snapshotId: snapshotDoc.id,
    manualActivation: true,
    activationReason: `Renderer ${fixture.profileLabel} activation for ${fixture.domain}`,
  })
  return { snapshot: activated, activated: true }
}

const runFixture = async (
  payload: Payload,
  fixture: RendererSeedFixture,
  options: CliOptions,
  helpers: SiteGenerationHelpers | ExecuteHelpers,
) => {
  const spec = cloneForRendererSeedProfile(fixture)
  const parsedSpec = parseRendererSeedSpecForCms(fixture, spec, helpers)
  const specHash = helpers.siteGenerationSpecHash(parsedSpec)

  console.log("")
  console.log(`[plan] ${fixture.label}`)
  console.log(`  profile: ${fixture.profile}`)
  console.log(`  slug: ${fixture.slug}`)
  console.log(`  domain: ${fixture.domain}`)
  console.log(`  siteUrl: ${spec.settings.siteUrl}`)
  console.log(`  mediaBaseUrl: ${fixture.sourceMediaBaseUrl}`)
  if (importMediaBaseUrl(fixture) !== fixture.sourceMediaBaseUrl) {
    console.log(`  importMediaBaseUrl: ${importMediaBaseUrl(fixture)}`)
  }
  console.log(`  mediaNote: ${fixture.mediaBaseNote}`)
  console.log(`  pages: ${spec.pages.map((page) => page.slug).join(", ")}`)
  console.log(`  specHash: ${specHash}`)
  console.log(`  actions: import draft CMS data, upsert intake, upsert generation run`)
  if (options.approve) console.log("           mark run approved")
  if (options.verifyDomain) console.log(`           mark ${fixture.profile} domain verified`)
  if (options.waivePayment) console.log("           waive payment gate")
  if (options.promotePages) console.log("           promote run pages")
  if (options.publish) console.log("           publish retargeted migrated parity snapshot fixture")
  if (options.activate) console.log("           activate published snapshot with manualActivation=true")

  if (!options.execute) return
  const executeHelpers = helpers as ExecuteHelpers

  const now = new Date().toISOString()
  const intake = await upsertIntakeSubmission(payload, fixture, parsedSpec, now)
  const importSpec = importMediaBaseUrl(fixture) === fixture.sourceMediaBaseUrl
    ? parsedSpec
    : cloneForRendererSeedProfile(fixture, { mediaBaseUrl: importMediaBaseUrl(fixture) })
  const importParsedSpec = parseRendererSeedSpecForCms(fixture, importSpec, helpers, "import spec")
  const applyResult = await helpers.applySiteGenerationSpec(payload, importParsedSpec)
  const successfulApplyResult = requireSuccessfulApplyResult(applyResult, fixture)
  const run = await upsertGenerationRun(payload, fixture, intake.doc.id, parsedSpec, successfulApplyResult, specHash, now)
  await linkIntake(payload, intake.doc.id, run.doc.id, successfulApplyResult.tenantId)

  if (options.approve) await markApproved(payload, fixture, run.doc.id, now)
  if (options.verifyDomain) {
    await verifyDomain(payload, fixture, successfulApplyResult.tenantId, now)
  }
  if (options.waivePayment) {
    await executeHelpers.recordGenerationRunPaymentState(payload, run.doc.id, {
      status: "waived",
      actor: operatorActor(fixture.profile),
      provider: "manual",
      note: `Renderer ${fixture.profileLabel} bootstrap waiver.`,
      now,
    })
  }
  if (options.promotePages) {
    await executeHelpers.promoteGenerationRunPages(payload, run.doc.id, { promotedBy: operatorActor(fixture.profile) })
  }
  if (options.publish) {
    const result = await createStagingPublishedSnapshot(
      payload,
      fixture,
      successfulApplyResult.tenantId,
      run.doc.id,
      executeHelpers,
      options,
      now,
    )
    const snapshotId = (result.snapshot as any)?.id
    console.log(`  snapshot: ${snapshotId ?? "(unknown)"}${result.activated ? " activated" : " drafted"}`)
  }

  console.log(`  result: intake ${intake.operation} id=${intake.doc.id}; run ${run.operation} id=${run.doc.id}; tenant id=${successfulApplyResult.tenantId}`)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  console.log(options.execute ? "[mode] execute" : "[mode] dry-run")
  console.log(`[profile] ${options.profile}`)
  if (!options.execute) {
    console.log("[mode] no CMS mutations will be performed; pass --execute to apply.")
  }

  const fixtures = selectRendererSeedFixtures(options)
  if (!options.execute) {
    const helpers = await loadSiteGenerationHelpers()
    for (const fixture of fixtures) await runFixture({} as Payload, fixture, options, helpers)
    return
  }

  installServerOnlyShim()
  await import("dotenv/config")
  const helpers = await loadExecuteHelpers()
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  const payload = await getPayload({ config })
  try {
    for (const fixture of fixtures) await runFixture(payload, fixture, options, helpers)
  } finally {
    await payload.db.destroy?.()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
