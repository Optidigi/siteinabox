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
  for (const sharedRecipient of [false,true]) it(`provisions safely and groups setup messages: shared recipient=${sharedRecipient}`, async () => {
    const providerRequests: Array<{ method: string; url: URL; body: unknown }> = []
    const workerOperations: string[] = []
    const sent: Array<{ to: string | string[]; html: string }> = []
    const graphUserPasswords: string[] = []
    let userSequence = 0
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
        if (url.pathname === "/client/v4/zones") return response({ success: true, result: [{ id: "zone-1", name: "tap2case.nl", status: "active" }] })
        if (url.pathname.endsWith("/email/routing/rules/catch_all")) return response({ success: true, result: { enabled: false } })
        if (url.pathname.endsWith("/email/routing/rules")) return response({ success: true, result: [{
          enabled: true,
          matchers: [{ type: "literal", field: "to", value: "info@tap2case.nl" }],
          actions: [{ type: "forward", value: ["info@amapromotions.nl"] }],
        }] })
        if (url.pathname.endsWith("/dns_records") && method === "GET") return response({ success: true, result: [
          { id: "cf-mx-1", type: "MX", name: "tap2case.nl", content: "route1.mx.cloudflare.net", priority: 10, proxied: false },
          { id: "spf-1", type: "TXT", name: "tap2case.nl", content: "v=spf1 include:_spf.google.com ~all", proxied: false },
        ], result_info: { total_pages: 1 } })
        if (url.pathname.endsWith("/dns_records") && method === "POST") return response({ success: true, result: { id: "created-dns" } })
        if (url.pathname.includes("/dns_records/") && ["PUT", "DELETE"].includes(method)) return response({ success: true, result: {} })
        throw new Error(`Unexpected Cloudflare mock request ${method} ${url.pathname}`)
      }
      if (url.hostname === "exchange-worker.internal") {
        const job = JSON.parse(String(init?.body ?? "{}")) as { operation: string }
        workerOperations.push(job.operation)
        if (job.operation === "verify_access") return response({ operation: job.operation, completed: true, accessVerified: true })
        if (job.operation === "verify_mailboxes") return response({ operation: job.operation, completed: true, mailboxesReady: true })
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
      request: sharedRecipient ? { ...request, mailboxUsers: request.mailboxUsers.map(user => ({ ...user, setupEmail: "owner.setup@example.org" })) } : request,
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
    const cutoverConfirmed = await store.update(run.id, {
      data: { ...cutoverReview.data, dnsCutoverConfirmed: true },
    })
    const finished = await advanceMicrosoftMailProvisioning({ run: cutoverConfirmed, store, ports })
    assert.equal(finished.state, "ready", `Issue: ${finished.issueCode}`)
    assert.equal(finished.data.infoForwardTo, "info@amapromotions.nl")
    assert.equal(finished.data.dkimEnabled, true)
    assert.deepEqual(finished.data.setupEmailStates, { "ardi@tap2case.nl": "sent", "aslan@tap2case.nl": "sent" })
    assert.deepEqual(sent.map((mail) => mail.to), sharedRecipient ? ["owner.setup@example.org"] : ["ardi.setup@example.org", "aslan.setup@example.org"])
    assert.deepEqual(finished.request.mailboxUsers.map(user => user.setupEmail), ["", ""])
    assert.ok(sent.every((mail) => mail.html.includes("#mock-one-time-token-")))
    assert.ok(sent.every((mail) => !graphUserPasswords.some((password) => password && mail.html.includes(password))))
    assert.equal(graphUserPasswords.length, 2)
    assert.ok(workerOperations.indexOf("get_dkim_targets") < workerOperations.indexOf("ensure_info_forward"))
    assert.ok(workerOperations.includes("verify_mailboxes"))
    assert.equal(workerOperations.at(-1), "enable_dkim")
    assert.ok(providerRequests.some((call) => call.url.hostname === "api.cloudflare.com" && call.method === "DELETE"))
    assert.ok(providerRequests.some((call) => call.url.hostname === "api.pax8.com" && call.url.pathname === "/v1/subscriptions/pax8-sub-1"))
  })
})
