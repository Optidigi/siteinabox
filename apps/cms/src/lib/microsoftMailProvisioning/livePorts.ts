import "server-only"
import { createHash, randomBytes } from "node:crypto"
import type { Payload } from "payload"
import type { SendEmailOptions } from "../email/sendEmail.ts"
import { MicrosoftMailClient, MicrosoftApiError, MICROSOFT_MAIL_APPLICATION_GRANT_VERSION, type MicrosoftTokenProvider } from "./microsoft.ts"
import { MicrosoftTokenRequestError } from "./microsoftAuth.ts"
import { createPartnerTokenProvider } from "./partnerConnection.ts"
import { CloudflareMailDnsClient } from "./cloudflare.ts"
import { ExchangeWorkerClient } from "./exchangeWorker.ts"
import { planMicrosoftMailDns, type MailDnsRecord } from "./dns.ts"
import { inspectExistingMailRouting } from "./infoRouting.ts"
import { Pax8Client } from "./pax8.ts"
import { discoverMicrosoftTenant } from "./tenantDiscovery.ts"
import { encryptMicrosoftMailSetupCredential } from "./setupCredentialCrypto.ts"
import { createMicrosoftMailSetupToken } from "./setupTokenStore.ts"
import type { MicrosoftMailProvisioningPorts, MicrosoftMailProvisioningRun } from "./workflow.ts"

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const isGuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value)
const stateData = (run: MicrosoftMailProvisioningRun) => run.data

const pause = (input: { code: string; state: MicrosoftMailProvisioningRun["state"]; actionUrl?: string; message: string; data?: Record<string, unknown> }) => ({
  kind: "waiting" as const,
  ...input,
})

const complete = (data?: Record<string, unknown>) => ({ kind: "complete" as const, ...(data ? { data } : {}) })

const normalizeRecordName = (label: string | undefined, domain: string) => {
  const value = (label ?? "@").trim().toLowerCase().replace(/\.$/, "")
  if (!value || value === "@") return domain
  return value === domain || value.endsWith(`.${domain}`) ? value : `${value}.${domain}`
}

const stableJson = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

const planHash = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex")

const previewDnsChanges = (changes: ReturnType<typeof planMicrosoftMailDns>["prepare"], existing: MailDnsRecord[]) =>
  changes.map((change) => {
    if (change.action === "create" || change.action === "update") {
      return { action: change.action, type: change.record.type, name: change.record.name, content: change.record.content, priority: change.record.priority ?? null }
    }
    const record = existing.find((item) => item.id === change.id)
    return record
      ? { action: change.action, type: record.type, name: record.name, content: record.content, priority: record.priority ?? null }
      : { action: change.action, type: "unknown", name: "unknown", content: "unknown", priority: null }
  })

const setupBaseUrl = (env: NodeJS.ProcessEnv) => {
  const raw = env.SITE_URL?.trim() || env.NEXT_PUBLIC_SIAB_SITE_URL?.trim() || ""
  if (!raw) throw new Error("SITE_URL or NEXT_PUBLIC_SIAB_SITE_URL is required for mailbox setup links.")
  const url = new URL(raw)
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Mailbox setup links require an HTTPS site URL.")
  return url.origin
}

export function createMicrosoftMailLiveClients(input: { payload?: Payload; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; tokenProvider?: MicrosoftTokenProvider; partnerUserPrincipalName?: string } = {}) {
  const env = input.env ?? process.env
  const fetchImpl = input.fetchImpl ?? fetch
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`${name}_NOT_CONFIGURED`)
    return value
  }
  const partnerTenantId = required("MICROSOFT_PARTNER_TENANT_ID")
  const microsoftClientId = required("MICROSOFT_PARTNER_APP_CLIENT_ID")
  const microsoftClientSecret = required("MICROSOFT_PARTNER_APP_CLIENT_SECRET")
  const roleIds = required("MICROSOFT_GDAP_ROLE_DEFINITION_IDS").split(",").map((role) => role.trim()).filter(Boolean)
  const securityGroupId = required("MICROSOFT_PARTNER_SECURITY_GROUP_ID")
  if (!input.payload && !input.tokenProvider) throw new Error("Microsoft partner connection requires the application database.")
  const tokenProvider = input.tokenProvider ?? createPartnerTokenProvider(input.payload!, env, fetchImpl)
  const partnerUpn = async () => {
    if (input.partnerUserPrincipalName) return input.partnerUserPrincipalName
    const found = await input.payload!.find({ collection: "microsoft-partner-connections", where: { and: [
      { partnerTenantId: { equals: partnerTenantId } }, { clientId: { equals: microsoftClientId } }, { status: { equals: "connected" } },
    ] }, limit: 1, overrideAccess: true })
    if (!found.docs[0]) throw new Error("MICROSOFT_PARTNER_RECONNECT_REQUIRED")
    return found.docs[0].userPrincipalName
  }
  const microsoft = new MicrosoftMailClient({
    partnerTenantId,
    clientId: microsoftClientId,
    accessToken: tokenProvider,
    appConsentRedirectUri: required("MICROSOFT_PARTNER_APP_REDIRECT_URI"),
    fetchImpl,
  })
  const cloudflare = new CloudflareMailDnsClient({ token: required("CLOUDFLARE_API_TOKEN"), accountId: required("CLOUDFLARE_ACCOUNT_ID"), fetchImpl })
  const exchange = new ExchangeWorkerClient({ endpoint: required("EXCHANGE_WORKER_URL"), sharedSecret: required("EXCHANGE_WORKER_SHARED_SECRET"), fetchImpl })
  const pax8 = new Pax8Client({ clientId: required("PAX8_CLIENT_ID"), clientSecret: required("PAX8_CLIENT_SECRET"), audience: "https://api.pax8.com", fetchImpl })
  return { env, required, partnerTenantId, roleIds, securityGroupId, tokenProvider, partnerUpn, microsoft, cloudflare, exchange, pax8 }
}

