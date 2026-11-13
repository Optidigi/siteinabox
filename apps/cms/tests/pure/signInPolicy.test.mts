import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Payload } from "payload"
import { createMicrosoftMailLivePorts } from "../../src/lib/microsoftMailProvisioning/livePorts.ts"
import { requiredMailRoleIds } from "../../src/lib/microsoftMailProvisioning/mailAuthority.ts"
import { selectMailGdapRoles, mailGdapRoleIds } from "../../src/lib/microsoftMailProvisioning/gdapCapabilities.ts"
import { MicrosoftTokenRequestError } from "../../src/lib/microsoftMailProvisioning/microsoftAuth.ts"
import { readSignInPolicy, reconcileSignInPolicy, requestSignInMode, SIGN_IN_POLICY_CHANGED_EXTERNALLY, SIGN_IN_POLICY_WRITE_UNVERIFIED } from "../../src/lib/microsoftMailProvisioning/signInPolicy.ts"
import type { MicrosoftMailProvisioningRun } from "../../src/lib/microsoftMailProvisioning/workflow.ts"

const t0 = new Date("2026-11-13T10:00:00.000Z")
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000)

function tenant(initial: boolean, options: { visibleAfterWrites?: number } = {}) {
  const state = { enabled: initial, writes: [] as boolean[], pending: null as boolean | null, reads: 0 }
  return {
    state,
    ports: {
      readSecurityDefaultsEnabled: async () => {
        state.reads++
        if (state.pending !== null && state.writes.length >= (options.visibleAfterWrites ?? 1)) { state.enabled = state.pending; state.pending = null }
        return state.enabled
      },
      setSecurityDefaultsEnabled: async (enabled: boolean) => { state.writes.push(enabled); state.pending = enabled },
    },
  }
}

describe("password-only sign-in policy", () => {
  it("switches security defaults off on first observation and records it", async () => {
    const world = tenant(true)
    const result = await reconcileSignInPolicy(readSignInPolicy(null, t0.toISOString()), world.ports, later(1))
    assert.deepEqual(world.state.writes, [false])
    assert.equal(result.changed, true)
    assert.equal(result.policy.securityDefaults, "off")
    assert.equal(result.policy.issueCode, null)
  })

  it("does not write when the tenant already matches", async () => {
    const world = tenant(false)
    const result = await reconcileSignInPolicy(readSignInPolicy(null, t0.toISOString()), world.ports, later(1))
    assert.deepEqual(world.state.writes, [])
    assert.equal(result.policy.securityDefaults, "off")
  })

  it("reports, and never reverts, a change made outside Siteinabox", async () => {
    const world = tenant(true)
    const first = await reconcileSignInPolicy(readSignInPolicy(null, t0.toISOString()), world.ports, later(1))
    world.state.enabled = true // Microsoft or an administrator re-enabled it
    const second = await reconcileSignInPolicy(first.policy, world.ports, later(10))
    assert.deepEqual(world.state.writes, [false])
    assert.equal(second.policy.issueCode, SIGN_IN_POLICY_CHANGED_EXTERNALLY)
    assert.equal(second.policy.securityDefaults, "on")
    // Staying in that state keeps reporting without writing.
    const third = await reconcileSignInPolicy(second.policy, world.ports, later(20))
    assert.deepEqual(world.state.writes, [false])
    assert.equal(third.policy.issueCode, SIGN_IN_POLICY_CHANGED_EXTERNALLY)
    // An explicit operator re-apply authorizes exactly one new write.
    const reapplied = await reconcileSignInPolicy(requestSignInMode(third.policy, "password_only", "operator", later(20)), world.ports, later(21))
    assert.deepEqual(world.state.writes, [false, false])
    assert.equal(reapplied.policy.issueCode, null)
  })

  it("lets the customer turn two-step sign-in on (and off again) for the whole tenant", async () => {
    const world = tenant(true)
    const off = await reconcileSignInPolicy(readSignInPolicy(null, t0.toISOString()), world.ports, later(1))
    // Requested within the same millisecond as the last observation still authorizes the change.
    const requested = requestSignInMode(off.policy, "two_step", "customer", later(1))
    assert.ok(Date.parse(requested.desiredAt) > Date.parse(off.policy.observedAt!))
    const on = await reconcileSignInPolicy(requested, world.ports, later(2))
    assert.deepEqual(world.state.writes, [false, true])
    assert.equal(on.policy.securityDefaults, "on")
    assert.equal(on.policy.desiredBy, "customer")
    const backOff = await reconcileSignInPolicy(requestSignInMode(on.policy, "password_only", "customer", later(3)), world.ports, later(4))
    assert.deepEqual(world.state.writes, [false, true, false])
    assert.equal(backOff.policy.securityDefaults, "off")
  })

  it("keeps an unconfirmed write authorized so the next pass retries instead of reporting an outside change", async () => {
    const world = tenant(true, { visibleAfterWrites: 2 })
    const first = await reconcileSignInPolicy(readSignInPolicy(null, t0.toISOString()), world.ports, later(1))
    assert.equal(first.policy.issueCode, SIGN_IN_POLICY_WRITE_UNVERIFIED)
    assert.equal(first.policy.observedAt, null)
    const second = await reconcileSignInPolicy(first.policy, world.ports, later(5))
    assert.deepEqual(world.state.writes, [false, false])
    assert.equal(second.policy.issueCode, null)
    assert.equal(second.policy.securityDefaults, "off")
  })

  it("reads malformed stored values as the password-only default", () => {
    const policy = readSignInPolicy({ desired: "everything", desiredBy: "attacker", securityDefaults: "maybe", issueCode: "<script>" }, t0.toISOString())
    assert.deepEqual(policy, { version: 1, desired: "password_only", desiredBy: "siteinabox", desiredAt: t0.toISOString(), securityDefaults: "unknown", observedAt: null, issueCode: null })
  })
})

