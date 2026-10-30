import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Payload } from "payload"
import { createMicrosoftMailLivePorts } from "../../src/lib/microsoftMailProvisioning/livePorts.ts"
import { advanceMicrosoftMailProvisioning, type MicrosoftMailProvisioningRun, type MicrosoftMailProvisioningStore } from "../../src/lib/microsoftMailProvisioning/workflow.ts"

const response = (value: unknown, status = 200) => Response.json(value, { status })
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

class MemoryStore implements MicrosoftMailProvisioningStore {
  run: MicrosoftMailProvisioningRun
  constructor(run: MicrosoftMailProvisioningRun) { this.run = run }
  async findByIdempotencyKey() { return this.run }
  async create(input: Omit<MicrosoftMailProvisioningRun, "id">) { this.run = { ...input, id: 1 }; return this.run }
  async update(id: string | number, patch: Partial<MicrosoftMailProvisioningRun>) {
    assert.equal(id, this.run.id)
    this.run = { ...this.run, ...patch }
    return this.run
  }
  async get() { return this.run }
}

const request = {
  tenantId: 7,
  domain: "tap2case.nl",
  tenantPrefix: "tap2case",
  customer: {
    companyName: "Tap2case B.V.", website: "https://tap2case.nl", phone: "+31201234567",
    address: { street: "Dam 1", city: "Amsterdam", postalCode: "1000 AA", country: "NL" },
    registrationNumber: "", primaryContact: { firstName: "Ardi", lastName: "Test", email: "admin@example.org", phone: "+31201234567" },
  },
  product: "m365-business-basic-eea-no-teams" as const,
  commitment: "annual" as const,
  billing: "annual" as const,
  mailboxUsers: [
    { localPart: "ardi", displayName: "Ardi Test", userPrincipalName: "ardi@tap2case.nl", setupEmail: "ardi.setup@example.org" },
    { localPart: "aslan", displayName: "Aslan Test", userPrincipalName: "aslan@tap2case.nl", setupEmail: "aslan.setup@example.org" },
  ],
  quantity: 2,
  retainInfoForward: true,
  infoForwardTo: "info@amapromotions.nl", infoAliasTarget: null,
}

