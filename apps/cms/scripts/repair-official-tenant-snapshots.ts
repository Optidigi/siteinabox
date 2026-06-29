import { createHash } from "node:crypto"
import Module from "node:module"
import { pathToFileURL } from "node:url"
import type { Payload } from "payload"
import { isOfficialTenant } from "@/lib/officialTenants"
import { relationshipId } from "@/lib/relationshipId"

type TenantKey = "amicare"

type CliOptions = {
  apply: boolean
  tenants: TenantKey[]
}

type OfficialTarget = {
  key: TenantKey
  label: string
  canonicalId: number
  slugs: string[]
  domains: string[]
}

type PublishHelpers = {
  buildPublishedSiteSnapshot: typeof import("@/lib/publish/siteSnapshots")["buildPublishedSiteSnapshot"]
  publishSiteSnapshot: typeof import("@/lib/publish/siteSnapshots")["publishSiteSnapshot"]
  resolvePublishedSnapshotByHost: typeof import("@/lib/publish/siteSnapshots")["resolvePublishedSnapshotByHost"]
}

const TARGETS: Record<TenantKey, OfficialTarget> = {
  amicare: {
    key: "amicare",
    label: "Amicare",
    canonicalId: 1,
    slugs: ["ami-care", "amicare", "amicare-zorg", "tenant-amicare"],
    domains: ["ami-care.nl", "amicare.nl"],
  },
}

const usage = () => `
Usage from apps/cms:
  pnpm exec tsx scripts/repair-official-tenant-snapshots.ts
  pnpm exec tsx scripts/repair-official-tenant-snapshots.ts --tenant=ami-care
  pnpm exec tsx scripts/repair-official-tenant-snapshots.ts --apply

Dry-run is the default. --apply publishes and activates from current CMS tenant,
page, and site-settings rows through publishSiteSnapshot.
`