describe("Security Administrator delegation", () => {
  it("is required for mail authority but not for selecting the provider's bootstrap relationship", () => {
    assert.ok(requiredMailRoleIds.includes(mailGdapRoleIds.securityAdministrator))
    const withoutSecurity = [mailGdapRoleIds.userAdministrator, mailGdapRoleIds.licenseAdministrator, mailGdapRoleIds.privilegedRoleAdministrator]
    assert.ok(selectMailGdapRoles(withoutSecurity), "existing provider delegation is still selectable for bootstrap")
    const full = selectMailGdapRoles(requiredMailRoleIds)
    assert.ok(full?.roleDefinitionIds.includes(mailGdapRoleIds.securityAdministrator), "a granted Security Administrator role is assigned to the partner group")
  })
})

const customerTenant = "33333333-3333-3333-3333-333333333333"
const cloudAppAdmin = "158c047a-c907-4556-b7ef-446551a6b5f7"
const jwt = (scp: string) => `h.${Buffer.from(JSON.stringify({ scp })).toString("base64url")}.s`
const v2 = "Directory.Read.All Organization.Read.All Domain.ReadWrite.All User.ReadWrite.All LicenseAssignment.ReadWrite.All"
const signIn = "Policy.Read.All Policy.ReadWrite.SecurityDefaults"
const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test", MICROSOFT_PARTNER_TENANT_ID: "00000000-0000-0000-0000-000000000001", MICROSOFT_PARTNER_APP_CLIENT_ID: "partner-app-id",
  MICROSOFT_PARTNER_APP_CLIENT_SECRET: "secret", MICROSOFT_PARTNER_APP_REDIRECT_URI: "https://admin.siteinabox.nl/operations/microsoft-mail/consent/callback",
  MICROSOFT_GDAP_ROLE_DEFINITION_IDS: requiredMailRoleIds.join(","), MICROSOFT_PARTNER_SECURITY_GROUP_ID: "22222222-2222-2222-2222-222222222222",
  MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"), PAX8_CLIENT_ID: "p", PAX8_CLIENT_SECRET: "p", CLOUDFLARE_API_TOKEN: "c", CLOUDFLARE_ACCOUNT_ID: "c",
  EXCHANGE_WORKER_URL: "https://exchange-worker.internal/jobs", EXCHANGE_WORKER_SHARED_SECRET: "x".repeat(40), SITE_URL: "https://admin.siteinabox.nl",
}
const request = {
  tenantId: 7, domain: "tap2case.nl", tenantPrefix: "tap2case", product: "m365-business-basic-eea-no-teams" as const, commitment: "annual" as const, billing: "annual" as const,
  customer: { companyName: "Tap2case B.V.", website: "https://tap2case.nl", phone: "+31201234567", address: { street: "Dam 1", city: "Amsterdam", postalCode: "1000 AA", country: "NL" },
    registrationNumber: "", primaryContact: { firstName: "A", lastName: "B", email: "ops@example.org", phone: "+31201234567" } },
  mailboxUsers: [{ localPart: "info", displayName: "Info", userPrincipalName: "info@tap2case.nl", setupEmail: "owner.setup@example.org" }],
  quantity: 1, retainInfoForward: false, infoForwardTo: null, infoAliasTarget: null,
}