describe("live provider orchestration with mocked HTTP boundaries", () => {
  for (const sharedInbox of [false,true]) for (const sharedRecipient of [false,true]) it(`provisions safely and groups setup messages: shared inbox=${sharedInbox}, shared recipient=${sharedRecipient}`, async () => {
    const providerRequests: Array<{ method: string; url: URL; body: unknown }> = []
    const workerOperations: string[] = []
    const sent: Array<{ to: string | string[]; html: string }> = []
    const graphUserPasswords: string[] = []
    let dkimReady = false
    let userSequence = 0
    let mxLocked = !sharedRecipient
    let mailboxesReady = true
    const users = new Map<string, Record<string, unknown>>()
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      MICROSOFT_PARTNER_TENANT_ID: "00000000-0000-0000-0000-000000000001",
      MICROSOFT_PARTNER_APP_CLIENT_ID: "partner-app-id",
      MICROSOFT_PARTNER_APP_CLIENT_SECRET: "partner-secret",
      MICROSOFT_PARTNER_APP_REDIRECT_URI: "https://admin.siteinabox.nl/operations/microsoft-mail/consent/callback",
      MICROSOFT_GDAP_ROLE_DEFINITION_IDS: "11111111-1111-1111-1111-111111111111",
      MICROSOFT_PARTNER_SECURITY_GROUP_ID: "22222222-2222-2222-2222-222222222222",
      MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
      PAX8_CLIENT_ID: "pax8-client",
      PAX8_CLIENT_SECRET: "pax8-secret",
      CLOUDFLARE_API_TOKEN: "cf-token",
      CLOUDFLARE_ACCOUNT_ID: "cf-account",
      EXCHANGE_WORKER_URL: "https://exchange-worker.internal/jobs",
      EXCHANGE_WORKER_SHARED_SECRET: "x".repeat(40),
      SITE_URL: "https://admin.siteinabox.nl",
    }
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? "GET"
      let body: unknown = null
      if (typeof init?.body === "string") {
        try { body = JSON.parse(init.body) } catch { body = new URLSearchParams(init.body) }
      } else if (init?.body instanceof URLSearchParams) body = init.body
      providerRequests.push({ method, url, body })

      if (url.hostname === "login.microsoftonline.com") return response({ access_token: "mock-ms-token", expires_in: 3600 })
      if (url.hostname === "api.pax8.com") {
        if (url.pathname === "/v1/token") return response({ access_token: "mock-pax8-token", expires_in: 3600 })
        if (url.pathname === "/v1/subscriptions") return response({ content: [{ id: "pax8-sub-1", companyId: "pax8-company-1", productId: "1bdd7ebb-f994-421f-ae98-b6a57bd9f947", status: "Active", quantity: 2, billingTerm: "Annual" }], page: { number: 0, totalPages: 1 } })
        if (url.pathname === "/v1/subscriptions/pax8-sub-1") return response({ id: "pax8-sub-1", companyId: "pax8-company-1", productId: "1bdd7ebb-f994-421f-ae98-b6a57bd9f947", status: "Active", quantity: 2, billingTerm: "Annual", vendorSkuId: "sku-basic-eea" })
        throw new Error(`Unexpected Pax8 mock request ${method} ${url.pathname}`)
      }
      if (url.hostname === "graph.microsoft.com") {
        const pathname = decodeURIComponent(url.pathname)
        if (pathname.endsWith("/tenantRelationships/delegatedAdminRelationships/gdap-1")) return response({ id: "gdap-1", status: "active", customer: { tenantId: "00000000-0000-0000-0000-000000000002" }, accessDetails: { unifiedRoles: [{ roleDefinitionId: env.MICROSOFT_GDAP_ROLE_DEFINITION_IDS }] } })
        if (pathname.endsWith("/accessAssignments") || pathname.endsWith("/accessAssignments/gdap-assignment-1")) return response({ id: "gdap-assignment-1", status: "active", accessContainer: { accessContainerId: env.MICROSOFT_PARTNER_SECURITY_GROUP_ID, accessContainerType: "securityGroup" }, accessDetails: { unifiedRoles: [{ roleDefinitionId: env.MICROSOFT_GDAP_ROLE_DEFINITION_IDS }] } })
        if (pathname.endsWith("/organization")) return response({ value: [{ id: "00000000-0000-0000-0000-000000000002", displayName: "Tap2case", verifiedDomains: [{ name: "tap2case.onmicrosoft.com", isInitial: true }] }] })
        if (pathname.endsWith("/domains/tap2case.nl")) return response({ id: "tap2case.nl", isVerified: true, isDefault: false })
        if (pathname.endsWith("/verificationDnsRecords")) return response({ value: [] })
        if (pathname.endsWith("/serviceConfigurationRecords")) return response({ value: [
          { recordType: "Mx", label: "@", mailExchange: "tap2case-nl.mail.protection.outlook.com", preference: 0 },
          { recordType: "CName", label: "autodiscover", canonicalName: "autodiscover.outlook.com" },
        ] })
        if (pathname.endsWith("/subscribedSkus")) return response({ value: [{ skuId: "sku-basic-eea", skuPartNumber: "O365_BUSINESS_ESSENTIALS", prepaidUnits: { enabled: 2 } }] })
        if (pathname.includes("/users/") && method === "GET") { const found = users.get(pathname.split("/users/")[1] ?? ""); return found ? response(found) : response({ error: { code: "Request_ResourceNotFound" } }, 404) }
        if (pathname.endsWith("/users")) {
          graphUserPasswords.push(String(object(body).passwordProfile && (object(object(body).passwordProfile).password)))
          userSequence += 1
          const created = { id: `graph-user-${userSequence}`, userPrincipalName: object(body).userPrincipalName, displayName: object(body).displayName }; users.set(String(created.userPrincipalName), created); return response(created)
        }
        if (pathname.includes("/assignLicense")) return response({ value: [] })
        throw new Error(`Unexpected Graph mock request ${method} ${url.pathname}`)
      }
      if (url.hostname === "api.cloudflare.com") {
        if (url.pathname.endsWith("/email/routing/dns") && method === "PATCH") {
          mxLocked = false
          return response({ success: true })
        }
        if (url.pathname === "/client/v4/zones") return response({ success: true, result: [{ id: "zone-1", name: "tap2case.nl", status: "active" }] })
        if (url.pathname.endsWith("/email/routing/rules/catch_all")) return response({ success: true, result: { enabled: false } })
        if (url.pathname.endsWith("/email/routing/rules")) return response({ success: true, result: [{
          enabled: true,
          matchers: [{ type: "literal", field: "to", value: "info@tap2case.nl" }],
          actions: [{ type: "forward", value: ["info@amapromotions.nl"] }],
        }] })
        if (url.pathname.endsWith("/dns_records") && method === "GET") return response({ success: true, result: [
          { id: "cf-mx-1", type: "MX", name: "tap2case.nl", content: "route1.mx.cloudflare.net", priority: 10, proxied: false, meta: { email_routing: true, read_only: mxLocked } },
          { id: "spf-1", type: "TXT", name: "tap2case.nl", content: "v=spf1 include:_spf.google.com ~all", proxied: false },
        ], result_info: { total_pages: 1 } })
        if (url.pathname.endsWith("/dns_records") && method === "POST") return response({ success: true, result: { id: "created-dns" } })
        if (url.pathname.includes("/dns_records/") && ["PUT", "DELETE"].includes(method)) return response({ success: true, result: {} })
        throw new Error(`Unexpected Cloudflare mock request ${method} ${url.pathname}`)
      }
      if (url.hostname === "exchange-worker.internal") {
        const job = JSON.parse(String(init?.body ?? "{}")) as { operation: string }
        workerOperations.push(job.operation)
        if (job.operation === "enable_dkim" && !dkimReady) { dkimReady = true; return response({ operation: job.operation, completed: true, dkimEnabled: false, dkimDnsReady: false }) }
        if (job.operation === "verify_access") return response({ operation: job.operation, completed: true, accessVerified: true })
        if (job.operation === "verify_mailboxes") return response({ operation: job.operation, completed: true, mailboxesReady })
        if (job.operation === "ensure_info_shared") return response({ operation: job.operation, completed: true, sharedMailbox: "info@tap2case.nl", sharedMailboxMembers: ["ardi@tap2case.nl", "aslan@tap2case.nl"] })
        if (job.operation === "ensure_info_forward") return response({ operation: job.operation, completed: true, sharedMailbox: "info@tap2case.nl", forwardingAddress: "info@amapromotions.nl" })
        return response({ operation: job.operation, completed: true, dkimEnabled: true, dkimRecords: [
          { selector: "selector1", target: "selector1-tap2case._domainkey.partner.n-v1.dkim.mail.microsoft" },
          { selector: "selector2", target: "selector2-tap2case._domainkey.partner.n-v1.dkim.mail.microsoft" },
        ] })
      }
      throw new Error(`Unexpected mock HTTP request ${method} ${url.toString()}`)
    }
    const ports = createMicrosoftMailLivePorts({
      payload: {} as Payload,
      tokenProvider: async () => "mock-delegated-token", partnerUserPrincipalName: "obo@partner.onmicrosoft.com",
      env,
      fetchImpl,
      createSetupTokenImpl: async () => "mock-one-time-token-abcdefghijklmnopqrstuvwxyz1234567890",
      sendEmailImpl: async (message) => { sent.push({ to: message.to, html: message.html }); return { provider: "mock" } },
      buildSetupBatchEmailMessage: ({ mailboxes }) => ({ subject: "Mailboxes ready", html: mailboxes.map(box => `<p>${box.userPrincipalName}</p><a href="${box.setupUrl}">Open setup</a>`).join(""), text: "Setup links" }),
      buildSetupEmailMessage: ({ userPrincipalName, setupUrl }) => ({
        subject: "Mailbox ready",
        html: `<p>${userPrincipalName}</p><a href="${setupUrl}">Open setup</a>`,
        text: `${userPrincipalName} ${setupUrl}`,
      }),
    })
    const now = new Date().toISOString()
    const run: MicrosoftMailProvisioningRun = {
      id: 1,
      idempotencyKey: "test-live-provider-run",
      mode: "live",
      tenantId: 7,
      domain: request.domain,
      tenantPrefix: request.tenantPrefix,
      request: { ...request, ...(sharedInbox ? { infoSharedMailbox: true, retainInfoForward: false, infoForwardTo: null } : {}), mailboxUsers: request.mailboxUsers.map(user => ({ ...user, setupEmail: sharedRecipient ? "owner.setup@example.org" : user.setupEmail })) },
      state: "subscription_pending",
      currentStep: "mca_acceptance",
      completedSteps: ["tenant_bootstrap", "subscription"],
      data: {
        pax8CompanyId: "pax8-company-1",
        pax8OrderId: "pax8-order-1",
        pax8OrderLineItems: [{ productId: "1bdd7ebb-f994-421f-ae98-b6a57bd9f947", subscriptionId: "pax8-sub-1", quantity: 2, billingTerm: "Annual" }],
        customerTenantId: "00000000-0000-0000-0000-000000000002",
        mcaAccepted: true,
        gdapRelationshipId: "gdap-1", gdapAccessAssignmentId: "gdap-assignment-1",
        appConsentVerified: true, appConsentVersion: "microsoft-mail-app-grants-v1",
        customerOrganizationDomain: "tap2case.onmicrosoft.com",
        mailboxCreationConfirmed: true,
      },
      actionUrl: null,
      issueCode: null,
      createdAt: now,
      updatedAt: now,
    }
    const store = new MemoryStore(run)
    const dnsReview = await advanceMicrosoftMailProvisioning({ run, store, ports })
    assert.equal(dnsReview.state, "dns_pending")
    assert.equal(dnsReview.issueCode, "DNS_PREPARATION_CONFIRMATION_REQUIRED")
    assert.ok(Array.isArray(dnsReview.data.dnsPreparationChanges))
    const cutoverReviewInput = await store.update(run.id, {
      data: { ...dnsReview.data, dnsPreparationConfirmed: true },
    })
    let cutoverReview = await advanceMicrosoftMailProvisioning({ run: cutoverReviewInput, store, ports })
    for (let index = 0; index < 6 && ["MAILBOX_USER_CREATED", "MAILBOX_LICENSE_ASSIGNED"].includes(cutoverReview.issueCode ?? ""); index++) {
      cutoverReview = await advanceMicrosoftMailProvisioning({ run: cutoverReview, store, ports })
    }
    assert.equal(cutoverReview.state, "dns_pending")
    assert.equal(cutoverReview.issueCode, "DNS_MX_CUTOVER_CONFIRMATION_REQUIRED")
    assert.ok(Array.isArray(cutoverReview.data.dnsCutoverChanges))
    assert.equal(providerRequests.some(call => call.method === "PATCH"), false, "preparation and unconfirmed cutover never unlock existing mail DNS")
    const cutoverConfirmed = await store.update(run.id, {
      data: { ...cutoverReview.data, dnsCutoverConfirmed: true },
    })
    mailboxesReady = false
    const notReady = await ports.dns_cutover({ run: cutoverConfirmed, request: cutoverConfirmed.request })
    assert.equal(notReady.kind, "waiting")
    assert.equal(providerRequests.some(call => call.method === "PATCH"), false, "mailbox propagation never unlocks existing mail DNS")
    mailboxesReady = true
    const propagating = await advanceMicrosoftMailProvisioning({ run: cutoverConfirmed, store, ports })
    assert.equal(propagating.state, "exchange_pending")
    assert.equal(propagating.issueCode, "DKIM_DNS_PROPAGATING")
    assert.equal(sent.length, 0)
    const finished = await advanceMicrosoftMailProvisioning({ run: propagating, store, ports })
    assert.equal(finished.state, "ready", `Issue: ${finished.issueCode}`)
    assert.equal(sharedInbox ? finished.data.infoSharedMailbox : finished.data.infoForwardTo, sharedInbox ? "info@tap2case.nl" : "info@amapromotions.nl")
    assert.equal(finished.data.dkimEnabled, true)
    assert.deepEqual(finished.data.setupEmailStates, { "ardi@tap2case.nl": "sent", "aslan@tap2case.nl": "sent" })
    assert.deepEqual(sent.map((mail) => mail.to), sharedRecipient ? ["owner.setup@example.org"] : ["ardi.setup@example.org", "aslan.setup@example.org"])
    assert.deepEqual(finished.request.mailboxUsers.map(user => user.setupEmail), ["", ""])
    assert.ok(sent.every((mail) => mail.html.includes("#mock-one-time-token-")))
    assert.ok(sent.every((mail) => !graphUserPasswords.some((password) => password && mail.html.includes(password))))
    assert.equal(graphUserPasswords.length, 2)
    assert.ok(workerOperations.indexOf("get_dkim_targets") < workerOperations.indexOf(sharedInbox ? "ensure_info_shared" : "ensure_info_forward"))
    assert.ok(workerOperations.includes("verify_mailboxes"))
    assert.equal(workerOperations.at(-1), "enable_dkim")
    assert.ok(providerRequests.some((call) => call.url.hostname === "api.cloudflare.com" && call.method === "DELETE"))
    const unlockIndex = providerRequests.findIndex(call => call.method === "PATCH" && call.url.pathname.endsWith("/email/routing/dns"))
    if (!sharedRecipient) {
      assert.ok(unlockIndex > providerRequests.findIndex(call => call.url.hostname === "exchange-worker.internal" && object(call.body).operation === "verify_mailboxes"))
      assert.ok(unlockIndex > providerRequests.findIndex(call => call.url.hostname === "exchange-worker.internal" && object(call.body).operation === (sharedInbox ? "ensure_info_shared" : "ensure_info_forward")))
      assert.ok(unlockIndex < providerRequests.findIndex(call => call.url.hostname === "api.cloudflare.com" && call.method === "DELETE"))
    } else assert.equal(unlockIndex, -1, "unlocked mail domains require no settings mutation")
    assert.ok(providerRequests.some((call) => call.url.hostname === "api.pax8.com" && call.url.pathname === "/v1/subscriptions/pax8-sub-1"))
  })
})

