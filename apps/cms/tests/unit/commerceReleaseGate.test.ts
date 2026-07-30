import { afterEach, describe, expect, it, vi } from "vitest"

const { prepareDomainMigration } = vi.hoisted(() => ({
  prepareDomainMigration: vi.fn(async (_payload, migrationId) => ({
    status: "rolled_back",
    migrationId,
    message: "Frozen nameservers restored.",
  })),
}))

vi.mock("@/lib/domains/migration", () => ({ prepareDomainMigration }))

import {
  commerceEdgeBootstrapBlockers,
  commerceEdgeBootstrapWritesAllowed,
  commerceEdgeInventoryBlockers,
  commerceProductionReadinessBlockers,
  commerceReleaseGate,
  requireCommerceProviderWritesAllowed,
} from "@/lib/commerce/releaseGate"
import { prepareDomainMigrationTask } from "@/lib/jobs/prepareDomainMigrationTask"
import { asPayload } from "../_helpers/mockPayload"

const taskPayload = asPayload({
  findByID: vi.fn(async () => ({
    id: 10,
    cloudflareZoneState: "not_started",
    providerTransferState: "not_started",
    cutoverWriteState: "not_started",
    rollbackWriteState: "not_started",
    dnssecPhase: "source_unsigned",
    dnssecWriteState: "not_started",
  })),
})

const legacyEdgeInventoryPayload = (
  options: {
    activeSnapshot?: boolean
    snapshotStatus?: "active" | "superseded"
    snapshotTenant?: number
    snapshotDomain?: string
    wwwSettingsCount?: number
    wwwAliasCount?: number
    duplicateTenant?: boolean
    foreignWwwAlias?: boolean
    wwwCanonicalConflict?: boolean
  } = {},
) => {
  const tenant = {
    id: 1,
    status: "active",
    domain: "ami-care.nl",
    domainVerification: { status: "verified" },
    activeSnapshot: options.activeSnapshot === false ? null : 154,
  }
  return asPayload({
    find: vi.fn(async ({
      collection,
      where,
    }: {
      collection: string
      where?: unknown
    }) => {
      if (collection === "tenants") {
        const serializedWhere = JSON.stringify(where)
        const domainLookup = serializedWhere.includes('"domain"')
        const wwwLookup = serializedWhere.includes("www.ami-care.nl")
        return {
          docs: wwwLookup
            ? options.wwwCanonicalConflict
              ? [{ id: 2, status: "active", domain: "www.ami-care.nl" }]
              : []
            : domainLookup && options.duplicateTenant
              ? [tenant, { ...tenant, id: 2 }]
              : [tenant],
          totalDocs: wwwLookup
            ? options.wwwCanonicalConflict ? 1 : 0
            : domainLookup && options.duplicateTenant ? 2 : 1,
        }
      }
      if (collection === "site-settings") {
        const count = options.wwwSettingsCount ?? 1
        return {
          docs: Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            tenant: options.foreignWwwAlias ? 2 : tenant.id,
            aliases: Array.from(
              { length: options.wwwAliasCount ?? 1 },
              (_, aliasIndex) => ({
                id: `alias-${index}-${aliasIndex}`,
                host: "www.ami-care.nl",
              }),
            ),
          })),
          totalDocs: count,
        }
      }
      return { docs: [], totalDocs: 0 }
    }),
    findByID: vi.fn(async () => ({
      id: 154,
      tenant: options.snapshotTenant ?? tenant.id,
      domain: options.snapshotDomain ?? tenant.domain,
      status: options.snapshotStatus ?? "active",
    })),
  })
}

