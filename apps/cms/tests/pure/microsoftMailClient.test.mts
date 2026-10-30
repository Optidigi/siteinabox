import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MicrosoftMailClient } from "../../src/lib/microsoftMailProvisioning/microsoft.ts"

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" },
})

describe("Microsoft mail client mock adapter", () => {
  it("builds a tenant-specific admin consent URL with a registered HTTPS return address and state", () => {
    const client = new MicrosoftMailClient({
      partnerTenantId: "optidigi-tenant-id",
      clientId: "optidigi-csp-app",
      accessToken: async () => "token",
      appConsentRedirectUri: "https://admin.siteinabox.nl/operations/microsoft-mail/consent/callback",
    })
    const url = new URL(client.appConsentUrl("customer-tenant-id", "42.random-state"))
    assert.equal(url.hostname, "login.microsoftonline.com")
    assert.equal(url.pathname, "/customer-tenant-id/adminconsent")
    assert.equal(url.searchParams.get("client_id"), "optidigi-csp-app")
    assert.equal(url.searchParams.get("redirect_uri"), "https://admin.siteinabox.nl/operations/microsoft-mail/consent/callback")
    assert.equal(url.searchParams.get("state"), "42.random-state")
    assert.throws(() => client.appConsentUrl("customer-tenant-id", ""), /redirect URI and state are required/)
    assert.throws(() => new MicrosoftMailClient({
      partnerTenantId: "optidigi-tenant-id", clientId: "app", accessToken: async () => "token", appConsentRedirectUri: "http://admin.siteinabox.nl/callback",
    }), /HTTPS/)
  })

  it("creates a verified customer domain through the Graph domain endpoints", async () => {
    const calls: Array<{ url: URL; method: string; body: unknown }> = []
    const client = new MicrosoftMailClient({
      partnerTenantId: "optidigi-tenant-id",
      clientId: "optidigi-csp-app",
      accessToken: async ({ resource }) => `token-${resource}`,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        let body: unknown
        if (typeof init?.body === "string") body = JSON.parse(init.body)
        calls.push({ url, method, body })
        if (url.pathname === "/v1.0/domains/tap2case.nl" && method === "GET") {
          return json({ error: { code: "Request_ResourceNotFound" } }, 404)
        }
        if (url.pathname === "/v1.0/domains" && method === "POST") {
          assert.deepEqual(body, { id: "tap2case.nl" }, "Graph domain creation accepts only the domain id")
          return json({ id: "tap2case.nl", isVerified: false, isDefault: false }, 201)
        }
        if (url.pathname === "/v1.0/domains/tap2case.nl/verificationDnsRecords") {
          return json({ value: [{ recordType: "Txt", label: "@", text: "MS=ms123" }] })
        }
        if (url.pathname === "/v1.0/domains/tap2case.nl/verify" && method === "POST") {
          return json({ id: "tap2case.nl", isVerified: true, isDefault: false })
        }
        return json({ error: { code: "unexpected_request" } }, 500)
      },
    })

    const domain = await client.ensureDomain("customer-tenant-id", "tap2case.nl")
    const records = await client.getDomainVerificationRecords("customer-tenant-id", "tap2case.nl")
    const verified = await client.verifyDomain("customer-tenant-id", "tap2case.nl")

    assert.equal(domain.isVerified, false)
    assert.equal(records[0]?.text, "MS=ms123")
    assert.equal(verified.isVerified, true)
    assert.deepEqual(calls.map((call) => `${call.method} ${call.url.pathname}`), [
      "GET /v1.0/domains/tap2case.nl",
      "POST /v1.0/domains",
      "GET /v1.0/domains/tap2case.nl/verificationDnsRecords",
      "POST /v1.0/domains/tap2case.nl/verify",
    ])
  })

  it("creates each requested user and assigns the license through separate Graph calls", async () => {
    const calls: Array<{ url: URL; method: string; body: unknown }> = []
    const client = new MicrosoftMailClient({
      partnerTenantId: "optidigi-tenant-id",
      clientId: "optidigi-csp-app",
      accessToken: async () => "customer-graph-token",
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        let body: unknown
        if (typeof init?.body === "string") body = JSON.parse(init.body)
        calls.push({ url, method, body })
        if (method === "GET" && url.pathname === "/v1.0/users/ardi%40tap2case.nl") {
          return json({ error: { code: "Request_ResourceNotFound" } }, 404)
        }
        if (method === "POST" && url.pathname === "/v1.0/users") {
          return json({ id: "user-ardi", userPrincipalName: "ardi@tap2case.nl", displayName: "Ardi" }, 201)
        }
        if (method === "POST" && url.pathname === "/v1.0/users/user-ardi/assignLicense") {
          return json({ value: [] })
        }
        return json({ error: { code: "unexpected_request" } }, 500)
      },
    })

    const user = await client.ensureUser("customer-tenant-id", {
      userPrincipalName: "ardi@tap2case.nl",
      displayName: "Ardi",
      mailNickname: "ardi",
      temporaryPassword: "generated-temporary-password",
      usageLocation: "NL",
    })
    await client.assignLicense("customer-tenant-id", user.id, "sku-basic-eea")

    assert.equal(user.userPrincipalName, "ardi@tap2case.nl")
    assert.deepEqual(calls.map((call) => `${call.method} ${call.url.pathname}`), [
      "GET /v1.0/users/ardi%40tap2case.nl",
      "POST /v1.0/users",
      "POST /v1.0/users/user-ardi/assignLicense",
    ])
    assert.equal(
      (calls[1]?.body as { passwordProfile: { forceChangePasswordNextSignIn: boolean } }).passwordProfile.forceChangePasswordNextSignIn,
      true,
    )
    assert.deepEqual((calls[2]?.body as { addLicenses: Array<{ skuId: string }> }).addLicenses, [
      { skuId: "sku-basic-eea", disabledPlans: [] },
    ])
  })

  it("requests and locks a GDAP relationship before exposing its Microsoft approval URL", async () => {
    const calls: Array<{ url: URL; method: string; body: unknown }> = []
    const client = new MicrosoftMailClient({
      partnerTenantId: "optidigi-tenant-id",
      clientId: "optidigi-csp-app",
      accessToken: async ({ resource }) => `token-${resource}`,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input))
        const method = init?.method ?? "GET"
        let body: unknown
        if (typeof init?.body === "string") body = JSON.parse(init.body)
        calls.push({ url, method, body })
        if (url.pathname === "/v1.0/tenantRelationships/delegatedAdminRelationships" && method === "POST") {
          return json({ id: "relationship-1", status: "created" }, 201)
        }
        if (url.pathname.endsWith("/relationship-1/requests") && method === "POST") {
          return json({ id: "request-1", action: "lockForApproval", status: "created" }, 201)
        }
        return json({ error: { code: "unexpected_request" } }, 500)
      },
    })

    const request = await client.createGdapApprovalRequest({
      customerTenantId: "customer-tenant-id",
      displayName: "Siteinabox email administration",
      durationDays: 365,
      roleDefinitionIds: ["user-admin-role", "license-admin-role", "domain-admin-role"],
    })

    assert.equal(request.relationshipId, "relationship-1")
    assert.equal(
      request.approvalUrl,
      "https://admin.microsoft.com/AdminPortal/Home#/partners/invitation/granularAdminRelationships/relationship-1",
    )
    assert.equal(calls[1]?.url.pathname, "/v1.0/tenantRelationships/delegatedAdminRelationships/relationship-1/requests")
  })
  it("does not adopt a raced user or send credentials that were never applied", async () => {
    const calls: string[] = []
    const client = new MicrosoftMailClient({ partnerTenantId: "partner", clientId: "app", accessToken: async () => "synthetic",
      fetchImpl: async (_input,init) => { calls.push(init?.method ?? "GET"); return json({ error: { code: "Request_BadRequest" } },400) } })
    await assert.rejects(client.createUser("customer", { userPrincipalName: "user@fixture.test", displayName: "User", mailNickname: "user", temporaryPassword: "Synthetic-42!", usageLocation: "NL" }))
    assert.deepEqual(calls,["POST"])
  })

})