it("discovers a freshly ordered tenant only after absence evidence and matching partner delegation", async () => {
 const customerId="12345678-1234-4234-8234-123456789abc"
 const env: NodeJS.ProcessEnv={NODE_ENV:"test",MICROSOFT_PARTNER_TENANT_ID:"partner",MICROSOFT_PARTNER_APP_CLIENT_ID:"app",MICROSOFT_PARTNER_APP_CLIENT_SECRET:"secret",MICROSOFT_PARTNER_APP_REDIRECT_URI:"https://admin.test/callback",MICROSOFT_GDAP_ROLE_DEFINITION_IDS:"role",MICROSOFT_PARTNER_SECURITY_GROUP_ID:"group",CLOUDFLARE_API_TOKEN:"token",CLOUDFLARE_ACCOUNT_ID:"account",EXCHANGE_WORKER_URL:"https://worker.test/jobs",EXCHANGE_WORKER_SHARED_SECRET:"x".repeat(40),PAX8_CLIENT_ID:"id",PAX8_CLIENT_SECRET:"secret"}
 let associated=false
 const ports=createMicrosoftMailLivePorts({payload:{} as Payload,env,tokenProvider:async()=>"token",fetchImpl:async input=>{
  const url=new URL(String(input))
  if(url.hostname==="login.microsoftonline.com")return response({issuer:`https://login.microsoftonline.com/${customerId}/v2.0`,token_endpoint:`https://login.microsoftonline.com/${customerId}/oauth2/v2.0/token`})
  if(url.hostname==="graph.microsoft.com")return response({value:associated?[{id:"relationship",status:"active",customer:{tenantId:customerId}}]:[]})
  throw new Error("Unexpected bootstrap call")
 }})
 const now=new Date().toISOString()
 const run:MicrosoftMailProvisioningRun={id:99,idempotencyKey:"new-tenant",mode:"live",tenantId:7,domain:request.domain,tenantPrefix:request.tenantPrefix,request,state:"subscription_pending",currentStep:"tenant_identity",completedSteps:["tenant_bootstrap","subscription"],data:{pax8CompanyId:"company",pax8OrderId:"order"},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now}
 assert.deepEqual(await ports.tenant_identity({run,request}),{kind:"manual_review",code:"MICROSOFT_TENANT_BOOTSTRAP_EVIDENCE_REQUIRED"})
 run.data={...run.data,bootstrapInitialDomain:"tap2case.onmicrosoft.com",bootstrapInitialDomainAbsentAt:now}
 const pending=await ports.tenant_identity({run,request})
 assert.equal(pending.kind,"waiting")
 if(pending.kind!=="waiting")throw new Error("Expected pending association")
 assert.equal(pending.code,"MICROSOFT_RESELLER_ASSOCIATION_PENDING")
 const waiting=await advanceMicrosoftMailProvisioning({run,store:new MemoryStore(run),ports})
 assert.equal(waiting.state,"consent_pending")
 assert.equal(waiting.issueCode,"MICROSOFT_RESELLER_ASSOCIATION_PENDING")
 associated=true
 const found=await ports.tenant_identity({run,request})
 assert.equal(found.kind,"waiting")
 if(found.kind!=="waiting")throw new Error("Expected persisted tenant discovery")
 assert.equal(found.data?.customerTenantId,customerId)
 assert.deepEqual(found.data?.discoveredGdapRelationshipIds,["relationship"])
 assert.equal(found.data?.mcaAccepted,undefined)
})


