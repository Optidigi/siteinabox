import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "./_helpers"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { createMicrosoftMailSetupToken, consumeMicrosoftMailSetupToken } from "@/lib/microsoftMailProvisioning/setupTokenStore"
import { decryptMicrosoftMailSetupCredential, encryptMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupCredentialCrypto"

let payload: Payload
const encryptionKey = Buffer.alloc(32, 17).toString("base64")

beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => { await payload?.destroy() })

describe("one-time Microsoft mailbox setup tokens", () => {
  it("stores only the token hash, reveals the encrypted password once, and erases it on consume", async () => {
    const store = new PayloadMicrosoftMailProvisioningStore(payload)
    const now = new Date()
    const run = await store.create({
      idempotencyKey: "m365-mail:setup-token-test",
      mode: "mock",
      tenantId: 7,
      domain: "tap2case.nl",
      tenantPrefix: "tap2case",
      request: {} as never,
      state: "ready",
      currentStep: null,
      completedSteps: ["setup_email"],
      data: {},
      actionUrl: null,
      issueCode: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    const encryptedPassword = encryptMicrosoftMailSetupCredential("Temporary-Password-42!", encryptionKey)
    const linkToken = await createMicrosoftMailSetupToken({
      payload,
      runId: Number(run.id),
      userPrincipalName: "ardi@tap2case.nl",
      encryptedPassword,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const tokenHash = await payload.db.drizzle.execute(sql`SELECT token_hash, encrypted_password FROM microsoft_mail_setup_tokens WHERE provisioning_run_id = ${Number(run.id)}`)
    expect(tokenHash.rows[0]?.token_hash).not.toBe(linkToken)
    expect(tokenHash.rows[0]?.encrypted_password).not.toBe("Temporary-Password-42!")

    const first = await consumeMicrosoftMailSetupToken({ payload, token: linkToken })
    expect(first?.userPrincipalName).toBe("ardi@tap2case.nl")
    expect(decryptMicrosoftMailSetupCredential(first!.encryptedPassword, encryptionKey)).toBe("Temporary-Password-42!")
    expect(await consumeMicrosoftMailSetupToken({ payload, token: linkToken })).toBeNull()

    const cleared = await payload.db.drizzle.execute(sql`SELECT encrypted_password, consumed_at FROM microsoft_mail_setup_tokens WHERE provisioning_run_id = ${Number(run.id)}`)
    expect(cleared.rows[0]?.encrypted_password).toBe("")
    expect(cleared.rows[0]?.consumed_at).toBeTruthy()
  })
})