export function parseArgs(argv = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {
    apply: false,
    tenants: ["amicare"],
  }

  for (const arg of argv) {
    if (arg === "--") {
      continue
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage().trim())
      process.exit(0)
    } else if (arg === "--apply") {
      options.apply = true
    } else if (arg === "--dry-run" || arg === "dry-run") {
      options.apply = false
    } else if (arg.startsWith("--tenant=")) {
      const raw = arg.slice("--tenant=".length).trim().toLowerCase()
      if (raw === "ami-care" || raw === "amicare") options.tenants = ["amicare"]
      else throw new Error(`Unsupported --tenant value "${raw}". Use ami-care.`)
    } else {
      throw new Error(`Unknown argument "${arg}".\n${usage().trim()}`)
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

export const themeHash = (theme: unknown): string => stableHash(theme ?? null)

const normalizeHost = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")

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

const loadPublishHelpers = async (): Promise<PublishHelpers> => {
  installServerOnlyShim()
  const publishing = await import("@/lib/publish/siteSnapshots")
  return {
    buildPublishedSiteSnapshot: publishing.buildPublishedSiteSnapshot,
    publishSiteSnapshot: publishing.publishSiteSnapshot,
    resolvePublishedSnapshotByHost: publishing.resolvePublishedSnapshotByHost,
  }
}

const findByField = async (payload: Payload, field: "slug" | "domain", values: string[]) => {
  const docs = []
  for (const value of values) {
    const result = await payload.find({
      collection: "tenants",
      where: { [field]: { equals: value } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    } as any)
    docs.push(...(result.docs as any[]))
  }
  return docs
}

async function resolveTargetTenant(payload: Payload, target: OfficialTarget) {
  const matches = [
    ...(await findByField(payload, "slug", target.slugs)),
    ...(await findByField(payload, "domain", target.domains)),
  ]
  try {
    matches.push(await payload.findByID({
      collection: "tenants",
      id: target.canonicalId as any,
      depth: 0,
      overrideAccess: true,
    }) as any)
  } catch {
    // Canonical id fallback is optional after slug/domain lookup.
  }

  const byId = new Map(matches.filter(Boolean).map((tenant: any) => [String(tenant.id), tenant]))
  const tenants = [...byId.values()]
  if (tenants.length !== 1) {
    const summary = tenants.map((tenant: any) => `${tenant.id}:${tenant.slug}:${tenant.domain}`).join(", ") || "none"
    throw new Error(`${target.label} source-of-truth tenant lookup is ambiguous: ${summary}`)
  }
  const tenant = tenants[0] as any
  if (!isOfficialTenant(tenant)) {
    throw new Error(`${target.label} target ${tenant.id}:${tenant.slug}:${tenant.domain} is not an official tenant.`)
  }
  if (Number(tenant.id) !== target.canonicalId) {
    throw new Error(`${target.label} resolved tenant id ${tenant.id}; run after canonicalization to canonical id ${target.canonicalId}.`)
  }
  return tenant
}

async function requireCurrentCmsSource(payload: Payload, tenant: any, target: OfficialTarget) {
  const [settings, pages] = await Promise.all([
    payload.find({
      collection: "site-settings",
      where: { tenant: { equals: tenant.id } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    } as any),
    payload.find({
      collection: "pages",
      where: { and: [{ tenant: { equals: tenant.id } }, { status: { equals: "published" } }] },
      sort: "slug",
      limit: 200,
      depth: 0,
      overrideAccess: true,
    } as any),
  ])

  if (settings.docs.length !== 1) {
    throw new Error(`${target.label} requires exactly one site-settings row; found ${settings.docs.length}.`)
  }
  if (pages.docs.length === 0) {
    throw new Error(`${target.label} has no published CMS pages to snapshot.`)
  }
  return {
    settings: settings.docs[0] as any,
    pages: pages.docs as any[],
  }
}

async function currentActiveSnapshot(payload: Payload, tenant: any) {
  const activeSnapshotId = relationshipId(tenant.activeSnapshot)
  if (activeSnapshotId) {
    return payload.findByID({
      collection: "published-site-snapshots" as any,
      id: activeSnapshotId as any,
      depth: 0,
      overrideAccess: true,
    } as any) as Promise<any>
  }
  const result = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { status: { equals: "active" } }] },
    sort: "-activatedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return (result.docs as any[])[0] ?? null
}

function snapshotSummary(snapshotDoc: any | null) {
  if (!snapshotDoc) return "none"
  return [
    `id=${snapshotDoc.id}`,
    `status=${snapshotDoc.status}`,
    `version=${snapshotDoc.version}`,
    `domain=${snapshotDoc.domain}`,
    `hash=${snapshotDoc.snapshotHash}`,
  ].join(" ")
}

export async function verifyThemeParity(
  payload: Payload,
  helpers: Pick<PublishHelpers, "resolvePublishedSnapshotByHost">,
  tenant: any,
  projectedTheme: unknown,
) {
  const current = await currentActiveSnapshot(payload, tenant)
  const resolved = tenant.domain
    ? await helpers.resolvePublishedSnapshotByHost(payload, tenant.domain)
    : null
  const activeTheme = current?.snapshot?.theme ?? null
  const routeTheme = resolved?.snapshot?.theme ?? null
  return {
    activeSnapshotId: current?.id ?? null,
    rendererSnapshotId: resolved?.snapshotId ?? null,
    activeEqualsProjected: stableStringify(activeTheme) === stableStringify(projectedTheme ?? null),
    rendererEqualsActive: stableStringify(routeTheme) === stableStringify(activeTheme),
    rendererEqualsProjected: stableStringify(routeTheme) === stableStringify(projectedTheme ?? null),
    activeThemeHash: themeHash(activeTheme),
    rendererThemeHash: themeHash(routeTheme),
    projectedThemeHash: themeHash(projectedTheme ?? null),
  }
}

async function runTarget(
  payload: Payload,
  helpers: PublishHelpers,
  target: OfficialTarget,
  options: CliOptions,
) {
  const tenant = await resolveTargetTenant(payload, target)
  const source = await requireCurrentCmsSource(payload, tenant, target)
  const activeBefore = await currentActiveSnapshot(payload, tenant)
  const projected = await helpers.buildPublishedSiteSnapshot(payload, tenant.id, null, {
    includeAllPublishedPages: true,
  })
  const projectedHash = stableHash(projected)
  const projectedKey = `${projected.tenantSlug}-v${projected.manifest.version}-${projectedHash.slice(0, 12)}`
  const parityBefore = await verifyThemeParity(payload, helpers, tenant, projected.theme)

  console.log("")
  console.log(`[tenant] ${target.label}`)
  console.log(`  tenant: id=${tenant.id} slug=${tenant.slug} domain=${tenant.domain}`)
  console.log(`  source: settings=${source.settings.id} publishedPages=${source.pages.map((page) => `${page.id}:${page.slug}`).join(", ")}`)
  console.log(`  currentActiveSnapshot: ${snapshotSummary(activeBefore)}`)
  console.log(`  projectedSnapshot: key=${projectedKey} version=${projected.manifest.version} hash=${projectedHash}`)
  console.log(`  themeHash: ${themeHash(projected.theme)}`)
  console.log(`  themePayload: ${JSON.stringify(projected.theme ?? null)}`)
  console.log(`  verifyBefore: activeEqualsProjected=${parityBefore.activeEqualsProjected} rendererEqualsActive=${parityBefore.rendererEqualsActive} rendererEqualsProjected=${parityBefore.rendererEqualsProjected}`)

  if (!options.apply) return

  const result = await helpers.publishSiteSnapshot(payload, {
    tenantId: tenant.id,
    generationRunId: null,
    includeAllPublishedPages: true,
    activate: true,
    manualActivation: true,
    activationReason: `Phase 5 repair publish from current CMS state for ${tenant.slug}`,
  })
  const refreshedTenant = await payload.findByID({
    collection: "tenants",
    id: tenant.id as any,
    depth: 0,
    overrideAccess: true,
  }) as any
  const activeAfter = await currentActiveSnapshot(payload, refreshedTenant)
  const parityAfter = await verifyThemeParity(payload, helpers, refreshedTenant, projected.theme)
  console.log(`  newSnapshotResult: id=${(result.snapshot as any).id} status=${(result.snapshot as any).status} activated=${result.activated}`)
  console.log(`  activeAfter: ${snapshotSummary(activeAfter)}`)
  console.log(`  verifyAfter: activeEqualsProjected=${parityAfter.activeEqualsProjected} rendererEqualsActive=${parityAfter.rendererEqualsActive} rendererEqualsProjected=${parityAfter.rendererEqualsProjected}`)
}

async function main() {
  const options = parseArgs()
  console.log(options.apply ? "[mode] apply" : "[mode] dry-run")
  if (!options.apply) console.log("[mode] no CMS mutations will be performed; pass --apply to publish and activate.")

  installServerOnlyShim()
  await import("dotenv/config")
  const helpers = await loadPublishHelpers()
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  const payload = await getPayload({ config })
  try {
    for (const key of options.tenants) await runTarget(payload, helpers, TARGETS[key], options)
  } finally {
    await payload.db.destroy?.()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