it("does not resend a setup credential after it was already claimed",async()=>{
 const env:NodeJS.ProcessEnv={NODE_ENV:"test",MICROSOFT_PARTNER_TENANT_ID:"partner",MICROSOFT_PARTNER_APP_CLIENT_ID:"app",MICROSOFT_PARTNER_APP_CLIENT_SECRET:"secret",MICROSOFT_PARTNER_APP_REDIRECT_URI:"https://admin.test/callback",MICROSOFT_GDAP_ROLE_DEFINITION_IDS:"role",MICROSOFT_PARTNER_SECURITY_GROUP_ID:"group",CLOUDFLARE_API_TOKEN:"token",CLOUDFLARE_ACCOUNT_ID:"account",EXCHANGE_WORKER_URL:"https://worker.test/jobs",EXCHANGE_WORKER_SHARED_SECRET:"x".repeat(40),PAX8_CLIENT_ID:"id",PAX8_CLIENT_SECRET:"secret",MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY:"synthetic-key",SITE_URL:"https://admin.test"}
 const ports=createMicrosoftMailLivePorts({payload:{} as Payload,env,tokenProvider:async()=>"token",createSetupTokenImpl:async()=>null,sendEmailImpl:async()=>{throw new Error("Consumed credentials must not be resent")}})
 const now=new Date().toISOString()
 const user=request.mailboxUsers[0]!
 const run:MicrosoftMailProvisioningRun={id:100,idempotencyKey:"already-viewed",mode:"live",tenantId:7,domain:request.domain,tenantPrefix:request.tenantPrefix,request,state:"setup_mail_pending",currentStep:"setup_email",completedSteps:[],data:{setupCredentialBundles:{[user.userPrincipalName]:"encrypted-fixture"}},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now}
 const result=await ports.sendSetupEmail({run,request,user})
 assert.equal(result.kind,"complete")
 if(result.kind!=="complete")throw new Error("Already accessed credential should complete delivery")
 assert.deepEqual(result.data?.setupCredentialBundles,{})
 assert.deepEqual(result.data?.setupEmailStates,{[user.userPrincipalName]:"sent"})
})

