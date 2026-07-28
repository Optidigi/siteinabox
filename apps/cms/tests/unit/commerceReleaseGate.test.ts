import { describe, expect, it, vi } from "vitest"

const { prepareDomainMigration } = vi.hoisted(() => ({
  prepareDomainMigration: vi.fn(async (_payload, migrationId) => ({
    status: "rolled_back",
    migrationId,
    message: "Frozen nameservers restored.",
  })),
}))

vi.mock("@/lib/domains/migration", () => ({ prepareDomainMigration }))

import {
  commerceProductionReadinessBlockers,
  commerceReleaseGate,
  requireCommerceProviderWritesAllowed,
} from "@/lib/commerce/releaseGate"
import { prepareDomainMigrationTask } from "@/lib/jobs/prepareDomainMigrationTask"
import { asPayload } from "../_helpers/mockPayload"

const taskPayload = asPayload({
  findByID: vi.fn(async () => ({
    id: 10,
    cutoverWriteState: "not_started",
    rollbackWriteState: "not_started",
  })),
})

describe("staged commerce release runtime gate", () => {
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

  it("blocks uncommitted migration writes before provider modules execute", async () => {
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
      find: vi.fn(async () => ({
        docs: [{ id: 1, severity: "critical", status: "open" }],
        totalDocs: 1,
      })),
    })
    const blockers = await commerceProductionReadinessBlockers(
      readinessPayload,
      {
        COMMERCE_RELEASE_STAGE: "production",
        COMMERCE_RELEASE_EVIDENCE_VERSION: "phase11-2026-07-27.1",
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
})