function world(options: { roles?: string[]; rejectExtendedGraph?: boolean; policyStatus?: number } = {}) {
  const calls: Array<{ method: string; url: URL; body: unknown }> = []
  const state = { scopes: v2, tokenScopes: v2, graphGranted: true, exchangeGranted: true, securityDefaults: true, saved: [] as unknown[] }
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? "GET"
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null
    calls.push({ method, url, body })
    if (url.pathname.endsWith("/servicePrincipals")) return Response.json({ value: [{ id: "client-sp", appId: "partner-app-id" }, { id: "graph-sp", appId: "00000003-0000-0000-c000-000000000000" }, { id: "exo-sp", appId: "00000002-0000-0ff1-ce00-000000000000" }] })
    if (url.pathname.endsWith("/oauth2PermissionGrants")) return Response.json({ value: [
      ...(state.graphGranted ? [{ clientId: "client-sp", resourceId: "graph-sp", consentType: "AllPrincipals", scope: state.scopes }] : []),
      ...(state.exchangeGranted ? [{ clientId: "client-sp", resourceId: "exo-sp", consentType: "AllPrincipals", scope: "Exchange.Manage" }] : []) ] })
    if (url.pathname.endsWith("/policies/identitySecurityDefaultsEnforcementPolicy")) {
      if (options.policyStatus) return Response.json({ error: { code: "Authorization_RequestDenied" } }, { status: options.policyStatus })
      if (method === "PATCH") { state.securityDefaults = (body as { isEnabled: boolean }).isEnabled; return new Response(null, { status: 204 }) }
      return Response.json({ isEnabled: state.securityDefaults })
    }
    if (url.hostname === "api.partnercenter.microsoft.com" && method === "DELETE") { state.graphGranted = false; state.exchangeGranted = false; return new Response(null, { status: 204 }) }
    if (url.hostname === "api.partnercenter.microsoft.com" && method === "POST") {
      const grant = (body as { applicationGrants: Array<{ enterpriseApplicationId: string; scope: string }> }).applicationGrants[0]!
      if (options.rejectExtendedGraph && grant.scope.includes("Policy.ReadWrite.SecurityDefaults")) return Response.json({ code: "Forbidden" }, { status: 403 })
      if (grant.enterpriseApplicationId.startsWith("00000003")) { state.graphGranted = true; state.scopes = grant.scope.split(", ").join(" ") }
      else state.exchangeGranted = true
      return Response.json({}, { status: 201 })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }) as typeof fetch
  const payload = {
    find: async () => ({ docs: [{ id: 5, createdAt: "2026-11-01T00:00:00.000Z", signInPolicy: state.saved.at(-1) ?? null }] }),
    update: async ({ data }: { data: { signInPolicy: unknown } }) => { state.saved.push(data.signInPolicy); return {} },
  } as unknown as Payload
  const ports = createMicrosoftMailLivePorts({ payload, env, fetchImpl, tokenProvider: async ({ resource }) => {
    if (!state.graphGranted && resource === "graph") throw new MicrosoftTokenRequestError(400, "customer_consent_required")
    return resource === "graph" ? jwt(state.tokenScopes) : "token" }, partnerUserPrincipalName: "agent@partner.test" })
  const run = (data: Record<string, unknown> = {}): MicrosoftMailProvisioningRun => ({ id: 9, idempotencyKey: "k", mode: "live", tenantId: 7, domain: "tap2case.nl", tenantPrefix: "tap2case",
    request, state: "consent_pending", currentStep: "sign_in_policy", completedSteps: [], actionUrl: null, issueCode: null, createdAt: "", updatedAt: "",
    data: { customerTenantId: customerTenant, mailAuthority: { grantedRoles: options.roles ?? [...requiredMailRoleIds] }, ...data } })
  return { calls, state, ports, run }
}