it("reuses provider delegation and its existing group assignment instead of asking the customer again",async()=>{
 const ids=["fe930be7-5e62-47db-91af-98c3a49a38b1","4d6ac14f-3453-41d0-bef9-a3e0c569773a","e8611ab8-c189-46e8-94e1-60213ab1f814"]
 const customerId="12345678-1234-4234-8234-123456789abc"
 const env:NodeJS.ProcessEnv={NODE_ENV:"test",MICROSOFT_PARTNER_TENANT_ID:"partner",MICROSOFT_PARTNER_APP_CLIENT_ID:"app",MICROSOFT_PARTNER_APP_CLIENT_SECRET:"secret",MICROSOFT_PARTNER_APP_REDIRECT_URI:"https://admin.test/callback",MICROSOFT_GDAP_ROLE_DEFINITION_IDS:"requested-but-not-granted",MICROSOFT_PARTNER_SECURITY_GROUP_ID:"group",CLOUDFLARE_API_TOKEN:"token",CLOUDFLARE_ACCOUNT_ID:"account",EXCHANGE_WORKER_URL:"https://worker.test/jobs",EXCHANGE_WORKER_SHARED_SECRET:"x".repeat(40),PAX8_CLIENT_ID:"id",PAX8_CLIENT_SECRET:"secret"}
 const relationship={id:"provider-relationship",status:"active",customer:{tenantId:customerId},accessDetails:{unifiedRoles:ids.map(roleDefinitionId=>({roleDefinitionId}))}}
 const assignment={id:"existing-assignment",status:"active",accessContainer:{accessContainerId:"group",accessContainerType:"securityGroup"},accessDetails:{unifiedRoles:[...ids,"existing-extra-role"].map(roleDefinitionId=>({roleDefinitionId}))}}
 let writes=0
 const ports=createMicrosoftMailLivePorts({payload:{} as Payload,env,tokenProvider:async()=>"token",fetchImpl:async(input,init)=>{
  if(init?.method!=="GET")writes++
  const path=new URL(String(input)).pathname
  if(path.endsWith("/accessAssignments/existing-assignment"))return response(assignment)
  if(path.endsWith("/accessAssignments"))return response({value:[assignment]})
  if(path.endsWith("/provider-relationship"))return response(relationship)
  return response({value:[relationship]})
 }})
 const now=new Date().toISOString()
 const run:MicrosoftMailProvisioningRun={id:101,idempotencyKey:"provider-discovery",mode:"live",tenantId:7,domain:request.domain,tenantPrefix:request.tenantPrefix,request,state:"consent_pending",currentStep:"gdap",completedSteps:[],data:{customerTenantId:customerId,autoProvisionAuthorized:true},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now}
 for(let attempt=0;attempt<3;attempt++){
  const result=await ports.gdap({run,request})
  if(result.kind==="manual_review")throw new Error(result.code)
  run.data={...run.data,...result.data}
  if(attempt===2)assert.equal(result.kind,"complete")
 }
 assert.equal(run.data.gdapRelationshipId,relationship.id)
 assert.equal(run.data.gdapAccessAssignmentId,assignment.id)
 assert.deepEqual(run.data.mailGdapRoleDefinitionIds,ids)
 assert.equal(writes,0)
})

