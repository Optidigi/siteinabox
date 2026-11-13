import assert from "node:assert/strict"
import test from "node:test"
import type { Payload } from "payload"
import { PayloadMicrosoftMailProvisioningStore } from "../../src/lib/microsoftMailProvisioning/payloadStore.ts"
import {
  advanceMicrosoftMailProvisioning,
  startMicrosoftMailProvisioning,
  type MicrosoftMailProvisioningPorts,
  type MicrosoftMailProvisioningRun,
  type MicrosoftMailProvisioningStore,
} from "../../src/lib/microsoftMailProvisioning/workflow.ts"

const request = {
  tenantId: 42,
  domain: "tap2case.nl",
  customer: {
    companyName: "Tap2case BV", website: "https://tap2case.nl", phone: "+31201234567",
    address: { street: "Dam 1", city: "Amsterdam", postalCode: "1000 AA", country: "NL" },
    primaryContact: { firstName: "Ardi", lastName: "Test", email: "ardi@tap2case.nl", phone: "+31201234567" },
  },
  mailboxUsers: [
    { localPart: "ardi", displayName: "Ardi Test", setupEmail: "admin@example.org" },
    { localPart: "aslan", displayName: "Aslan Test", setupEmail: "admin@example.org" },
  ],
  retainInfoForward: true,
  infoForwardTo: "info@amapromotions.nl",
}

class MemoryStore implements MicrosoftMailProvisioningStore {
  records: MicrosoftMailProvisioningRun[] = []
  nextId = 1
  async findByIdempotencyKey(key: string) { return this.records.find((run) => run.idempotencyKey === key) ?? null }
  async create(input: Omit<MicrosoftMailProvisioningRun, "id">) {
    const result = { ...input, id: this.nextId++ }
    this.records.push(result)
    return result
  }
  async update(id: string | number, patch: Partial<MicrosoftMailProvisioningRun>) {
    const index = this.records.findIndex((run) => run.id === id)
    assert.notEqual(index, -1)
    this.records[index] = { ...this.records[index]!, ...patch }
    return this.records[index]!
  }
  async get(id: string | number) { return this.records.find((run) => run.id === id) ?? null }
}

const ports = (overrides: Partial<MicrosoftMailProvisioningPorts> = {}): MicrosoftMailProvisioningPorts => {
  const complete = async () => ({ kind: "complete" as const })
  return {
    provider_company: complete,
    tenant_identity: complete,
    mca_acceptance: complete,
    gdap: complete,
    application_consent: complete,
    sign_in_policy: complete,
    subscription: complete,
    domain_verification: complete,
    info_forward: complete,
    dkim_prepare: complete,
    dns_prepare: complete,
    mailbox_users: complete,
    dns_cutover: complete,
    dkim_enable: complete,
    sendSetupEmail: async () => ({ kind: "complete" }),
    ...overrides,
  }
}

test("mock provisioning completes the ordered provider flow and emails each setup address once", async () => {
  const store = new MemoryStore()
  const called: string[] = []
  const allPorts = ports({
    provider_company: async () => { called.push("tenant"); return { kind: "complete" } },
    subscription: async ({ request: parsed }) => {
      called.push(`subscription:${parsed.quantity}:${parsed.product}:${parsed.commitment}`)
      return { kind: "complete", data: { pax8SubscriptionId: "mock-subscription" } }
    },
    info_forward: async () => { called.push("info-forward"); return { kind: "complete" } },
    dkim_prepare: async () => { called.push("dkim-targets"); return { kind: "complete" } },
    dns_prepare: async () => { called.push("dns-prepare"); return { kind: "complete" } },
    mailbox_users: async () => { called.push("mailbox-users"); return { kind: "complete" } },
    dns_cutover: async () => { called.push("dns-cutover"); return { kind: "complete" } },
    dkim_enable: async () => { called.push("exchange-dkim-enable"); return { kind: "complete" } },
    sendSetupEmail: async ({ user }) => { called.push(`email:${user.userPrincipalName}`); return { kind: "complete" } },
  })
  const result = await startMicrosoftMailProvisioning({ request, store, ports: allPorts, mode: "mock" })
  assert.equal(result.state, "ready")
  assert.deepEqual(called, ["tenant", "subscription:2:m365-business-basic-eea-no-teams:annual", "dkim-targets", "dns-prepare", "mailbox-users", "info-forward", "dns-cutover", "exchange-dkim-enable", "email:ardi@tap2case.nl", "email:aslan@tap2case.nl"])
  assert.deepEqual(result.request.mailboxUsers.map((user) => user.setupEmail), ["", ""])
  assert.deepEqual(result.data.setupEmailStates, { "ardi@tap2case.nl": "sent", "aslan@tap2case.nl": "sent" })
  assert.equal(result.data.pax8SubscriptionId, "mock-subscription")
})

