import { describe, expect, it } from "vitest"

import {
  commerceReleaseGate,
  requireCommerceProviderWritesAllowed,
} from "@/lib/commerce/releaseGate"
import { prepareDomainMigrationTask } from "@/lib/jobs/prepareDomainMigrationTask"
import { asPayload } from "../_helpers/mockPayload"

const taskPayload = asPayload({})

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
  })
})