it("advances provider-handled agreement setup from recorded acceptance and verified fulfillment without claiming upstream attestation",async()=>{
 const customerId="12345678-1234-4234-8234-123456789abc"
 const env:NodeJS.ProcessEnv={NODE_ENV:"test",MICROSOFT_PARTNER_TENANT_ID:"partner",MICROSOFT_PARTNER_APP_CLIENT_ID:"app",MICROSOFT_PARTNER_APP_CLIENT_SECRET:"secret",MICROSOFT_PARTNER_APP_REDIRECT_URI:"https://admin.test/callback",MICROSOFT_GDAP_ROLE_DEFINITION_IDS:"role",MICROSOFT_PARTNER_SECURITY_GROUP_ID:"group",CLOUDFLARE_API_TOKEN:"token",CLOUDFLARE_ACCOUNT_ID:"account",EXCHANGE_WORKER_URL:"https://worker.test/jobs",EXCHANGE_WORKER_SHARED_SECRET:"x".repeat(40),PAX8_CLIENT_ID:"id",PAX8_CLIENT_SECRET:"secret"}
 let active=false,companyMatches=true
 const ports=createMicrosoftMailLivePorts({payload:{} as Payload,env,tokenProvider:async()=>"token",fetchImpl:async input=>{
  const url=new URL(String(input))
  if(url.pathname==="/v1/token")return response({access_token:"token",expires_in:3600})
  if(url.pathname==="/v1/orders/order")return response({id:"order",companyId:companyMatches?"company":"other-company",lineItems:[{productId:"1bdd7ebb-f994-421f-ae98-b6a57bd9f947",subscriptionId:"subscription",quantity:2,billingTerm:"Annual"}]})
  if(url.pathname==="/v1/subscriptions/subscription")return response({id:"subscription",companyId:"company",productId:"1bdd7ebb-f994-421f-ae98-b6a57bd9f947",status:active?"Active":"Provisioning",quantity:2,billingTerm:"Annual",vendorSkuId:"sku"})
  if(url.pathname==="/v1.0/subscribedSkus")return response({value:[{skuId:"sku",skuPartNumber:"BASIC_EEA_NO_TEAMS",prepaidUnits:{enabled:2},consumedUnits:0}]})
  throw new Error("Unexpected agreement verification request")
 }})
 const now=new Date().toISOString()
 const run:MicrosoftMailProvisioningRun={id:102,idempotencyKey:"provider-agreement",mode:"live",tenantId:7,domain:request.domain,tenantPrefix:request.tenantPrefix,request,state:"consent_pending",currentStep:"mca_acceptance",completedSteps:[],data:{customerTenantId:customerId,autoProvisionAuthorized:true,customerConsent:{mcaAccepted:true,serviceAuthorized:true,confirmSignatoryAuthority:true,signatoryFirstName:"Fixture",signatoryLastName:"Owner",signatoryEmail:"owner@example.test",acceptedAt:now,mcaDocumentUrl:"https://aka.ms/customeragreement",mcaCountry:"NL",mcaChannel:"CSP Partner",mcaAudience:"Commercial",consentCopyVersion:"fixture"}},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now}
 const missing=await ports.mca_acceptance({run,request})
 assert.deepEqual(missing,{kind:"manual_review",code:"CUSTOMER_AGREEMENT_HANDOFF_EVIDENCE_REQUIRED"})
 run.data={...run.data,pax8CompanyId:"company",pax8OrderId:"order",pax8McaAttestation:{status:"submitted_with_order",customerAcceptedAt:now,submittedAt:now}}
 companyMatches=false
 assert.deepEqual(await ports.mca_acceptance({run,request}),{kind:"manual_review",code:"CUSTOMER_AGREEMENT_PROVIDER_BINDING_MISMATCH"})
 companyMatches=true
 const pending=await ports.mca_acceptance({run,request})
 assert.equal(pending.kind,"waiting")
 active=true
 const fulfilled=await ports.mca_acceptance({run,request})
 assert.equal(fulfilled.kind,"complete")
 if(fulfilled.kind!=="complete")throw new Error("Expected operational fulfillment evidence")
 assert.equal(fulfilled.data?.customerAgreementAccepted,true)
 assert.equal(fulfilled.data?.mcaUpstreamStatus,"provider_managed_unverified")
 assert.equal(fulfilled.data?.mcaAccepted,undefined)
 assert.equal(fulfilled.data?.mcaAttestationConfirmed,undefined)
})

