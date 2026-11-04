import assert from "node:assert/strict"
import test from "node:test"
import { ManagedMailBootstrapClient, createMailBootstrapJob, MAIL_BOOTSTRAP_PROTOCOL } from "../../src/lib/microsoftMailProvisioning/managedBootstrap.ts"
const input = { runId: "42", orderId: "9", tenantId: "00000000-0000-4000-8000-000000000002", initialDomain: "fixture.onmicrosoft.com", domain: "fixture.test", applicationId: "00000000-0000-4000-8000-000000000003", partnerTenantId: "00000000-0000-4000-8000-000000000001", groupId: "00000000-0000-4000-8000-000000000004", sourceRelationshipId: "default-relationship", targetRelationshipId: "full-relationship" }
const job = createMailBootstrapJob(input)
test("bootstrap job is stable, tenant/order bound and carries no customer credentials", () => {
 assert.equal(createMailBootstrapJob(input).id, job.id)
 assert.notEqual(createMailBootstrapJob({ ...input, orderId: "10" }).id, job.id)
 assert.throws(() => createMailBootstrapJob({ ...input, initialDomain: "attacker.test" }))
 assert.throws(() => createMailBootstrapJob({ ...input, tenantId: input.partnerTenantId }))
 assert.equal(JSON.stringify(job).includes("password"), false)
 assert.equal("password" in createMailBootstrapJob({...input,...{password:"synthetic-private"}}),false)
 assert.throws(()=>createMailBootstrapJob({...input,targetRelationshipId:input.sourceRelationshipId.toUpperCase()}))
})
test("worker health must advertise the exact unattended protocol and qualification", async () => {
 const client = new ManagedMailBootstrapClient({ endpoint: "https://worker.test", secret: "s".repeat(40), fetchImpl: async()=> Response.json({ protocol: MAIL_BOOTSTRAP_PROTOCOL, unattended: true, qualified: false }) })
 assert.equal(await client.ready(), false)
})
test("accepts only bound receipts and never trusts worker completion as workload readiness", async () => {
 const receipt = { protocol: MAIL_BOOTSTRAP_PROTOCOL, jobId: job.id, binding: job.binding, phase: "complete", relationshipId: "full-relationship" }
 let writes = 0
 const client = new ManagedMailBootstrapClient({ endpoint: "https://worker.test", secret: "s".repeat(40), fetchImpl: async(_url, init)=> { if(init?.method === "PUT") writes++; return Response.json(receipt) } })
 assert.deepEqual(await client.advance(job), { phase: "complete", relationshipId: "full-relationship" })
 assert.equal(writes, 1)
 const wrong = new ManagedMailBootstrapClient({ endpoint: "https://worker.test", secret: "s".repeat(40), fetchImpl: async()=>Response.json({ ...receipt, binding: "other" }) })
 await assert.rejects(wrong.advance(job), /MAIL_BOOTSTRAP_RESPONSE_INVALID/)
})
test("lost or malformed bootstrap response is uncertain, never an automatic new administrator", async () => {
 for (const fetchImpl of [async()=>{throw Error("secret provider detail")}, async()=>Response.json({ completed:true })]) {
  const client = new ManagedMailBootstrapClient({ endpoint:"https://worker.test", secret:"s".repeat(40), fetchImpl })
  await assert.rejects(client.advance(job), /MAIL_BOOTSTRAP_(OUTCOME_UNKNOWN|RESPONSE_INVALID)/)
 }
 assert.throws(()=>new ManagedMailBootstrapClient({endpoint:"http://worker.test",secret:"s".repeat(40)}))
 assert.throws(()=>new ManagedMailBootstrapClient({endpoint:"https://user:password@worker.test",secret:"s".repeat(40)}))
})

test("initial purchases stay closed until bootstrap is configured and qualified", async () => {
 const { requireManagedMailBootstrap } = await import("../../src/lib/microsoftMailProvisioning/managedBootstrap.ts")
 assert.throws(()=>requireManagedMailBootstrap({}), /MAIL_BOOTSTRAP_NOT_QUALIFIED/)
 assert.throws(()=>requireManagedMailBootstrap({MICROSOFT_MAIL_AUTHORITY_QUALIFIED:"managed-admin-v1"}), /MAIL_BOOTSTRAP_NOT_QUALIFIED/)
 assert.doesNotThrow(()=>requireManagedMailBootstrap({MICROSOFT_MAIL_AUTHORITY_QUALIFIED:"managed-admin-v1",MICROSOFT_MAIL_BOOTSTRAP_WORKER_URL:"https://worker.test",MICROSOFT_MAIL_BOOTSTRAP_WORKER_SECRET:"s".repeat(40),MICROSOFT_PARTNER_APP_CLIENT_ID:input.applicationId,MICROSOFT_PARTNER_TENANT_ID:input.partnerTenantId,MICROSOFT_PARTNER_SECURITY_GROUP_ID:input.groupId}))
})

test("qualification is usable only for the configured app, partner tenant and group",async()=>{
 const identity={applicationId:input.applicationId,partnerTenantId:input.partnerTenantId,groupId:input.groupId}
 let body={protocol:MAIL_BOOTSTRAP_PROTOCOL,unattended:true,qualified:true,...identity}
 const client=new ManagedMailBootstrapClient({endpoint:"https://worker.test",secret:"s".repeat(40),identity,fetchImpl:async()=>Response.json(body)})
 assert.equal(await client.ready(),true)
 for(const patch of [{applicationId:"other"},{partnerTenantId:"other"},{groupId:"other"},{qualified:false},{protocol:"other"},{unattended:false}]){
  body={protocol:MAIL_BOOTSTRAP_PROTOCOL,unattended:true,qualified:true,...identity,...patch}
  assert.equal(await client.ready(),false)
 }
})