describe("staged commerce release runtime gate", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("defaults to disabled and permits shadow provider reads only", () => {
    expect(commerceReleaseGate({} as NodeJS.ProcessEnv)).toEqual({
      providerReadsAllowed: false,
      providerWritesAllowed: false,
      blockers: ["commerce_release_disabled"],
    })
    expect(commerceReleaseGate({
      COMMERCE_RELEASE_STAGE: "shadow",
    } as unknown as NodeJS.ProcessEnv)).toEqual({
      providerReadsAllowed: true,
      providerWritesAllowed: false,
      blockers: ["commerce_release_shadow_read_only"],
    })
    expect(() => requireCommerceProviderWritesAllowed(
      "Mollie payment creation",
      { COMMERCE_RELEASE_STAGE: "shadow" } as unknown as NodeJS.ProcessEnv,
    )).toThrow("commerce_release_shadow_read_only")
  })

  it("allows only the scoped edge bootstrap before origin isolation is proven", () => {
    const edgeBootstrapEnv = {
      COMMERCE_RELEASE_STAGE: "production",
      COMMERCE_RELEASE_EVIDENCE_VERSION:
        "commerce-production-readiness-2026-07-30.1",
      COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED: "1",
      COMMERCE_ORIGIN_ISOLATION_VERIFIED: "",
      NODE_ENV: "production",
      MOLLIE_API_KEY: "live_test",
      OPENPROVIDER_USERNAME: "provider-user",
      OPENPROVIDER_PASSWORD: "provider-password",
      CLOUDFLARE_API_TOKEN: "cloudflare-token",
      CLOUDFLARE_ACCOUNT_ID: "account",
      DOMAIN_MIGRATION_ENCRYPTION_KEY:
        Buffer.alloc(32, 1).toString("base64"),
    } as unknown as NodeJS.ProcessEnv

    expect(commerceReleaseGate(edgeBootstrapEnv)).toMatchObject({
      providerWritesAllowed: false,
      blockers: ["production_origin_isolation_not_verified"],
    })
    expect(commerceEdgeBootstrapWritesAllowed(edgeBootstrapEnv)).toBe(true)
    expect(commerceEdgeBootstrapWritesAllowed({
      ...edgeBootstrapEnv,
      COMMERCE_RELEASE_EVIDENCE_VERSION:
        "commerce-production-readiness-2026-07-28.1",
    })).toBe(false)
    expect(commerceEdgeBootstrapWritesAllowed({
      ...edgeBootstrapEnv,
      COMMERCE_RELEASE_STAGE: "shadow",
    })).toBe(false)
    expect(commerceEdgeBootstrapWritesAllowed({
      ...edgeBootstrapEnv,
      COMMERCE_ORIGIN_ISOLATION_VERIFIED: "1",
    })).toBe(false)
  })

  it("blocks uncommitted migration writes before provider modules execute", async () => {
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "disabled")
    const migrationHandler = prepareDomainMigrationTask.handler as unknown as (
      input: {
        input: { migrationId: string }
        req: { payload: typeof taskPayload }
      },
    ) => Promise<{ output: { status: string } }>
    await expect(migrationHandler({
      input: { migrationId: "10" },
      req: { payload: taskPayload },
    })).resolves.toMatchObject({
      output: { status: "release_blocked" },
    })
    expect(prepareDomainMigration).not.toHaveBeenCalled()
  })

  it("continues reconciliation and rollback after a cutover write has started", async () => {
    const safetyPayload = asPayload({
      findByID: vi.fn(async () => ({
        id: 11,
        cutoverWriteState: "confirmed",
        rollbackWriteState: "not_started",
      })),
    })
    const migrationHandler = prepareDomainMigrationTask.handler as unknown as (
      input: {
        input: { migrationId: string }
        req: { payload: typeof safetyPayload }
      },
    ) => Promise<{ output: { status: string } }>
    await expect(migrationHandler({
      input: { migrationId: "11" },
      req: { payload: safetyPayload },
    })).resolves.toMatchObject({
      output: { status: "rolled_back" },
    })
    expect(prepareDomainMigration).toHaveBeenCalledWith(
      safetyPayload,
      "11",
      { forwardProviderWritesAllowed: expect.any(Function) },
    )
  })

  it("blocks production preflight on an open critical commerce alert", async () => {
    const readinessPayload = asPayload({
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === "operational-alerts"
          ? {
              docs: [{ id: 1, severity: "critical", status: "open" }],
              totalDocs: 1,
            }
          : { docs: [], totalDocs: 0 }),
    })
    const blockers = await commerceProductionReadinessBlockers(
      readinessPayload,
      {
        COMMERCE_RELEASE_STAGE: "production",
        COMMERCE_RELEASE_EVIDENCE_VERSION:
          "commerce-production-readiness-2026-07-30.1",
        COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED: "1",
        COMMERCE_ORIGIN_ISOLATION_VERIFIED: "1",
        NODE_ENV: "production",
        MOLLIE_API_KEY: "live_test",
        OPENPROVIDER_USERNAME: "sandbox-user",
        OPENPROVIDER_PASSWORD: "sandbox-password",
        CLOUDFLARE_API_TOKEN: "sandbox-token",
        CLOUDFLARE_ACCOUNT_ID: "account",
        DOMAIN_MIGRATION_ENCRYPTION_KEY:
          Buffer.alloc(32, 1).toString("base64"),
      } as unknown as NodeJS.ProcessEnv,
    )
    expect(blockers).toEqual([
      "production_has_open_critical_commerce_alerts",
    ])
  })

  it("blocks deployment inventory when a live tenant has no managed domain", async () => {
    const readinessPayload = asPayload({
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === "tenants"
          ? {
              docs: [{
                id: 12,
                status: "active",
                domain: "ami-care.nl",
              }],
              totalDocs: 1,
            }
          : { docs: [], totalDocs: 0 }),
    })
    await expect(commerceEdgeInventoryBlockers(readinessPayload)).resolves.toEqual([
      "active_tenant_managed_domain_inventory_invalid:12",
    ])
  })

  it("accepts only the audited verified legacy domain in edge inventory", async () => {
    await expect(
      commerceEdgeInventoryBlockers(legacyEdgeInventoryPayload(), true),
    ).resolves.toEqual([])
  })

  it.each([
    ["missing snapshot", { activeSnapshot: false }],
    ["inactive snapshot", { snapshotStatus: "superseded" }],
    ["snapshot owner mismatch", { snapshotTenant: 2 }],
    ["snapshot domain mismatch", { snapshotDomain: "other.nl" }],
    ["missing www alias", { wwwAliasCount: 0 }],
    ["duplicate www alias", { wwwAliasCount: 2 }],
    ["ambiguous site settings", { wwwSettingsCount: 2 }],
    ["duplicate tenant", { duplicateTenant: true }],
    ["foreign www alias owner", { foreignWwwAlias: true }],
    ["canonical www owner", { wwwCanonicalConflict: true }],
  ] as const)("blocks the audited legacy inventory with %s", async (_label, options) => {
    await expect(
      commerceEdgeInventoryBlockers(
        legacyEdgeInventoryPayload(options),
        true,
      ),
    ).resolves.toEqual(["active_tenant_edge_routing_unready:1"])
  })

  it("blocks scoped edge bootstrap on invalid inventory or critical commerce alerts", async () => {
    const bootstrapPayload = asPayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === "tenants") {
          return {
            docs: [{ id: 12, status: "active", domain: "ami-care.nl" }],
            totalDocs: 1,
          }
        }
        if (collection === "operational-alerts") {
          return {
            docs: [{ id: 99, severity: "critical", status: "open" }],
            totalDocs: 1,
          }
        }
        return { docs: [], totalDocs: 0 }
      }),
    })

    await expect(commerceEdgeBootstrapBlockers(bootstrapPayload)).resolves.toEqual([
      "active_tenant_managed_domain_inventory_invalid:12",
      "edge_bootstrap_has_open_critical_commerce_alerts",
    ])
  })
})