test("approval wait is resumable and does not repeat completed provider writes", async () => {
  const store = new MemoryStore()
  let tenantBootstrapCount = 0
  let accepted = false
  const allPorts = ports({
    provider_company: async () => { tenantBootstrapCount += 1; return { kind: "complete" } },
    mca_acceptance: async () => accepted
      ? { kind: "complete" }
      : { kind: "waiting", state: "consent_pending", code: "mca_acceptance_required", actionUrl: "https://admin.microsoft.com/", message: "Accept MCA" },
  })
  const paused = await startMicrosoftMailProvisioning({ request, store, ports: allPorts, mode: "mock" })
  assert.equal(paused.state, "consent_pending")
  assert.equal(paused.actionUrl, "https://admin.microsoft.com/")
  accepted = true
  const resumed = await advanceMicrosoftMailProvisioning({ run: paused, store, ports: allPorts })
  assert.equal(resumed.state, "ready")
  assert.equal(tenantBootstrapCount, 1)
})

test("live mode requires explicit confirmation before any provider call", async () => {
  const store = new MemoryStore()
  let calls = 0
  const allPorts = ports({ provider_company: async () => { calls += 1; return { kind: "complete" } } })
  await assert.rejects(startMicrosoftMailProvisioning({ request, store, ports: allPorts, mode: "live" }), /explicit confirmation/)
  assert.equal(calls, 0)
  assert.equal(store.records.length, 0)
})

test("an indeterminate external write stops for reconciliation instead of retrying and duplicating it", async () => {
  const store = new MemoryStore()
  let attempts = 0
  const allPorts = ports({
    provider_company: async () => {
      attempts += 1
      const error = new Error("provider outcome unknown")
      error.name = "Pax8IndeterminateWriteError"
      throw error
    },
  })
  const paused = await startMicrosoftMailProvisioning({ request, store, ports: allPorts, mode: "mock" })
  assert.equal(paused.state, "manual_review")
  assert.equal(paused.issueCode, "Pax8IndeterminateWriteError")
  const resumed = await advanceMicrosoftMailProvisioning({ run: paused, store, ports: allPorts })
  assert.equal(resumed.state, "manual_review")
  assert.equal(attempts, 1)
})

test("setup delivery sends each mailbox once and keeps an uncertain send out of automatic retries", async () => {
  const store = new MemoryStore()
  let sends = 0
  const allPorts = ports({
    sendSetupEmail: async ({ user }) => {
      sends += 1
      if (user.userPrincipalName === "aslan@tap2case.nl") {
        const error = new Error("delivery response lost")
        error.name = "IndeterminateWriteError"
        throw error
      }
      return { kind: "complete" }
    },
  })
  const run = await startMicrosoftMailProvisioning({ request, store, ports: allPorts, mode: "mock" })
  assert.equal(run.state, "manual_review")
  assert.deepEqual(run.data.setupEmailStates, { "ardi@tap2case.nl": "sent", "aslan@tap2case.nl": "manual_review" })
  assert.equal(run.request.mailboxUsers[0]?.setupEmail, "")
  assert.equal(run.request.mailboxUsers[1]?.setupEmail, "admin@example.org")
  await advanceMicrosoftMailProvisioning({ run, store, ports: allPorts })
  assert.equal(sends, 2)
})

test("adds identity verification to an existing in-flight run without rewinding its workload state",async()=>{
 const store=new MemoryStore()
 const started=await startMicrosoftMailProvisioning({request,store,ports:ports({domain_verification:async()=>({kind:"waiting",state:"domain_pending",code:"domain_wait",message:"Waiting"})}),mode:"mock"})
 const legacy=await store.update(started.id,{state:"domain_pending",completedSteps:started.completedSteps.filter(step=>step!=="tenant_identity"),data:{...started.data,customerTenantId:"12345678-1234-4234-8234-123456789abc"}})
 const ready=await advanceMicrosoftMailProvisioning({run:legacy,store,ports:ports()})
 assert.equal(ready.state,"ready")
 assert.ok(ready.completedSteps.includes("tenant_identity"))
})

