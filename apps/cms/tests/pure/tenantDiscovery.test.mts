import assert from "node:assert/strict"
import test from "node:test"
import { discoverMicrosoftTenant } from "../../src/lib/microsoftMailProvisioning/tenantDiscovery.ts"
const id = "12345678-1234-4234-8234-123456789abc"
test("resolves the requested initial domain through Microsoft metadata", async () => {
 const calls: string[] = []
 const found = await discoverMicrosoftTenant("customer.onmicrosoft.com", async input => {
  calls.push(String(input))
  return Response.json({issuer:`https://login.microsoftonline.com/${id}/v2.0`,token_endpoint:`https://login.microsoftonline.com/${id}/oauth2/v2.0/token`})
 })
 assert.equal(found?.tenantId,id)
 assert.deepEqual(calls,["https://login.microsoftonline.com/customer.onmicrosoft.com/v2.0/.well-known/openid-configuration"])
})
test("treats only explicit tenant-not-found as not provisioned", async () => {
 assert.equal(await discoverMicrosoftTenant("customer.onmicrosoft.com",async()=>Response.json({error:"invalid_tenant",error_codes:[90002]},{status:400})),null)
 await assert.rejects(discoverMicrosoftTenant("customer.onmicrosoft.com",async()=>new Response("Unavailable",{status:503})),/503/)
})
test("rejects untrusted authorities and inconsistent metadata identities", async () => {
 let called=false
 await assert.rejects(discoverMicrosoftTenant("customer.evil.test",async()=>{called=true;return Response.json({})}),/initial domain/)
 assert.equal(called,false)
 for(const metadata of [
  {issuer:`https://evil.test/${id}/v2.0`,token_endpoint:`https://login.microsoftonline.com/${id}/oauth2/v2.0/token`},
  {issuer:`https://login.microsoftonline.com/${id}/v2.0`,token_endpoint:`https://login.microsoftonline.com/other/oauth2/v2.0/token`},
 ]) await assert.rejects(discoverMicrosoftTenant("customer.onmicrosoft.com",async()=>Response.json(metadata)),/metadata/)
})

test("allocates a stable service-specific namespace and skips existing names",async()=>{
 const {allocateMicrosoftInitialDomain,microsoftInitialDomainCandidate}=await import("../../src/lib/microsoftMailProvisioning/tenantDiscovery.ts")
 const scope={tenantId:56,serviceId:1,domain:"customer.test"}
 const first=microsoftInitialDomainCandidate(scope,0),second=microsoftInitialDomainCandidate(scope,1)
 assert.equal(first,microsoftInitialDomainCandidate(scope,0))
 assert.notEqual(first,second)
 assert.notEqual(first,microsoftInitialDomainCandidate({...scope,tenantId:57},0))
 const urls:string[]=[]
 const allocated=await allocateMicrosoftInitialDomain(scope,async input=>{
  urls.push(String(input))
  return urls.length===1?Response.json({issuer:`https://login.microsoftonline.com/${id}/v2.0`,token_endpoint:`https://login.microsoftonline.com/${id}/oauth2/v2.0/token`}):Response.json({error:"invalid_tenant",error_codes:[90002]},{status:400})
 })
 assert.equal(allocated.initialDomain,second)
 assert.equal(allocated.attempt,1)
 assert.equal(urls.length,2)
})
