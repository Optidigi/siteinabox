import { createHash } from "node:crypto"
import Module from "node:module"
import type { Payload } from "payload"
import {
  amblastPublishedSiteSnapshot,
  amblastSiteGenerationSpec,
  amicarePublishedSiteSnapshot,
  amicareSiteGenerationSpec,
} from "@siteinabox/contracts/fixtures/tenants"
import type { PublishedSiteSnapshot, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import { SiteGenerationSpecSchema, formatContractValidationIssues } from "@siteinabox/contracts/generation"

type TenantKey = "amicare" | "amblast"

type CliOptions = {
  execute: boolean
  tenants: TenantKey[]
  approve: boolean
  verifyDomain: boolean
  waivePayment: boolean
  promotePages: boolean
  publish: boolean
  activate: boolean
}

type StagingFixture = {
  key: TenantKey
  label: string
  slug: string
  domain: string
  sourceMediaBaseUrl: string
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

const STAGING_FIXTURES: Record<TenantKey, StagingFixture> = {
  amicare: {
    key: "amicare",
    label: "Amicare renderer staging",
    slug: "amicare-renderer",
    domain: "amicare.optidigi.nl",
    sourceMediaBaseUrl: "https://ami-care.nl",
    sourceSpec: amicareSiteGenerationSpec,
    publishedSnapshot: amicarePublishedSiteSnapshot,
  },
  amblast: {
    key: "amblast",
    label: "Amblast renderer staging",
    slug: "amblast-renderer",
    domain: "amblast.optidigi.nl",
    sourceMediaBaseUrl: "https://amblast.siteinabox.nl",
    sourceSpec: amblastSiteGenerationSpec,
    publishedSnapshot: amblastPublishedSiteSnapshot,
  },
}

const OPERATOR_ACTOR = "renderer-staging-bootstrap"
const PROMPT_VERSION = "renderer-staging-bootstrap-v1"
const STAGING_GENERATED_AT = "2026-06-26T00:00:00.000Z"

type SiteGenerationHelpers = {
  applySiteGenerationSpec: ApplySiteGenerationSpecFn
  siteGenerationSpecHash: SiteGenerationSpecHashFn
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
  pnpm tsx scripts/seed-renderer-staging-tenants.ts [dry-run|--execute] [--tenant=amicare|amblast]

Dry-run is the default. Mutating options require --execute.

Options:
  dry-run, --dry-run Dry-run explicitly. This is also the default.
  --execute          Apply CMS mutations.
  --tenant=<name>    Seed only amicare or amblast. Defaults to both.
  --approve          Mark the staging generation run approved.
  --verify-domain    Mark the staging tenant domainVerification.status verified.
  --waive-payment    Record an operator payment waiver on the run.
  --promote-pages    Promote approved run pages to published.
  --publish          Publish an immutable renderer snapshot.
  --activate         Publish and activate with manualActivation=true. Requires --publish.
`

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    execute: false,
    tenants: ["amicare", "amblast"],
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
    else if (arg.startsWith("--tenant=")) {
      const tenant = arg.slice("--tenant=".length)
      if (tenant !== "amicare" && tenant !== "amblast") {
        throw new Error(`Unsupported --tenant value "${tenant}". Use amicare or amblast.`)
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
  fixtureKey: TenantKey,
): ApplySuccessResult => {
  if (!result.ok) {
    throw new Error(`${fixtureKey} importer rejected the staging spec: ${JSON.stringify(result.validation.issues, null, 2)}`)
  }
  if (result.tenantId == null || !Array.isArray(result.pageIds) || result.settingsId == null) {
    throw new Error(`${fixtureKey} importer succeeded without tenant, page, or settings ids.`)
  }
  return result as ApplySuccessResult
}

const cloneForStaging = (fixture: StagingFixture): SiteGenerationSpec => {
  const source = structuredClone(fixture.sourceSpec)
  const siteUrl = `https://${fixture.domain}`
  const spec = {
    ...source,
    intake: {
      ...source.intake,
      tenantSlug: fixture.slug,
      primaryDomain: fixture.domain,
      siteUrl,
      goals: [
        ...(source.intake.goals ?? []),
        "Renderer-hosted staging bootstrap without tenant source generation",
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
      siteUrl,
      aliases: [],
    },
    generatedAt: STAGING_GENERATED_AT,
    generator: {
      ...source.generator,
      name: "renderer-staging-bootstrap",
      version: "phase-4",
    },
  }
  return absolutizeGeneratedMediaUrls(spec, fixture.sourceMediaBaseUrl) as SiteGenerationSpec
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
  fixture: StagingFixture,
  spec: SiteGenerationSpec,
  now: string,
) => {
  const idempotencyKey = `renderer-staging:${fixture.key}:intake:v1`
  const normalizedHash = stableHash(spec.intake)
  const data = {
    businessName: spec.intake.businessName,
    contactName: spec.intake.contact?.name ?? null,
    contactEmail: spec.intake.contact?.email ?? spec.settings.contactEmail ?? null,
    source: "operator",
    status: "preview_ready",
    idempotencyKey,
    raw: {
      source: "renderer-staging-bootstrap",
      fixture: fixture.key,
      domain: fixture.domain,
      slug: fixture.slug,
    },
    normalized: spec.intake,
    normalizedHash,
    statusTransitions: [
      transition("submitted", "Renderer staging seed submitted by operator script.", now),
      transition("preview_ready", "Renderer staging seed applied to draft CMS data.", now),
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
  fixture: StagingFixture,
  intakeId: string | number,
  spec: SiteGenerationSpec,
  applyResult: ApplySuccessResult,
  specHash: string,
  now: string,
) => {
  const idempotencyKey = `renderer-staging:${fixture.key}:run:v1`
  const normalizedIntakeHash = stableHash(spec.intake)
  const runData: Record<string, unknown> = {
    intakeSubmission: intakeId,
    status: "preview_ready",
    idempotencyKey,
    normalizedIntake: spec.intake,
    normalizedIntakeHash,
    provider: "fixture",
    model: `fixture:${fixture.key}`,
    promptVersion: PROMPT_VERSION,
    generationInputHash: normalizedIntakeHash,
    generationInput: {
      fixture: fixture.key,
      stagingDomain: fixture.domain,
      stagingSlug: fixture.slug,
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
      transition("queued", "Renderer staging seed queued by operator script.", now),
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

const markApproved = async (payload: Payload, runId: string | number, now: string) => {
  await payload.update({
    collection: "site-generation-runs",
    id: runId as any,
    data: {
      clientApproval: {
        status: "approved",
        approvedAt: now,
        source: "renderer-staging-bootstrap",
      },
    } as any,
    depth: 0,
    overrideAccess: true,
  })
}

const verifyDomain = async (
  payload: Payload,
  tenantId: string | number,
  domain: string,
  now: string,
) => {
  await payload.update({
    collection: "tenants",
    id: tenantId as any,
    data: {
      domainVerification: {
        status: "verified",
        checkedAt: now,
        notes: `Manually verified for renderer staging host ${domain}. DNS/proxy routing remains operator-owned.`,
      },
    } as any,
    depth: 0,
    overrideAccess: true,
  })
}

const createStagingPublishedSnapshot = async (
  payload: Payload,
  fixture: StagingFixture,
  tenantId: string | number,
  generationRunId: string | number,
  helpers: ExecuteHelpers,
  options: CliOptions,
  now: string,
) => {
  const version = await nextPublishedSnapshotVersion(payload, tenantId)
  const snapshot = helpers.retargetPublishedSiteSnapshot(fixture.publishedSnapshot, {
    tenantId,
    tenantSlug: fixture.slug,
    domain: fixture.domain,
    siteUrl: `https://${fixture.domain}`,
    mediaBaseUrl: fixture.sourceMediaBaseUrl,
    aliases: [],
    manifestVersion: version,
    publishedAt: now,
  })
  const hash = stableHash(snapshot)
  const snapshotDoc = await payload.create({
    collection: "published-site-snapshots" as any,
    data: {
      tenant: tenantId,
      sourceGenerationRun: generationRunId,
      snapshotKey: `${snapshot.tenantSlug}-v${version}-${hash.slice(0, 12)}`,
      version,
      status: "drafted",
      domain: snapshot.domain,
      snapshotHash: hash,
      snapshot,
      publishedAt: snapshot.publishedAt,
      activationReason: options.activate
        ? `Renderer staging activation for ${fixture.domain}`
        : `Renderer staging parity snapshot for ${fixture.domain}`,
    },
    depth: 0,
    overrideAccess: true,
  } as any) as any

  if (!options.activate) return { snapshot: snapshotDoc, activated: false }
  const activated = await helpers.activatePublishedSnapshot(payload, {
    snapshotId: snapshotDoc.id,
    manualActivation: true,
    activationReason: `Renderer staging activation for ${fixture.domain}`,
  })
  return { snapshot: activated, activated: true }
}

const runFixture = async (
  payload: Payload,
  fixture: StagingFixture,
  options: CliOptions,
  helpers: SiteGenerationHelpers | ExecuteHelpers,
) => {
  const spec = cloneForStaging(fixture)
  const parsed = SiteGenerationSpecSchema.safeParse(spec)
  if (!parsed.success) {
    throw new Error(`${fixture.key} staging spec failed validation: ${formatContractValidationIssues(parsed.error)}`)
  }
  const specHash = helpers.siteGenerationSpecHash(parsed.data)

  console.log("")
  console.log(`[plan] ${fixture.label}`)
  console.log(`  slug: ${fixture.slug}`)
  console.log(`  domain: ${fixture.domain}`)
  console.log(`  siteUrl: ${spec.settings.siteUrl}`)
  console.log(`  pages: ${spec.pages.map((page) => page.slug).join(", ")}`)
  console.log(`  specHash: ${specHash}`)
  console.log(`  actions: import draft CMS data, upsert intake, upsert generation run`)
  if (options.approve) console.log("           mark run approved")
  if (options.verifyDomain) console.log("           mark staging domain verified")
  if (options.waivePayment) console.log("           waive payment gate")
  if (options.promotePages) console.log("           promote run pages")
  if (options.publish) console.log("           publish retargeted migrated parity snapshot fixture")
  if (options.activate) console.log("           activate published snapshot with manualActivation=true")

  if (!options.execute) return
  const executeHelpers = helpers as ExecuteHelpers

  const now = new Date().toISOString()
  const intake = await upsertIntakeSubmission(payload, fixture, parsed.data, now)
  const applyResult = await helpers.applySiteGenerationSpec(payload, parsed.data)
  const successfulApplyResult = requireSuccessfulApplyResult(applyResult, fixture.key)
  const run = await upsertGenerationRun(payload, fixture, intake.doc.id, parsed.data, successfulApplyResult, specHash, now)
  await linkIntake(payload, intake.doc.id, run.doc.id, successfulApplyResult.tenantId)

  if (options.approve) await markApproved(payload, run.doc.id, now)
  if (options.verifyDomain) {
    await verifyDomain(payload, successfulApplyResult.tenantId, fixture.domain, now)
  }
  if (options.waivePayment) {
    await executeHelpers.recordGenerationRunPaymentState(payload, run.doc.id, {
      status: "waived",
      actor: OPERATOR_ACTOR,
      provider: "manual",
      note: "Renderer staging bootstrap waiver.",
      now,
    })
  }
  if (options.promotePages) {
    await executeHelpers.promoteGenerationRunPages(payload, run.doc.id, { promotedBy: OPERATOR_ACTOR })
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
  if (!options.execute) {
    console.log("[mode] no CMS mutations will be performed; pass --execute to apply.")
  }

  const fixtures = options.tenants.map((tenant) => STAGING_FIXTURES[tenant])
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

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