describe("sign_in_policy provisioning step", () => {
  it("upgrades the grant through intent-journaled DELETE/POST checkpoints, then switches security defaults off", async () => {
    const w = world()
    let data: Record<string, unknown> = {}
    const step = async () => {
      const outcome = await w.ports.sign_in_policy({ run: w.run(data), request })
      if (outcome.kind === "waiting") data = { ...data, ...(outcome.data ?? {}) }
      return outcome
    }
    const writes = () => w.calls.filter(call => call.method !== "GET").map(call => call.url.hostname === "graph.microsoft.com" ? `${call.method}:policy` : `${call.method}:${call.method === "POST" ? JSON.stringify(call.body).includes("00000003") ? "graph" : "exchange" : "consent"}`)
    let outcome = await step()
    assert.equal(outcome.kind === "waiting" && outcome.code, "SIGN_IN_GRANT_UPGRADING")
    assert.deepEqual(writes(), [], "the intent is persisted before the DELETE is sent")
    await step()
    assert.deepEqual(writes(), ["DELETE:consent"])
    // A crash after the DELETE but before its checkpoint repeats the same idempotent call.
    const replay = await w.ports.sign_in_policy({ run: w.run({ signInGrantUpgrade: { version: "microsoft-mail-sign-in-grants-v1", next: "revoke", startedAt: (data.signInGrantUpgrade as Record<string, string>).startedAt } }), request })
    assert.equal(replay.kind, "waiting")
    await step()
    const graphPost = w.calls.find(call => call.method === "POST" && call.url.hostname === "api.partnercenter.microsoft.com")!
    assert.match(JSON.stringify(graphPost.body), /Policy\.ReadWrite\.SecurityDefaults/)
    assert.match(JSON.stringify(graphPost.body), /User\.ReadWrite\.All/, "the v2 scopes are preserved")
    assert.doesNotMatch(JSON.stringify(graphPost.body), /PasswordProfile/, "no unused privilege is requested")
    await step()
    assert.deepEqual(writes(), ["DELETE:consent", "DELETE:consent", "POST:graph", "POST:exchange"])
    outcome = await step()
    assert.equal(outcome.kind === "waiting" && outcome.code, "SIGN_IN_GRANT_PROPAGATING", "grant visible but token not yet refreshed")
    assert.equal(w.state.securityDefaults, true, "nothing changes before the scope is in a fresh token")
    w.state.tokenScopes = `${v2} ${signIn}`
    outcome = await step()
    assert.equal(outcome.kind, "complete")
    assert.equal(w.state.securityDefaults, false)
    assert.deepEqual(writes(), ["DELETE:consent", "DELETE:consent", "POST:graph", "POST:exchange", "PATCH:policy"])
    assert.equal((w.state.saved.at(-1) as { securityDefaults: string }).securityDefaults, "off")
  })

  it("restores the v2 grants when Microsoft rejects the extended consent", async () => {
    const w = world({ rejectExtendedGraph: true })
    let data: Record<string, unknown> = {}
    let outcome
    for (let i = 0; i < 4; i++) {
      outcome = await w.ports.sign_in_policy({ run: w.run(data), request })
      if (outcome.kind !== "waiting") break
      data = { ...data, ...(outcome.data ?? {}) }
    }
    assert.equal(outcome?.kind === "manual_review" && outcome.code, "SIGN_IN_GRANT_UPGRADE_REJECTED_V2_RESTORED")
    assert.equal(w.state.graphGranted && w.state.exchangeGranted, true, "the tenant is never left without the reviewed grants")
    assert.equal(w.state.securityDefaults, true)
  })

  it("never removes an existing consent when the delegated consent role is not proven", async () => {
    const w = world({ roles: requiredMailRoleIds.filter(role => role !== cloudAppAdmin) })
    const outcome = await w.ports.sign_in_policy({ run: w.run(), request })
    assert.deepEqual(outcome, { kind: "manual_review", code: "SIGN_IN_CONSENT_ROLE_MISSING" })
    assert.equal(w.calls.some(call => call.method !== "GET"), false)
  })

  it("waits for a new security role to apply, then stops for review if access stays denied", async () => {
    const w = world({ policyStatus: 403 })
    w.state.scopes = `${v2} ${signIn}`
    w.state.tokenScopes = `${v2} ${signIn}`
    const first = await w.ports.sign_in_policy({ run: w.run(), request })
    assert.equal(first.kind === "waiting" && first.code, "SIGN_IN_POLICY_ACCESS_PROPAGATING")
    const since = first.kind === "waiting" ? first.data?.signInPolicyDeniedSince : null
    assert.equal(typeof since, "string")
    const stillWaiting = await w.ports.sign_in_policy({ run: w.run({ signInPolicyDeniedSince: since }), request })
    assert.equal(stillWaiting.kind, "waiting", "the first denial time is kept, not reset")
    const expired = await w.ports.sign_in_policy({ run: w.run({ signInPolicyDeniedSince: new Date(Date.now() - 31 * 60_000).toISOString() }), request })
    assert.deepEqual(expired, { kind: "manual_review", code: "SIGN_IN_POLICY_ACCESS_DENIED" })
    assert.equal(w.calls.some(call => call.method === "PATCH"), false)
  })

  it("never overwrites a customer request recorded while Microsoft was being called", async () => {
    const w = world()
    w.state.scopes = `${v2} ${signIn}`
    w.state.tokenScopes = `${v2} ${signIn}`
    const customerRequest = { version: 1, desired: "two_step", desiredBy: "customer", desiredAt: "2026-11-13T12:00:00.000Z", securityDefaults: "unknown", observedAt: null, issueCode: null }
    // The first find returns no stored policy; the re-read sees the customer's new request.
    let finds = 0
    const payload = {
      find: async () => ({ docs: [{ id: 5, createdAt: "2026-11-01T00:00:00.000Z", signInPolicy: finds++ === 0 ? null : customerRequest }] }),
      update: async ({ data }: { data: { signInPolicy: unknown } }) => { w.state.saved.push(data.signInPolicy); return {} },
    } as unknown as Payload
    const racing = createMicrosoftMailLivePorts({ payload, env, fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("/servicePrincipals")) return Response.json({ value: [{ id: "client-sp", appId: "partner-app-id" }, { id: "graph-sp", appId: "00000003-0000-0000-c000-000000000000" }, { id: "exo-sp", appId: "00000002-0000-0ff1-ce00-000000000000" }] })
      if (url.pathname.endsWith("/oauth2PermissionGrants")) return Response.json({ value: [{ clientId: "client-sp", resourceId: "graph-sp", consentType: "AllPrincipals", scope: `${v2} ${signIn}` }, { clientId: "client-sp", resourceId: "exo-sp", consentType: "AllPrincipals", scope: "Exchange.Manage" }] })
      if (url.pathname.endsWith("/identitySecurityDefaultsEnforcementPolicy")) return init?.method === "PATCH" ? new Response(null, { status: 204 }) : Response.json({ isEnabled: false })
      throw new Error(`unexpected ${url}`)
    }) as typeof fetch, tokenProvider: async () => jwt(`${v2} ${signIn}`), partnerUserPrincipalName: "agent@partner.test" })
    const outcome = await racing.sign_in_policy({ run: w.run(), request })
    assert.equal(outcome.kind, "complete")
    assert.deepEqual(w.state.saved, [], "the newer customer request is left for the service-locked reconciliation")
  })

  it("honours a customer's two-step choice on later provisioning runs", async () => {
    const w = world()
    w.state.scopes = `${v2} ${signIn}`
    w.state.tokenScopes = `${v2} ${signIn}`
    w.state.securityDefaults = true
    w.state.saved.push({ version: 1, desired: "two_step", desiredBy: "customer", desiredAt: "2026-11-02T00:00:00.000Z", securityDefaults: "on", observedAt: "2026-11-03T00:00:00.000Z", issueCode: null })
    const outcome = await w.ports.sign_in_policy({ run: w.run(), request })
    assert.equal(outcome.kind, "complete")
    assert.equal(w.state.securityDefaults, true)
    assert.equal(w.calls.some(call => call.method === "PATCH"), false)
  })
})