it("preserves accepted resource grants while Exchange consent and read access propagate", async () => {
 const customerId="12345678-1234-4234-8234-123456789abc"
 const env:NodeJS.ProcessEnv={NODE_ENV:"test",MICROSOFT_PARTNER_TENANT_ID:"partner",MICROSOFT_PARTNER_APP_CLIENT_ID:"app",MICROSOFT_PARTNER_APP_CLIENT_SECRET:"secret",MICROSOFT_PARTNER_APP_REDIRECT_URI:"https://admin.test/callback",MICROSOFT_GDAP_ROLE_DEFINITION_IDS:"role",MICROSOFT_PARTNER_SECURITY_GROUP_ID:"group",CLOUDFLARE_API_TOKEN:"token",CLOUDFLARE_ACCOUNT_ID:"account",EXCHANGE_WORKER_URL:"https://worker.test/jobs",EXCHANGE_WORKER_SHARED_SECRET:"x".repeat(40),PAX8_CLIENT_ID:"id",PAX8_CLIENT_SECRET:"secret"}
 let graphWrites=0,exchangeWrites=0,readReady=false
 const ports=createMicrosoftMailLivePorts({payload:{} as Payload,env,partnerUserPrincipalName:"operator@partner.onmicrosoft.com",tokenProvider:async()=>"token",fetchImpl:async(input,init)=>{
  const url=new URL(String(input))
  if(url.hostname==="api.partnercenter.microsoft.com"){
   const body=object(JSON.parse(String(init?.body)))
   const grant=object((body.applicationGrants as unknown[])[0])
   if(grant.enterpriseApplicationId==="00000003-0000-0000-c000-000000000000"){graphWrites++;return response({})}
   exchangeWrites++;return response({},exchangeWrites===1?400:200)
  }
  if(url.hostname==="graph.microsoft.com")return response({value:[{id:customerId,verifiedDomains:[{name:"tap2case.onmicrosoft.com",isInitial:true}]}]})
  if(url.hostname==="worker.test")return readReady?response({operation:"verify_access",completed:true,accessVerified:true}):response({error:"temporarily_unavailable"},503)
  throw new Error("Unexpected consent propagation request")
 }})
 const now=new Date().toISOString()
 const run:MicrosoftMailProvisioningRun={id:103,idempotencyKey:"resource-retry",mode:"live",tenantId:7,domain:request.domain,tenantPrefix:request.tenantPrefix,request,state:"consent_pending",currentStep:"application_consent",completedSteps:[],data:{customerTenantId:customerId,autoProvisionAuthorized:true,bootstrapInitialDomain:"tap2case.onmicrosoft.com"},actionUrl:null,issueCode:null,createdAt:now,updatedAt:now}
 async function advance(){const result=await ports.application_consent({run,request});if(result.kind!=="manual_review")run.data={...run.data,...result.data};return result}
 assert.equal((await advance()).kind,"waiting")
 assert.equal((await advance()).kind,"waiting")
 assert.equal((await advance()).kind,"waiting")
 const propagating=await advance()
 assert.equal(propagating.kind,"waiting","new tenant Exchange read propagation should retry automatically")
 readReady=true
 assert.equal((await advance()).kind,"complete")
 assert.equal(graphWrites,1,"a confirmed Graph grant must not be submitted again")
 assert.equal(exchangeWrites,2)
 assert.equal(run.data.appConsentVerified,true)
})
