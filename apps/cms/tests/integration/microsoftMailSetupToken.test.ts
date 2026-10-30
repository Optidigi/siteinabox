import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import { sql } from "@payloadcms/db-postgres"
import { getTestPayload } from "./_helpers"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { createMicrosoftMailSetupToken, consumeMicrosoftMailSetupToken, consumeMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupTokenStore"
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
    if (!linkToken) throw new Error("Expected new setup token")
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


it("allows exactly one reveal across workspace access and duplicate email links",async()=>{
 const now=new Date().toISOString()
 const run=await new PayloadMicrosoftMailProvisioningStore(payload).create({idempotencyKey:"m365-mail:workspace-reveal",mode:"mock",tenantId:7,domain:"customer.test",tenantPrefix:"customer",request:{} as never,state:"ready",currentStep:null,completedSteps:["setup_email"],data:{},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now})
 const encryptedPassword=encryptMicrosoftMailSetupCredential("Temporary-Workspace-42!",encryptionKey)
 const input={payload,runId:Number(run.id),userPrincipalName:"ardi@customer.test",encryptedPassword,expiresAt:new Date(Date.now()+60000)}
 const one=await createMicrosoftMailSetupToken(input),two=await createMicrosoftMailSetupToken(input)
 if(!one||!two)throw new Error("Expected unused setup tokens")
 const results=await Promise.all([consumeMicrosoftMailSetupCredential({payload,runId:Number(run.id),userPrincipalName:input.userPrincipalName}),consumeMicrosoftMailSetupToken({payload,token:one}),consumeMicrosoftMailSetupToken({payload,token:two})])
 expect(results.filter(Boolean)).toHaveLength(1)
 expect(decryptMicrosoftMailSetupCredential(results.find(Boolean)!.encryptedPassword,encryptionKey)).toBe("Temporary-Workspace-42!")
 expect(await consumeMicrosoftMailSetupCredential({payload,runId:Number(run.id),userPrincipalName:input.userPrincipalName})).toBeNull()
 expect(await createMicrosoftMailSetupToken(input)).toBeNull()
 const rows=await payload.db.drizzle.execute(sql`SELECT encrypted_password,consumed_at FROM microsoft_mail_setup_tokens WHERE provisioning_run_id=${Number(run.id)}`)
 expect(rows.rows).toHaveLength(2)
 expect(rows.rows.every(row=>row.encrypted_password===""&&row.consumed_at)).toBe(true)
})


it("does not race credential recreation past a concurrent first claim",async()=>{
 const now=new Date().toISOString()
 const run=await new PayloadMicrosoftMailProvisioningStore(payload).create({idempotencyKey:"m365-mail:create-consume-race",mode:"mock",tenantId:7,domain:"customer.test",tenantPrefix:"customer",request:{} as never,state:"ready",currentStep:null,completedSteps:["setup_email"],data:{},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now})
 const input={payload,runId:Number(run.id),userPrincipalName:"aslan@customer.test",encryptedPassword:encryptMicrosoftMailSetupCredential("Synthetic-Race-42!",encryptionKey),expiresAt:new Date(Date.now()+60000)}
 const first=await createMicrosoftMailSetupToken(input);if(!first)throw new Error("Initial token missing")
 const [second,claimed]=await Promise.all([createMicrosoftMailSetupToken(input),consumeMicrosoftMailSetupToken({payload,token:first})])
 expect(claimed?.userPrincipalName).toBe(input.userPrincipalName)
 if(second)expect(await consumeMicrosoftMailSetupToken({payload,token:second})).toBeNull()
 expect(await createMicrosoftMailSetupToken(input)).toBeNull()
 const rows=await payload.db.drizzle.execute(sql`SELECT encrypted_password,consumed_at FROM microsoft_mail_setup_tokens WHERE provisioning_run_id=${Number(run.id)}`)
 expect(rows.rows.every(row=>row.encrypted_password===""&&row.consumed_at)).toBe(true)
})
