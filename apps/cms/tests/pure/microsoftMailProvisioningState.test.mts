import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertMicrosoftMailStateTransition,
  createMicrosoftMailProvisioningKey,
  type MicrosoftMailProvisioningState,
} from "../../src/lib/microsoftMailProvisioning/state.ts"

describe("Microsoft mail provisioning lifecycle", () => {
  it("uses one stable idempotency key for the same tenant/domain/mailbox batch", () => {
    const input = {
      tenantId: 42,
      domain: "tap2case.nl",
      mailboxAddresses: ["aslan@tap2case.nl", "ardi@tap2case.nl"],
      product: "m365-business-basic-eea-no-teams",
    }
    const key = createMicrosoftMailProvisioningKey(input)

    assert.equal(
      key,
      createMicrosoftMailProvisioningKey({
        ...input,
        mailboxAddresses: [...input.mailboxAddresses].reverse(),
      }),
    )
    assert.notEqual(key, createMicrosoftMailProvisioningKey({ ...input, tenantId: 43 }))
  })

  it("permits only the declared next-step transitions", () => {
    const valid: MicrosoftMailProvisioningState = "tenant_pending"
    assert.equal(
      assertMicrosoftMailStateTransition("prepared", valid),
      valid,
    )
    assert.throws(
      () => assertMicrosoftMailStateTransition("prepared", "ready"),
      /Invalid Microsoft mail provisioning transition/,
    )
    assert.throws(
      () => assertMicrosoftMailStateTransition("ready", "subscription_pending"),
      /Invalid Microsoft mail provisioning transition/,
    )
  })
})