export function createMicrosoftMailLivePorts(input: {
  payload: Payload
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  tokenProvider?: MicrosoftTokenProvider
  partnerUserPrincipalName?: string
  sendEmailImpl?: (options: SendEmailOptions) => Promise<unknown>
  createSetupTokenImpl?: typeof createMicrosoftMailSetupToken
  buildSetupEmailMessage?: (input: { displayName: string; userPrincipalName: string; setupUrl: string; locale?: "nl" | "en" }) => Pick<SendEmailOptions, "subject" | "html" | "text">
  buildSetupBatchEmailMessage?: (input: { mailboxes: Array<{ displayName: string; userPrincipalName: string; setupUrl: string }>; locale: "nl" | "en" }) => Pick<SendEmailOptions, "subject" | "html" | "text">
  mailPayload?: SendEmailOptions["payload"]
}): MicrosoftMailProvisioningPorts {
  const { env, required, tokenProvider, partnerUpn, microsoft, cloudflare, exchange, pax8, roleIds, securityGroupId } = createMicrosoftMailLiveClients(input)
  const createSetupTokenImpl = input.createSetupTokenImpl ?? createMicrosoftMailSetupToken

  const customerTenantId = (run: MicrosoftMailProvisioningRun) => {
    const value = stateData(run).customerTenantId
    return isGuid(value) ? value : null
  }

  return {
    tenant_bootstrap: async ({ run }) => {
      return typeof stateData(run).pax8CompanyId === "string"
        ? complete()
        : { kind: "manual_review", code: "PAX8_COMPANY_SETUP_REQUIRED" }
    },
    subscription: async ({ run }) => {
      return typeof stateData(run).pax8OrderId === "string" || stateData(run).pax8QuantityUpdateConfirmed === true
        ? complete({ pax8OrderId: stateData(run).pax8OrderId })
        : { kind: "manual_review", code: "PAX8_ORDER_ACTION_REQUIRED" }
    },
    mca_acceptance: async ({ run }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) {
        const initialDomain = `${run.request.tenantPrefix}.onmicrosoft.com`
        if (!run.data.pax8CompanyId || !run.data.pax8OrderId || !run.data.bootstrapInitialDomainAbsentAt || run.data.bootstrapInitialDomain !== initialDomain) return { kind: "manual_review", code: "MICROSOFT_TENANT_BOOTSTRAP_EVIDENCE_REQUIRED" }
        const discovered = await discoverMicrosoftTenant(initialDomain, input.fetchImpl)
        if (!discovered) return pause({ code: "MICROSOFT_TENANT_PROVISIONING", state: "consent_pending", message: "Waiting for Microsoft to publish the new tenant identity." })
        const relationships = await microsoft.listCustomerGdapRelationships(discovered.tenantId)
        const matching = relationships.filter(relationship => ["active", "approvalPending"].includes(relationship.status))
        if (!matching.length) return pause({ code: "MICROSOFT_RESELLER_ASSOCIATION_PENDING", state: "consent_pending", message: "Waiting for the provider-created customer delegation." })
        return pause({ code: "MICROSOFT_TENANT_DISCOVERED", state: "consent_pending", message: "The new Microsoft tenant and partner delegation were identified.", data: {
          customerTenantId: discovered.tenantId, bootstrapInitialDomain: discovered.initialDomain,
          tenantDiscoveryVerifiedAt: new Date().toISOString(), discoveredGdapRelationshipIds: matching.map(relationship => relationship.id),
        } })
      }
      if (stateData(run).mcaAccepted !== true) {
        return pause({
          code: "MCA_ACCEPTANCE_REQUIRED",
          state: "consent_pending",
          actionUrl: microsoft.directMcaAcceptanceUrl(),
          message: "A Global Administrator must accept Microsoft's Customer Agreement in Microsoft 365 Admin Center. Confirm it here afterward.",
          data: { customerTenantId: tenantId },
        })
      }
      return complete({ mcaAccepted: true })
    },
    gdap: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return pause({ code: "MICROSOFT_TENANT_ID_REQUIRED", state: "consent_pending", message: "Record the verified customer Microsoft tenant ID internally before requesting access." })
      const data = stateData(run)
      const requestAccess = async () => {
        const created = await microsoft.createGdapApprovalRequest({ customerTenantId: tenantId, displayName: `Siteinabox ${request.domain}`.slice(0,50), durationDays: 730, roleDefinitionIds: roleIds })
        return pause({ code: "GDAP_APPROVAL_REQUIRED", state: "consent_pending", actionUrl: created.approvalUrl,
          message: "Optidigi must approve this request internally using the authorized customer Global Administrator account.",
          data: { gdapRelationshipId: created.relationshipId, gdapRequestId: created.requestId, gdapApprovalUrl: created.approvalUrl, gdapAccessAssignmentId: null } })
      }
      const relationshipId = typeof data.gdapRelationshipId === "string" ? data.gdapRelationshipId : ""
      if (!relationshipId) return requestAccess()
      const relationship = await microsoft.getGdapRelationship(relationshipId)
      if (relationship.customer?.tenantId?.toLowerCase() !== tenantId.toLowerCase()) return { kind: "manual_review", code: "GDAP_CUSTOMER_MISMATCH" }
      if (["expired", "terminated"].includes(relationship.status.toLowerCase())) return requestAccess()
      if (relationship.status.toLowerCase() !== "active") return pause({ code: "GDAP_APPROVAL_PENDING", state: "consent_pending", actionUrl: typeof data.gdapApprovalUrl === "string" ? data.gdapApprovalUrl : undefined, message: "Waiting for Microsoft to activate the approved admin relationship." })
      const approved = relationship.accessDetails?.unifiedRoles?.map(role => role.roleDefinitionId.toLowerCase()) ?? []
      if (!roleIds.every(role => approved.includes(role.toLowerCase()))) return requestAccess()
      if (typeof data.gdapAccessAssignmentId !== "string") {
        const assignment = await microsoft.createGdapAccessAssignment({ relationshipId, partnerSecurityGroupId: securityGroupId, roleDefinitionIds: roleIds })
        return pause({ code: "GDAP_ACCESS_ASSIGNMENT_PENDING", state: "consent_pending", message: "Waiting for Microsoft to activate the partner group assignment.", data: { gdapAccessAssignmentId: assignment.id } })
      }
      const assignment = await microsoft.getGdapAccessAssignment(relationshipId,data.gdapAccessAssignmentId)
      if (assignment.status.toLowerCase() === "error") return { kind: "manual_review", code: "GDAP_ASSIGNMENT_REQUIRES_REVIEW" }
      if (assignment.status.toLowerCase() !== "active") return pause({ code: "GDAP_ACCESS_ASSIGNMENT_PENDING", state: "consent_pending", message: "Waiting for Microsoft to activate the partner group assignment." })
      if (assignment.accessContainer?.accessContainerId?.toLowerCase() !== securityGroupId.toLowerCase() || assignment.accessContainer.accessContainerType !== "securityGroup") return { kind: "manual_review", code: "GDAP_ASSIGNMENT_BINDING_MISMATCH" }
      const assigned = assignment.accessDetails?.unifiedRoles?.map(role => role.roleDefinitionId.toLowerCase()) ?? []
      if (assigned.length !== roleIds.length || !roleIds.every(role => assigned.includes(role.toLowerCase()))) {
        await microsoft.updateGdapAccessAssignment(relationshipId,assignment.id,roleIds)
        return pause({ code: "GDAP_ACCESS_ASSIGNMENT_PENDING", state: "consent_pending", message: "The configured group roles were updated; waiting for activation." })
      }
      return complete({ gdapStatus: relationship.status })
    },
    application_consent: async ({ run }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return pause({ code: "MICROSOFT_TENANT_ID_REQUIRED", state: "consent_pending", message: "Record the verified customer tenant ID internally." })
      const data = stateData(run)
      const submitted = data.appConsentSubmittedVersion === MICROSOFT_MAIL_APPLICATION_GRANT_VERSION && typeof data.appConsentSubmittedAt === "string"
      if (data.appConsentVersion !== MICROSOFT_MAIL_APPLICATION_GRANT_VERSION && !submitted) {
        const hash = createHash("sha256").update(`customer-consent:${run.id}:${MICROSOFT_MAIL_APPLICATION_GRANT_VERSION}`).digest("hex")
        const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`
        try { await microsoft.consentCustomerApplication(tenantId,id) }
        catch (error) {
          if (error instanceof MicrosoftApiError && [400,403,409].includes(error.status)) return { kind: "manual_review", code: "CUSTOMER_RECONSENT_REQUIRED" }
          throw error
        }
        return pause({ code: "PARTNER_APP_CONSENT_PROPAGATING", state: "consent_pending", message: "The required application grants were submitted. Waiting for Microsoft propagation.",
          data: { appConsentSubmittedAt: new Date().toISOString(), appConsentSubmittedVersion: MICROSOFT_MAIL_APPLICATION_GRANT_VERSION } })
      }
      try {
        const organization = await microsoft.getOrganization(tenantId)
        const expected = String(data.bootstrapInitialDomain ?? data.customerOrganizationDomain ?? "").toLowerCase()
        if (!organization.initialDomain || organization.id.toLowerCase() !== tenantId.toLowerCase() || !expected || organization.initialDomain.toLowerCase() !== expected) return { kind: "manual_review", code: "MICROSOFT_ORGANIZATION_BINDING_MISMATCH" }
        const token = await tokenProvider({ tenantId, resource: "exchange" })
        try { await exchange.execute({ operation: "verify_access", customerTenantId: tenantId, customerOrganizationDomain: organization.initialDomain, domain: run.domain, accessToken: token, partnerUserPrincipalName: await partnerUpn() }) }
        catch { return { kind: "manual_review", code: "EXCHANGE_ACCESS_REQUIRES_REVIEW" } }
        return complete({ customerOrganizationId: organization.id, customerOrganizationName: organization.displayName ?? null, customerOrganizationDomain: organization.initialDomain,
          appConsentVersion: MICROSOFT_MAIL_APPLICATION_GRANT_VERSION, appConsentVerified: true, appConsentConfirmedAt: new Date().toISOString() })
      } catch (error) {
        if (error instanceof MicrosoftApiError && [401,403].includes(error.status) || error instanceof MicrosoftTokenRequestError && error.code === "customer_consent_required") {
          if (submitted && Date.now() - Date.parse(String(data.appConsentSubmittedAt)) < 900_000) return pause({ code: "PARTNER_APP_CONSENT_PROPAGATING", state: "consent_pending", message: "Waiting for the submitted customer application grants." })
          return { kind: "manual_review", code: "CUSTOMER_RECONSENT_REQUIRED" }
        }
        throw error
      }
    },
    domain_verification: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return pause({ code: "MICROSOFT_TENANT_ID_REQUIRED", state: "domain_pending", message: "Enter the customer Microsoft tenant ID before domain verification." })
      const zone = await cloudflare.findZone(request.domain)
      if (!zone || zone.status !== "active") return { kind: "manual_review", code: "CLOUDFLARE_ZONE_NOT_ACTIVE" }
      const domain = await microsoft.ensureDomain(tenantId, request.domain)
      if (domain.isVerified) return complete({ microsoftDomainId: domain.id, cloudflareZoneId: zone.id, customerTenantId: tenantId })
      const verificationRecords = await microsoft.getDomainVerificationRecords(tenantId, request.domain)
      const existing = await cloudflare.listDnsRecords(zone.id)
      const changes = verificationRecords.flatMap((record) => {
        if (record.recordType?.toLowerCase() !== "txt" || !record.text) return []
        const name = normalizeRecordName(record.label, request.domain)
        const exact = existing.some((candidate) => candidate.type === "TXT" && candidate.name === name && candidate.content === record.text)
        return exact ? [] : [{ action: "create" as const, record: { type: "TXT" as const, name, content: record.text, proxied: false } }]
      })
      const currentPlanHash = planHash(changes)
      const verifiedPlanHash = stateData(run).dnsVerificationPlanHash
      if (changes.length && stateData(run).autoProvisionAuthorized !== true && (stateData(run).dnsVerificationConfirmed !== true || verifiedPlanHash !== currentPlanHash)) {
        return pause({
          code: "DNS_VERIFICATION_RECORD_CONFIRMATION_REQUIRED",
          state: "domain_pending",
          message: "Review and confirm the Microsoft domain-verification TXT record before Siteinabox writes it to Cloudflare.",
          data: {
            cloudflareZoneId: zone.id,
            microsoftVerificationRecords: verificationRecords,
            dnsVerificationPlanHash: currentPlanHash,
            dnsVerificationChanges: previewDnsChanges(changes, existing),
            ...(verifiedPlanHash && verifiedPlanHash !== currentPlanHash ? { dnsVerificationConfirmed: false } : {}),
          },
        })
      }
      if (changes.length) await cloudflare.applyChanges(zone.id, changes)
      try {
        const verified = await microsoft.verifyDomain(tenantId, request.domain)
        if (verified.isVerified) return complete({ microsoftDomainId: verified.id, cloudflareZoneId: zone.id, customerTenantId: tenantId })
      } catch (error) {
        if (!(error instanceof MicrosoftApiError && (error.status === 400 || error.status === 404))) throw error
      }
      return pause({ code: "MICROSOFT_DOMAIN_VERIFICATION_PENDING", state: "domain_pending", message: "The Microsoft TXT record is present. Wait for DNS propagation and retry domain verification." })
    },
    info_forward: async ({ run, request }) => {
      const readinessTenant = customerTenantId(run)
      const readinessDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
      if (!readinessTenant || !readinessDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
      const readinessToken = await tokenProvider({ tenantId: readinessTenant, resource: "exchange" })
      const mailboxReadiness = await exchange.execute({ operation: "verify_mailboxes", customerTenantId: readinessTenant, customerOrganizationDomain: readinessDomain,
        accessToken: readinessToken, partnerUserPrincipalName: await partnerUpn(), domain: request.domain, mailboxAddresses: request.mailboxUsers.map(user => user.userPrincipalName) })
      if (mailboxReadiness.mailboxesReady !== true) return pause({ code: "EXCHANGE_MAILBOX_PROVISIONING", state: "mailboxes_pending", message: "Waiting for the licensed mailboxes to appear in Exchange." })
      if (request.infoSharedMailbox) {
        const result = await exchange.execute({ operation: "ensure_info_shared", customerTenantId: readinessTenant, customerOrganizationDomain: readinessDomain,
          accessToken: readinessToken, partnerUserPrincipalName: await partnerUpn(), domain: request.domain, infoAddress: `info@${request.domain}`,
          mailboxAddresses: request.mailboxUsers.map(user => user.userPrincipalName) })
        return complete({ infoSharedMailbox: result.sharedMailbox, infoSharedMailboxMembers: result.sharedMailboxMembers })
      }
      if (request.infoAliasTarget) {
        const tenantId = customerTenantId(run)
        if (!tenantId) return { kind: "manual_review", code: "MICROSOFT_TENANT_ID_REQUIRED" }
        const organizationDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
        if (!organizationDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
        const accessToken = await tokenProvider({ tenantId, resource: "exchange" })
        const result = await exchange.execute({
          operation: "ensure_info_alias",
          customerTenantId: tenantId,
          customerOrganizationDomain: organizationDomain,
          accessToken, partnerUserPrincipalName: await partnerUpn(),
          domain: request.domain,
          infoAddress: `info@${request.domain}`,
          targetAddress: request.infoAliasTarget,
        })
        return complete({ infoAlias: result.alias, infoAliasTarget: result.aliasTarget })
      }
      if (!request.retainInfoForward || !request.infoForwardTo) return complete({ infoForwardPreserved: false })
      const tenantId = customerTenantId(run)
      if (!tenantId) return { kind: "manual_review", code: "MICROSOFT_TENANT_ID_REQUIRED" }
      const zoneId = typeof run.data.cloudflareZoneId === "string" ? run.data.cloudflareZoneId : ""
      if (!zoneId) return { kind: "manual_review", code: "CLOUDFLARE_ZONE_NOT_FOUND" }
      const emailRules = await cloudflare.listEmailRoutingRules(zoneId)
      const infoAddress = `info@${request.domain}`
      const matchingRules = emailRules.filter((rule) => rule.enabled && rule.matchers.some((matcher) =>
        matcher.type === "all" || matcher.type === "literal" && matcher.value?.trim().toLowerCase() === infoAddress.toLowerCase()))
      const legacyDestinations = [...new Set(matchingRules.flatMap((rule) => rule.actions
        .filter((action) => action.type === "forward")
        .flatMap((action) => action.value ?? [])
        .map((address) => address.trim().toLowerCase())))].sort()
      if (legacyDestinations.length > 1 || legacyDestinations.length === 1 && legacyDestinations[0] !== request.infoForwardTo.toLowerCase()) {
        return { kind: "manual_review", code: "INFO_FORWARD_DESTINATION_MISMATCH" }
      }
      const organizationDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
      if (!organizationDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
      const accessToken = await tokenProvider({ tenantId, resource: "exchange" })
      const result = await exchange.execute({
        operation: "ensure_info_forward",
        customerTenantId: tenantId,
        customerOrganizationDomain: organizationDomain,
        accessToken, partnerUserPrincipalName: await partnerUpn(),
        domain: request.domain,
        infoAddress,
        forwardTo: request.infoForwardTo,
      })
      return complete({
        infoSharedMailbox: result.sharedMailbox,
        infoForwardTo: result.forwardingAddress,
        infoForwardPreserved: true,
        cloudflareLegacyInfoForwardFound: legacyDestinations.length === 1,
      })
    },
    dkim_prepare: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return { kind: "manual_review", code: "MICROSOFT_TENANT_ID_REQUIRED" }
      const organizationDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
      if (!organizationDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
      const accessToken = await tokenProvider({ tenantId, resource: "exchange" })
      const result = await exchange.execute({ operation: "get_dkim_targets", customerTenantId: tenantId, customerOrganizationDomain: organizationDomain, accessToken, partnerUserPrincipalName: await partnerUpn(), domain: request.domain })
      return complete({ microsoftDkimRecords: result.dkimRecords ?? [] })
    },
    dns_prepare: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      const zoneId = typeof run.data.cloudflareZoneId === "string" ? run.data.cloudflareZoneId : ""
      if (!tenantId || !zoneId) return { kind: "manual_review", code: "DOMAIN_SETUP_REQUIRED" }
      const [existing, verificationRecords, serviceRecords] = await Promise.all([
        cloudflare.listDnsRecords(zoneId),
        microsoft.getDomainVerificationRecords(tenantId, request.domain),
        microsoft.getDomainServiceRecords(tenantId, request.domain),
      ])
      const dkimRecords = Array.isArray(run.data.microsoftDkimRecords)
        ? run.data.microsoftDkimRecords.filter((record): record is { selector: string; target: string } => Boolean(record && typeof record === "object" && "selector" in record && typeof record.selector === "string" && "target" in record && typeof record.target === "string"))
        : []
      const plan = planMicrosoftMailDns({ domain: request.domain, existing, verificationRecords, serviceRecords, dkimRecords })
      const currentPlanHash = planHash(plan.prepare)
      const verifiedPlanHash = stateData(run).dnsPreparationPlanHash
      if (plan.prepare.length && stateData(run).autoProvisionAuthorized !== true && (stateData(run).dnsPreparationConfirmed !== true || verifiedPlanHash !== currentPlanHash)) {
        return pause({
          code: "DNS_PREPARATION_CONFIRMATION_REQUIRED",
          state: "dns_pending",
          message: "Review the Microsoft mail DNS changes and confirm the prepare stage. The existing MX stays in place during preparation.",
          data: {
            dnsPreparationPlanHash: currentPlanHash,
            dnsPreparationChanges: previewDnsChanges(plan.prepare, existing),
            ...(verifiedPlanHash && verifiedPlanHash !== currentPlanHash ? { dnsPreparationConfirmed: false } : {}),
          },
        })
      }
      await cloudflare.applyChanges(zoneId, plan.prepare)
      return complete({ dnsPrepareAppliedAt: new Date().toISOString(), dnsPrepareCount: plan.prepare.length })
    },
    mailbox_users: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return { kind: "manual_review", code: "MICROSOFT_TENANT_ID_REQUIRED" }
      if (stateData(run).autoProvisionAuthorized !== true && stateData(run).mailboxCreationConfirmed !== true) {
        return pause({ code: "MAILBOX_CREATION_CONFIRMATION_REQUIRED", state: "mailboxes_pending", message: "Review the mailbox list and confirm user creation in the customer Microsoft tenant." })
      }
      const orderLines = Array.isArray(run.data.pax8OrderLineItems) ? run.data.pax8OrderLineItems.map(object) : []
      const subscriptionId = orderLines.find((line) => typeof line.subscriptionId === "string")?.subscriptionId
      const pax8CompanyId = typeof run.data.pax8CompanyId === "string" ? run.data.pax8CompanyId : ""
      if (!pax8CompanyId) return { kind: "manual_review", code: "PAX8_COMPANY_ID_MISSING" }
      if (typeof subscriptionId !== "string") return pause({ code: "PAX8_SUBSCRIPTION_PROVISIONING", state: "mailboxes_pending", message: "Waiting for the subscription identifier on the accepted provider order." })
      const subscriptions = await pax8.listSubscriptions(pax8CompanyId)
      const candidate = subscriptions.find((subscription) => subscription.id === subscriptionId)
      if (!candidate || !["active", "provisioning", "pendingautomated", "pendingmanual"].includes(candidate.status.toLowerCase())) {
        return pause({ code: "PAX8_SUBSCRIPTION_PROVISIONING", state: "mailboxes_pending", message: "Wait until Pax8 reports the annual subscription as active or provisioning, then retry." })
      }
      const detailed = await pax8.getSubscription(candidate.id)
      if (detailed.companyId !== pax8CompanyId || detailed.productId !== "1bdd7ebb-f994-421f-ae98-b6a57bd9f947" || detailed.billingTerm !== "Annual" || detailed.quantity < Number(run.data.targetQuantity ?? request.quantity)) return { kind: "manual_review", code: "PAX8_SUBSCRIPTION_BINDING_MISMATCH" }
      if (!detailed.vendorSkuId) return { kind: "manual_review", code: "PAX8_VENDOR_SKU_MISSING" }
      const skus = await microsoft.listSubscribedSkus(tenantId)
      if (!skus.some((sku) => sku.skuId.toLowerCase() === detailed.vendorSkuId!.toLowerCase() && sku.enabled >= Number(run.data.targetQuantity ?? request.quantity))) {
        return pause({ code: "MICROSOFT_LICENSE_PROVISIONING", state: "mailboxes_pending", message: "The Microsoft subscription is not visible in the customer tenant yet. Retry after licensing provisions." })
      }
      const encryptionKey = required("MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY")
      const stored = object(run.data.setupCredentialBundles)
      const bundles: Record<string, string> = { ...stored as Record<string, string> }
      const createdUsers = Array.isArray(run.data.mailboxUsersCreated) ? run.data.mailboxUsersCreated.filter((value): value is string => typeof value === "string") : []
      const assigned = Array.isArray(run.data.mailboxLicensesAssigned) ? run.data.mailboxLicensesAssigned.filter((value): value is string => typeof value === "string") : []
      for (const user of request.mailboxUsers) {
        const existing = await microsoft.findUser(tenantId, user.userPrincipalName)
        if (existing && !bundles[user.userPrincipalName]) return { kind: "manual_review", code: "MAILBOX_ALREADY_EXISTS_REQUIRES_RECONCILIATION" }
        let graphUser = existing
        if (!graphUser) {
          const temporaryPassword = `Aa9!${randomBytes(27).toString("base64url")}`
          graphUser = await microsoft.createUser(tenantId, {
            userPrincipalName: user.userPrincipalName,
            displayName: user.displayName,
            mailNickname: user.localPart,
            temporaryPassword,
            usageLocation: request.customer.address.country.toUpperCase(),
          })
          bundles[user.userPrincipalName] = encryptMicrosoftMailSetupCredential(temporaryPassword, encryptionKey)
          createdUsers.push(user.userPrincipalName)
          return pause({ code: "MAILBOX_USER_CREATED", state: "mailboxes_pending", message: "The mailbox user was created. Continuing license assignment.", data: { setupCredentialBundles: bundles, mailboxUsersCreated: createdUsers } })
        }
        if (!assigned.includes(user.userPrincipalName)) {
          await microsoft.assignLicense(tenantId, graphUser.id, detailed.vendorSkuId)
          return pause({ code: "MAILBOX_LICENSE_ASSIGNED", state: "mailboxes_pending", message: "The mailbox license was assigned. Continuing setup.", data: { mailboxLicensesAssigned: [...assigned, user.userPrincipalName] } })
        }
      }
      return complete({ setupCredentialBundles: bundles, mailboxUsersCreated: createdUsers, pax8SubscriptionId: detailed.id, microsoftSkuId: detailed.vendorSkuId, licensedMailboxCount: request.quantity })
    },
    dns_cutover: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      const zoneId = typeof run.data.cloudflareZoneId === "string" ? run.data.cloudflareZoneId : ""
      if (!tenantId || !zoneId) return { kind: "manual_review", code: "DOMAIN_SETUP_REQUIRED" }
      const organizationDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
      if (!organizationDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
      const accessToken = await tokenProvider({ tenantId, resource: "exchange" })
      const readiness = await exchange.execute({ operation: "verify_mailboxes", customerTenantId: tenantId, customerOrganizationDomain: organizationDomain,
        domain: request.domain, accessToken, partnerUserPrincipalName: await partnerUpn(), mailboxAddresses: request.mailboxUsers.map(user => user.userPrincipalName) })
      if (readiness.mailboxesReady !== true) return pause({ code: "EXCHANGE_MAILBOX_PROVISIONING", state: "mailboxes_pending", message: "Waiting for Exchange to finish creating all licensed mailboxes." })
      if (typeof run.data.routingHash === "string") {
        const routing = inspectExistingMailRouting(request.domain, request.mailboxUsers.map(user => user.userPrincipalName), await cloudflare.listEmailRoutingRules(zoneId))
        if (routing.routingHash !== run.data.routingHash) return { kind: "manual_review", code: "EXISTING_MAIL_ROUTING_CHANGED" }
      }
      const [existing, serviceRecords] = await Promise.all([
        cloudflare.listDnsRecords(zoneId),
        microsoft.getDomainServiceRecords(tenantId, request.domain),
      ])
      const dkimRecords = Array.isArray(run.data.microsoftDkimRecords)
        ? run.data.microsoftDkimRecords.filter((record): record is { selector: string; target: string } => Boolean(record && typeof record === "object" && "selector" in record && typeof record.selector === "string" && "target" in record && typeof record.target === "string"))
        : []
      const plan = planMicrosoftMailDns({ domain: request.domain, existing, verificationRecords: [], serviceRecords, dkimRecords })
      const currentPlanHash = planHash(plan.cutover)
      const verifiedPlanHash = stateData(run).dnsCutoverPlanHash
      if (stateData(run).autoProvisionAuthorized !== true && (stateData(run).dnsCutoverConfirmed !== true || verifiedPlanHash !== currentPlanHash)) {
        return pause({
          code: "DNS_MX_CUTOVER_CONFIRMATION_REQUIRED",
          state: "dns_pending",
          message: "Review the expected Microsoft MX cutover and confirm before switching inbound email.",
          data: {
            dnsCutoverPlanHash: currentPlanHash,
            dnsCutoverChanges: previewDnsChanges(plan.cutover, existing),
            ...(verifiedPlanHash && verifiedPlanHash !== currentPlanHash ? { dnsCutoverConfirmed: false } : {}),
          },
        })
      }
      await cloudflare.applyMxCutover(zoneId, plan.cutover, existing)
      return complete({ dnsCutoverAppliedAt: new Date().toISOString(), dnsCutoverCount: plan.cutover.length })
    },
    dkim_enable: async ({ run, request }) => {
      const tenantId = customerTenantId(run)
      if (!tenantId) return { kind: "manual_review", code: "MICROSOFT_TENANT_ID_REQUIRED" }
      const organizationDomain = typeof run.data.customerOrganizationDomain === "string" ? run.data.customerOrganizationDomain : ""
      if (!organizationDomain) return { kind: "manual_review", code: "MICROSOFT_INITIAL_DOMAIN_MISSING" }
      const accessToken = await tokenProvider({ tenantId, resource: "exchange" })
      const result = await exchange.execute({ operation: "enable_dkim", customerTenantId: tenantId, customerOrganizationDomain: organizationDomain, accessToken, partnerUserPrincipalName: await partnerUpn(), domain: request.domain })
      if (result.dkimEnabled === false && result.dkimDnsReady === false) return pause({ code: "DKIM_DNS_PROPAGATING", state: "exchange_pending", message: "Waiting for the DKIM selector records to resolve before enabling signing." })
      return complete({ dkimEnabled: result.dkimEnabled === true, microsoftDkimRecords: result.dkimRecords ?? [] })
    },
    sendSetupEmail: async ({ run, request, user }) => {
      required("MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY")
      const baseUrl = setupBaseUrl(env)
      const states = object(run.data.setupEmailStates)
      const group = request.mailboxUsers.filter(candidate => candidate.setupEmail.trim().toLowerCase() === user.setupEmail.trim().toLowerCase() && states[candidate.userPrincipalName] !== "sent")
      const mailboxes: Array<{ displayName: string; userPrincipalName: string; setupUrl: string }> = []
      for (const member of group) {
        const encryptedPassword = object(run.data.setupCredentialBundles)[member.userPrincipalName]
        if (typeof encryptedPassword !== "string") return { kind: "manual_review", code: "SETUP_CREDENTIAL_MISSING" }
        const token = await createSetupTokenImpl({ payload: input.payload, runId: Number(run.id), userPrincipalName: member.userPrincipalName, encryptedPassword,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) })
        mailboxes.push({ displayName: member.displayName, userPrincipalName: member.userPrincipalName, setupUrl: `${baseUrl}/mailbox-setup#${token}` })
      }
      const locale = request.customer.address.country.toUpperCase() === "NL" ? "nl" as const : "en" as const
      const single = mailboxes[0]
      if (!single) return complete()
      const message = mailboxes.length === 1
        ? (input.buildSetupEmailMessage ?? (await import("../email/templates/microsoftMailboxReady.ts")).microsoftMailboxReadyTemplate)({ ...single, locale })
        : (input.buildSetupBatchEmailMessage ?? (await import("../email/templates/microsoftMailboxesReady.ts")).microsoftMailboxesReadyTemplate)({ mailboxes, locale })
      let mailPayload = input.mailPayload
      let sendEmailImpl = input.sendEmailImpl
      if (!sendEmailImpl) {
        const email = await import("../email/sendEmail.ts")
        sendEmailImpl = email.sendEmail
        mailPayload ??= email.asMailLogPayload(input.payload)
      }
      await sendEmailImpl({ to: user.setupEmail, ...message, intent: "platform.operational", category: "transactional", tenant: request.tenantId, payload: mailPayload })
      const nextBundles = { ...object(run.data.setupCredentialBundles) }
      const nextStates = { ...states }
      for (const member of group) { delete nextBundles[member.userPrincipalName]; nextStates[member.userPrincipalName] = "sent" }
      return complete({ setupCredentialBundles: nextBundles, setupEmailStates: nextStates })
    },
  }
}