test("retries a temporary provider read failure without repeating completed writes",async()=>{
 const store=new MemoryStore();let reads=0,writes=0
 const adapters=ports({provider_company:async()=>{writes++;return {kind:"complete"}},tenant_identity:async()=>{
  reads++;if(reads===1)throw Object.assign(new Error("Temporary provider read"),{name:"MicrosoftApiError",status:503})
  return {kind:"complete"}
 }})
 const waiting=await startMicrosoftMailProvisioning({request,store,ports:adapters,mode:"mock"})
 assert.equal(waiting.state,"consent_pending")
 assert.equal(waiting.issueCode,"PROVIDER_READ_TEMPORARILY_UNAVAILABLE")
 const ready=await advanceMicrosoftMailProvisioning({run:waiting,store,ports:adapters})
 assert.equal(ready.state,"ready")
 assert.equal(writes,1)
 assert.equal(reads,2)
})

test("resuming an automatic run revalidates expired authority without repeating purchases or DNS", async () => {
 const store = new MemoryStore()
 const initial = await startMicrosoftMailProvisioning({request,store,ports:ports({dns_cutover:async()=>({kind:"waiting",state:"dns_pending",code:"fixture",message:"Synthetic cutover wait"})}),mode:"mock"})
 const run = await store.update(initial.id,{mode:"live",data:{...initial.data,autoProvisionAuthorized:true,customerTenantId:"00000000-0000-4000-8000-000000000002"}})
 const called: string[]=[]
 const result=await advanceMicrosoftMailProvisioning({run,store,ports:ports({
  provider_company:async()=>{called.push("purchase");return {kind:"complete"}},
  gdap:async()=>{called.push("verify-delegation");return {kind:"manual_review",code:"MAIL_AUTHORITY_INSUFFICIENT",data:{mailAuthority:{status:"not_ready"}}}},
  dns_cutover:async()=>{called.push("cutover");return {kind:"complete"}},
 })})
 assert.equal(result.state,"manual_review")
 assert.equal(result.issueCode,"MAIL_AUTHORITY_INSUFFICIENT")
 assert.deepEqual(called,["verify-delegation"])
 assert.equal(result.completedSteps.includes("dns_prepare"),true)
 assert.deepEqual(result.data.mailAuthority,{status:"not_ready"})
})

test("expired authority never clears an interrupted consent-write marker",async()=>{
 const store=new MemoryStore()
 const initial=await startMicrosoftMailProvisioning({request,store,ports:ports({application_consent:async()=>({kind:"waiting",state:"consent_pending",code:"fixture",message:"Synthetic consent wait"})}),mode:"mock"})
 const run=await store.update(initial.id,{mode:"live",data:{...initial.data,autoProvisionAuthorized:true,customerTenantId:"00000000-0000-4000-8000-000000000002",providerStepStates:{gdap:"completed",application_consent:"started"}}})
 let writes=0
 const result=await advanceMicrosoftMailProvisioning({run,store,ports:ports({application_consent:async()=>{writes++;return {kind:"complete"}}})})
 assert.equal(result.state,"manual_review")
 assert.equal(result.issueCode,"provider_step_outcome_unknown")
 assert.equal(writes,0)
})

test("authority-only preflight cannot purchase licences or run mailbox/DNS work",async()=>{
 const store=new MemoryStore()
 const initial=await startMicrosoftMailProvisioning({request,store,ports:ports({provider_company:async()=>({kind:"waiting",state:"tenant_pending",code:"fixture",message:"Synthetic provider preparation"})}),mode:"mock"})
 const called:string[]=[]
 const result=await advanceMicrosoftMailProvisioning({run:initial,store,authorityOnly:true,ports:ports({
  gdap:async()=>{called.push("gdap");return {kind:"complete"}},application_consent:async()=>{called.push("consent");return {kind:"complete"}},
  subscription:async()=>{called.push("purchase");return {kind:"complete"}},mailbox_users:async()=>{called.push("users");return {kind:"complete"}},dns_cutover:async()=>{called.push("cutover");return {kind:"complete"}},
 })})
 assert.deepEqual(called,["gdap","consent"])
 assert.equal(result.state,"consent_pending")
 assert.equal(result.completedSteps.includes("subscription"),false)
 assert.equal(result.completedSteps.includes("application_consent"),true)
})