it("discovers only matching customer delegations across Microsoft-owned pages", async () => {
 const calls: string[]=[]
 const client=new MicrosoftMailClient({partnerTenantId:"partner",clientId:"app",accessToken:async()=>"token",fetchImpl:async(input)=>{
  calls.push(String(input))
  return calls.length===1 ? Response.json({value:[{id:"other",customer:{tenantId:"other"}}],"@odata.nextLink":"https://graph.microsoft.com/v1.0/tenantRelationships/delegatedAdminRelationships?$skiptoken=next"}) : Response.json({value:[{id:"matching",customer:{tenantId:"customer"}}]})
 }})
 assert.deepEqual((await client.listCustomerGdapRelationships("customer")).map(x=>x.id),["matching"])
 assert.equal(calls.length,2)
 const unsafe=new MicrosoftMailClient({partnerTenantId:"partner",clientId:"app",accessToken:async()=>"token",fetchImpl:async()=>Response.json({value:[],"@odata.nextLink":"https://attacker.test/steal"})})
 await assert.rejects(unsafe.listCustomerGdapRelationships("customer"),/pagination/)
})

it("submits each consent resource separately with stable resource-specific request IDs", async () => {
 const calls:Array<{body:Record<string,unknown>;requestId:string}>=[]
 const client=new MicrosoftMailClient({partnerTenantId:"partner",clientId:"app",accessToken:async()=>"token",fetchImpl:async(_input,init)=>{
  calls.push({body:JSON.parse(String(init?.body)),requestId:new Headers(init?.headers).get("MS-RequestId")??""})
  return Response.json({})
 }})
 await client.consentCustomerApplication("customer","12345678-1234-4234-8234-123456789abc")
 assert.equal(calls.length,2)
 assert.deepEqual(calls.map(call=>(call.body.applicationGrants as Array<Record<string,unknown>>).length),[1,1])
 assert.notEqual(calls[0]?.requestId,calls[1]?.requestId)
 assert.equal(calls[0]?.body.applicationId,"app")
 assert.equal(calls[0]?.body.displayName,"Siteinabox mail")
 const ids=calls.map(call=>call.requestId)
 await client.consentCustomerApplication("customer","12345678-1234-4234-8234-123456789abc")
 assert.deepEqual(calls.slice(2).map(call=>call.requestId),ids)
})

it("approves only a matching provider-offered delegation and reuses existing assignments",async()=>{
 const requests:Array<{path:string;method:string;body:unknown}>=[]
 const client=new MicrosoftMailClient({partnerTenantId:"partner",clientId:"app",accessToken:async()=>"token",fetchImpl:async(input,init)=>{
  const path=new URL(String(input)).pathname,method=init?.method??"GET";requests.push({path,method,body:init?.body?JSON.parse(String(init.body)):null})
  if(path.endsWith("/accessAssignments"))return Response.json({value:[{id:"assignment",status:"active",accessContainer:{accessContainerId:"group",accessContainerType:"securityGroup"}}]})
  if(method==="GET")return Response.json({id:"offered",status:"approvalPending",customer:{tenantId:"customer"}})
  return Response.json({id:"approval-request"}, {status:201})
 }})
 assert.equal((await client.approveProviderGdap({relationshipId:"offered",customerTenantId:"customer"})).requestId,"approval-request")
 assert.deepEqual(requests.find(row=>row.method==="POST")?.body,{action:"approve"})
 assert.equal((await client.listGdapAccessAssignments("offered"))[0]?.id,"assignment")
 const before=requests.filter(row=>row.method==="POST").length
 await assert.rejects(client.approveProviderGdap({relationshipId:"offered",customerTenantId:"other"}),/customer/)
 assert.equal(requests.filter(row=>row.method==="POST").length,before)
})