test("an authorized seat increase resumes mailbox work with its authority checkpoints retained",async()=>{
 const store=new MemoryStore()
 const initial=await startMicrosoftMailProvisioning({request,store,ports:ports({provider_company:async()=>({kind:"waiting",state:"tenant_pending",code:"fixture",message:"Synthetic provider preparation"})}),mode:"mock"})
 const verified=await advanceMicrosoftMailProvisioning({run:initial,store,authorityOnly:true,ports:ports()})
 const purchased=await store.update(verified.id,{state:"consent_pending",completedSteps:[...verified.completedSteps,"provider_company","subscription","mca_acceptance","domain_verification","dkim_prepare","dns_prepare","dns_cutover","dkim_enable"]})
 let mailboxes=0
 const result=await advanceMicrosoftMailProvisioning({run:purchased,store,ports:ports({
  gdap:async()=>{throw Error("Must retain completed authority")},application_consent:async()=>{throw Error("Must retain resource grants")},subscription:async()=>{throw Error("Must not repeat purchase")},
  mailbox_users:async()=>{mailboxes++;return {kind:"complete"}},
 })})
 assert.equal(result.state,"ready")
 assert.equal(mailboxes,1)
})

test("a failed fresh authority pass invalidates prior ready evidence before any seat purchase",async()=>{
 const {evaluateMailAuthority,requiredMailRoleIds,mailAuthorityCurrent}=await import("../../src/lib/microsoftMailProvisioning/mailAuthority.ts")
 const customerId="00000000-0000-4000-8000-000000000002"
 for(const outcome of [
  {kind:"waiting" as const,state:"consent_pending" as const,code:"GDAP_ACCESS_ASSIGNMENT_PENDING",message:"Synthetic assignment wait"},
  {kind:"manual_review" as const,code:"GDAP_CUSTOMER_MISMATCH"},
 ]){
  const store=new MemoryStore()
  const initial=await startMicrosoftMailProvisioning({request,store,ports:ports({dns_cutover:async()=>({kind:"waiting",state:"dns_pending",code:"fixture",message:"Synthetic cutover wait"})}),mode:"mock"})
  const ready=evaluateMailAuthority({tenantId:customerId,relationshipTenantId:customerId,relationshipId:"r",relationshipStatus:"active",assignmentId:"a",assignmentStatus:"active",groupId:"g",assignedGroupId:"g",approvedRoleIds:requiredMailRoleIds,assignedRoleIds:requiredMailRoleIds,resourcesVerified:true})
  const run=await store.update(initial.id,{mode:"live",data:{...initial.data,customerTenantId:customerId,autoProvisionAuthorized:true,mailAuthority:ready}})
  const result=await advanceMicrosoftMailProvisioning({run,store,authorityOnly:true,ports:ports({gdap:async()=>outcome})})
  assert.equal(result.completedSteps.includes("gdap"),false)
  assert.equal(result.completedSteps.includes("application_consent"),false)
  assert.equal(mailAuthorityCurrent(result.data.mailAuthority,customerId),false)
 }
})

test("loads legacy company receipts under their commercial meaning without losing write evidence",async()=>{
 const legacy={id:18,currentStep:"tenant_bootstrap",completedSteps:["tenant_bootstrap","subscription"],data:{providerStepStates:{subscription:"complete",tenant_bootstrap:"uncertain"},pax8OrderId:"kept-order"}}
 const payload={findByID:async()=>legacy} as unknown as Payload
 const run=await new PayloadMicrosoftMailProvisioningStore(payload).get(18)
 assert.equal(run?.currentStep,"provider_company")
 assert.deepEqual(run?.completedSteps,["provider_company","subscription"])
 assert.equal(run?.data.pax8OrderId,legacy.data.pax8OrderId)
 assert.deepEqual(run?.data.providerStepStates,{subscription:"complete",provider_company:"uncertain"})
})
