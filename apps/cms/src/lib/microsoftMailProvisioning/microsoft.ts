import { mailApplicationResources } from "@siteinabox/contracts/microsoft-mail-authority"
import "server-only"
import { createHash, randomUUID } from "node:crypto"

export type MicrosoftResource = "graph" | "partner_center" | "exchange"
export const MICROSOFT_MAIL_APPLICATION_GRANT_VERSION = "microsoft-mail-app-grants-v2"
export { MAIL_SIGN_IN_GRANT_VERSION, mailSignInGraphScopes } from "@siteinabox/contracts/microsoft-mail-authority"

/**
 * Reads the delegated `scp` claim of an access token this process just obtained.
 * Used only as a capability gate (a fresh token must carry the reviewed scopes);
 * it is never treated as signature validation or as proof of the GDAP role.
 */
export function delegatedTokenScopes(accessToken: string): Set<string> {
  const segment = accessToken.split(".")[1]
  if (!segment) return new Set()
  try {
    const claims = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown
    const scp = claims && typeof claims === "object" && "scp" in claims && typeof claims.scp === "string" ? claims.scp : ""
    return new Set(scp.split(/\s+/).filter(Boolean))
  } catch { return new Set() }
}

export type MicrosoftTokenProvider = (input: {
  tenantId: string
  resource: MicrosoftResource
}) => Promise<string>

export type MicrosoftDomain = {
  id: string
  isVerified: boolean
  isDefault: boolean
  supportedServices?: string[]
}

export type MicrosoftDnsRecord = {
  recordType: string
  label?: string
  text?: string
  mailExchange?: string
  preference?: number
  canonicalName?: string
  ttl?: number
}

export type MicrosoftUser = {
  id: string
  userPrincipalName: string
  displayName: string
  mail?: string | null
}

export type MicrosoftGdapRelationship = {
  id: string
  displayName: string
  status: string
  customer?: { tenantId?: string; displayName?: string }
  duration?: string
  endDateTime?: string
  accessDetails?: { unifiedRoles?: Array<{ roleDefinitionId: string }> }
}
export type MicrosoftGdapAccessAssignment = { id: string; status: string;
  accessContainer?: { accessContainerId?: string; accessContainerType?: string };
  accessDetails?: { unifiedRoles?: Array<{ roleDefinitionId: string }> } }

export class MicrosoftApiError extends Error {
  readonly operation: string
  readonly status: number
  readonly code: string | null
  readonly retryable: boolean | null

  constructor(operation: string, status: number, code: string | null, retryable: boolean | null = null) {
    super(`Microsoft ${operation} failed with HTTP ${status}${code ? ` (${code})` : ""}.`)
    this.name = "MicrosoftApiError"
    this.operation = operation
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export class MicrosoftIndeterminateWriteError extends Error {
  readonly operation: string

  constructor(operation: string) {
    super(`Microsoft ${operation} has an indeterminate outcome; reconcile before retrying.`)
    this.name = "MicrosoftIndeterminateWriteError"
    this.operation = operation
  }
}

export type MicrosoftMailClientOptions = {
  partnerTenantId: string
  clientId: string
  accessToken: MicrosoftTokenProvider
  nativeAdminAgentsGroupId?: string
  appConsentRedirectUri?: string
  fetchImpl?: typeof fetch
  graphBase?: string
  partnerCenterBase?: string
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

const responseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

const errorCode = (body: unknown): string | null => {
  const error = object(object(body).error)
  const code = stringValue(error.code) ?? stringValue(object(body).errorName)
  return code && /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : null
}

const encodePath = (value: string): string => encodeURIComponent(value.trim())

export class MicrosoftMailClient {
  readonly #partnerTenantId: string
  readonly #clientId: string
  readonly #nativeAdminAgentsGroupId: string | null
  readonly #accessToken: MicrosoftTokenProvider
  readonly #appConsentRedirectUri: string | null
  readonly #fetch: typeof fetch
  readonly #graphBase: string
  readonly #partnerCenterBase: string

  constructor(options: MicrosoftMailClientOptions) {
    this.#partnerTenantId = options.partnerTenantId.trim()
    this.#clientId = options.clientId.trim()
    this.#nativeAdminAgentsGroupId = options.nativeAdminAgentsGroupId?.trim().toLowerCase() || null
    this.#accessToken = options.accessToken
    this.#appConsentRedirectUri = options.appConsentRedirectUri?.trim() || null
    if (this.#appConsentRedirectUri && new URL(this.#appConsentRedirectUri).protocol !== "https:") {
      throw new Error("Microsoft app-consent redirect URI must use HTTPS.")
    }
    this.#fetch = options.fetchImpl ?? fetch
    this.#graphBase = (options.graphBase ?? "https://graph.microsoft.com/v1.0").replace(/\/+$/, "")
    this.#partnerCenterBase = (options.partnerCenterBase ?? "https://api.partnercenter.microsoft.com/v1").replace(/\/+$/, "")
    if (!this.#partnerTenantId || !this.#clientId) {
      throw new Error("Microsoft CSP partner tenant and application IDs are required.")
    }
  }

  directMcaAcceptanceUrl(): string {
    return "https://admin.microsoft.com/AdminPortal/Home?ref=/BillingAccounts/agreement"
  }

  appConsentUrl(customerTenantId: string, state: string): string {
    if (!this.#appConsentRedirectUri || !state.trim()) throw new Error("A registered Microsoft app-consent redirect URI and state are required.")
    const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(customerTenantId)}/adminconsent`)
    url.searchParams.set("client_id", this.#clientId)
    url.searchParams.set("redirect_uri", this.#appConsentRedirectUri)
    url.searchParams.set("state", state)
    return url.toString()
  }

  async createGdapApprovalRequest(input: {
    customerTenantId: string
    displayName: string
    durationDays: number
    roleDefinitionIds: readonly string[]
  }): Promise<{ relationshipId: string; requestId: string; approvalUrl: string }> {
    if (!Number.isSafeInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 730) {
      throw new Error("GDAP duration must be between 1 and 730 days.")
    }
    if (input.roleDefinitionIds.length === 0 || input.roleDefinitionIds.some((id) => !id.trim())) {
      throw new Error("GDAP requires at least one validated Microsoft Entra role.")
    }
    const relationship = await this.#request<unknown>({
      resource: "graph",
      tenantId: this.#partnerTenantId,
      method: "POST",
      path: "/tenantRelationships/delegatedAdminRelationships",
      operation: "GDAP relationship creation",
      body: {
        displayName: input.displayName.trim().slice(0, 50),
        duration: `P${input.durationDays}D`,
        autoExtendDuration: "P180D",
        customer: { tenantId: input.customerTenantId },
        accessDetails: {
          unifiedRoles: input.roleDefinitionIds.map((roleDefinitionId) => ({ roleDefinitionId })),
        },
      },
    })
    const relationshipId = stringValue(object(relationship).id)
    if (!relationshipId) throw new MicrosoftIndeterminateWriteError("GDAP relationship creation")
    const request = await this.#request<unknown>({
      resource: "graph",
      tenantId: this.#partnerTenantId,
      method: "POST",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(relationshipId)}/requests`,
      operation: "GDAP approval request creation",
      body: { action: "lockForApproval" },
    })
    const requestId = stringValue(object(request).id)
    if (!requestId) throw new MicrosoftIndeterminateWriteError("GDAP approval request creation")
    return {
      relationshipId,
      requestId,
      approvalUrl: `https://admin.microsoft.com/AdminPortal/Home#/partners/invitation/granularAdminRelationships/${encodeURIComponent(relationshipId)}`,
    }
  }

  async listCustomerGdapRelationships(customerTenantId: string): Promise<MicrosoftGdapRelationship[]> {
    const rows = await this.#listGraphPages<MicrosoftGdapRelationship>("/tenantRelationships/delegatedAdminRelationships")
    return rows.filter(row => row.customer?.tenantId?.toLowerCase() === customerTenantId.toLowerCase())
  }

  async listGdapAccessAssignments(relationshipId: string): Promise<MicrosoftGdapAccessAssignment[]> {
    return this.#listGraphPages<MicrosoftGdapAccessAssignment>(`/tenantRelationships/delegatedAdminRelationships/${encodePath(relationshipId)}/accessAssignments`)
  }

  async approveProviderGdap(input: { relationshipId: string; customerTenantId: string }): Promise<{ requestId: string | null }> {
    const relationship = await this.getGdapRelationship(input.relationshipId)
    if (relationship.customer?.tenantId?.toLowerCase() !== input.customerTenantId.toLowerCase()) throw new Error("GDAP customer binding mismatch.")
    if (relationship.status === "active") return { requestId: null }
    if (relationship.status !== "approvalPending") throw new Error("GDAP relationship is not offered for approval.")
    // Microsoft permits this action only for an indirect-provider-created offer.
    const result = await this.#request<{ id?: string }>({ resource: "graph", tenantId: this.#partnerTenantId, method: "POST",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(input.relationshipId)}/requests`, operation: "provider GDAP approval", body: { action: "approve" } })
    if (!result.id) throw new MicrosoftIndeterminateWriteError("provider GDAP approval")
    return { requestId: result.id }
  }

  async #listGraphPages<T>(route: string, tenantId = this.#partnerTenantId, query: Record<string, string> = {}, headers?: Record<string, string>): Promise<T[]> {
    const rows: T[] = []
    let path = `${route}?${new URLSearchParams({ ...query, "$top": "100" })}`
    const visited = new Set<string>()
    while (path) {
      if (visited.has(path) || visited.size >= 50) throw new Error("Invalid GDAP pagination cycle or limit.")
      visited.add(path)
      const page = await this.#request<{ value?: T[]; "@odata.nextLink"?: string }>({
        resource: "graph", tenantId, method: "GET", path, operation: "Graph discovery", ...(headers ? { headers } : {}),
      })
      if (!Array.isArray(page.value)) throw new Error("Invalid GDAP discovery response.")
      rows.push(...page.value)
      path = ""
      if (page["@odata.nextLink"]) {
        const next = new URL(page["@odata.nextLink"])
        const expected = new URL(`${this.#graphBase}${route}`)
        if (next.origin !== expected.origin || next.pathname !== expected.pathname || next.username || next.password || next.hash) throw new Error("Untrusted GDAP pagination URL.")
        path = route + next.search
      }
    }
    return rows
  }

  async getGdapRelationship(relationshipId: string): Promise<MicrosoftGdapRelationship> {
    return this.#request<MicrosoftGdapRelationship>({
      resource: "graph",
      tenantId: this.#partnerTenantId,
      method: "GET",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(relationshipId)}`,
      operation: "GDAP relationship read",
    })
  }

  async createGdapAccessAssignment(input: {
    relationshipId: string
    partnerSecurityGroupId: string
    roleDefinitionIds: readonly string[]
  }): Promise<{ id: string; status: string }> {
    const result = await this.#request<unknown>({
      resource: "graph",
      tenantId: this.#partnerTenantId,
      method: "POST",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(input.relationshipId)}/accessAssignments`,
      operation: "GDAP access assignment",
      body: {
        accessContainer: {
          accessContainerId: input.partnerSecurityGroupId,
          accessContainerType: "securityGroup",
        },
        accessDetails: {
          unifiedRoles: input.roleDefinitionIds.map((roleDefinitionId) => ({ roleDefinitionId })),
        },
      },
    })
    const id = stringValue(object(result).id)
    const status = stringValue(object(result).status)
    if (!id || !status) throw new MicrosoftIndeterminateWriteError("GDAP access assignment")
    return { id, status }
  }

  async getGdapAccessAssignment(relationshipId: string, assignmentId: string): Promise<MicrosoftGdapAccessAssignment> {
    return this.#request({ resource: "graph", tenantId: this.#partnerTenantId, method: "GET",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(relationshipId)}/accessAssignments/${encodePath(assignmentId)}`, operation: "GDAP assignment read" })
  }

  async updateGdapAccessAssignment(relationshipId: string, assignmentId: string, roleDefinitionIds: readonly string[]): Promise<void> {
    await this.#request({ resource: "graph", tenantId: this.#partnerTenantId, method: "PATCH", operation: "GDAP assignment role update",
      path: `/tenantRelationships/delegatedAdminRelationships/${encodePath(relationshipId)}/accessAssignments/${encodePath(assignmentId)}`,
      body: { accessDetails: { unifiedRoles: roleDefinitionIds.map(roleDefinitionId => ({ roleDefinitionId })) } } })
  }

  async revokeCustomerApplicationConsent(customerTenantId: string): Promise<void> {
    await this.#request({ resource: "partner_center", tenantId: this.#partnerTenantId, method: "DELETE", operation: "customer application consent revocation",
      path: `/customers/${encodePath(customerTenantId)}/applicationconsents/${encodePath(this.#clientId)}` })
  }

  async consentCustomerApplication(customerTenantId: string, requestId: string, resource?: "graph" | "exchange", extraGraphScopes: readonly string[] = []): Promise<void> {
    const grants = mailApplicationResources.map((resource, index) => ({ enterpriseApplicationId: resource.resourceApplicationId,
      scope: [...new Set([...resource.scopes, ...(index === 0 ? extraGraphScopes : [])])].join(", ") }))
    // Partner Center requires a separate consent request for each resource.
    for (const [index, grant] of grants.entries()) {
      if (resource && (index === 0 ? "graph" : "exchange") !== resource) continue
      const hash = createHash("sha256").update(`${requestId}:${grant.enterpriseApplicationId}`).digest("hex")
      const resourceRequestId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`
      await this.#request({ resource: "partner_center", tenantId: this.#partnerTenantId, method: "POST",
        path: `/customers/${encodePath(customerTenantId)}/applicationconsents`, operation: "customer application consent",
        headers: { "MS-RequestId": resourceRequestId, "MS-CorrelationId": randomUUID(), ValidateMfa: "true" },
        body: { applicationId: this.#clientId, displayName: "Siteinabox mail", applicationGrants: [grant] },
      })
    }
  }

  /** Effective partner principal must belong to the configured workload group and native AdminAgents. */
  async partnerGroupMembershipVerified(groupId: string): Promise<boolean> {
    if (!this.#nativeAdminAgentsGroupId) return false
    const groups = (await this.#listGraphPages<unknown>("/me/transitiveMemberOf/microsoft.graph.group", this.#partnerTenantId,
      { "$select": "id,displayName,securityEnabled", "$count": "true" }, { ConsistencyLevel: "eventual" })).map(object)
    const native = groups.filter(group => typeof group.id === "string" && group.id.toLowerCase() === this.#nativeAdminAgentsGroupId && group.securityEnabled === true)
    return native.length === 1 && groups.some(group => typeof group.id === "string" && group.id.toLowerCase() === groupId.toLowerCase() && group.securityEnabled === true)
  }

  /** Read back actual tenant-wide grants; a successful token/read is not write-scope evidence. */
  async customerApplicationGrantsVerified(customerTenantId: string, extraGraphScopes: readonly string[] = []): Promise<boolean> {
    const graphApp = mailApplicationResources[0].resourceApplicationId, exchangeApp = mailApplicationResources[1].resourceApplicationId
    const appIds = [this.#clientId, graphApp, exchangeApp]
    const principals = await this.#listGraphPages<{ id?: string; appId?: string }>("/servicePrincipals", customerTenantId,
      { "$filter": appIds.map(id => `appId eq '${id.replaceAll("'", "''")}'`).join(" or "), "$select": "id,appId" })
    const ids = appIds.map(appId => principals.filter(principal => principal.appId?.toLowerCase() === appId.toLowerCase()))
    if (ids.some(matches => matches.length !== 1 || !matches[0]?.id)) return false
    const [clientId, graphId, exchangeId] = ids.map(matches => matches[0]!.id!)
    const grants = await this.#listGraphPages<{ clientId?: string; resourceId?: string; consentType?: string; scope?: string }>("/oauth2PermissionGrants", customerTenantId,
      { "$filter": `clientId eq '${clientId!.replaceAll("'", "''")}'`, "$select": "clientId,resourceId,consentType,scope" })
    const has = (resourceId: string | undefined, scopes: readonly string[]) => {
      const granted = new Set(grants.filter(grant => grant.clientId === clientId && grant.resourceId === resourceId && grant.consentType === "AllPrincipals")
        .flatMap(grant => typeof grant.scope === "string" ? grant.scope.split(/\s+/) : []))
      return scopes.every(scope => granted.has(scope))
    }
    return has(graphId, [...mailApplicationResources[0].scopes, ...extraGraphScopes]) && has(exchangeId, mailApplicationResources[1].scopes)
  }

  async getDomain(customerTenantId: string, domain: string): Promise<MicrosoftDomain | null> {
    try {
      return await this.#request<MicrosoftDomain>({
        resource: "graph",
        tenantId: customerTenantId,
        method: "GET",
        path: `/domains/${encodePath(domain)}`,
        operation: "domain read",
      })
    } catch (error) {
      if (error instanceof MicrosoftApiError && error.status === 404) return null
      throw error
    }
  }

  async ensureDomain(customerTenantId: string, domain: string): Promise<MicrosoftDomain> {
    const existing = await this.getDomain(customerTenantId, domain)
    if (existing) return existing
    return this.#request<MicrosoftDomain>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "POST",
      path: "/domains",
      operation: "domain creation",
      body: { id: domain },
    })
  }

  async getDomainVerificationRecords(customerTenantId: string, domain: string): Promise<MicrosoftDnsRecord[]> {
    const result = await this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "GET",
      path: `/domains/${encodePath(domain)}/verificationDnsRecords`,
      operation: "domain verification record read",
    })
    return Array.isArray(object(result).value) ? object(result).value as MicrosoftDnsRecord[] : []
  }

  async verifyDomain(customerTenantId: string, domain: string): Promise<MicrosoftDomain> {
    return this.#request<MicrosoftDomain>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "POST",
      path: `/domains/${encodePath(domain)}/verify`,
      operation: "domain verification",
    })
  }

  async getDomainServiceRecords(customerTenantId: string, domain: string): Promise<MicrosoftDnsRecord[]> {
    const result = await this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "GET",
      path: `/domains/${encodePath(domain)}/serviceConfigurationRecords`,
      operation: "mail service record read",
    })
    return Array.isArray(object(result).value) ? object(result).value as MicrosoftDnsRecord[] : []
  }

  async listSubscribedSkus(customerTenantId: string): Promise<Array<{ skuId: string; skuPartNumber: string; enabled: number }>> {
    const result = await this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "GET",
      path: "/subscribedSkus",
      operation: "subscribed SKU read",
    })
    const value = object(result).value
    const entries: unknown[] = Array.isArray(value) ? value : []
    return entries.flatMap((entry) => {
      const record = object(entry)
      const skuId = stringValue(record.skuId)
      const skuPartNumber = stringValue(record.skuPartNumber)
      const enabled = Number(object(record.prepaidUnits).enabled)
      return skuId && skuPartNumber && Number.isSafeInteger(enabled)
        ? [{ skuId, skuPartNumber, enabled }]
        : []
    })
  }

  async getOrganization(customerTenantId: string): Promise<{ id: string; displayName?: string; initialDomain?: string }> {
    const result = await this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "GET",
      path: "/organization?$select=id,displayName,verifiedDomains",
      operation: "customer organization read",
    })
    const value = object(result).value
    const first = Array.isArray(value) ? value[0] : null
    const record = object(first)
    const id = stringValue(record.id)
    if (!id) throw new MicrosoftApiError("customer organization read", 502, "organization_id_missing")
    const verifiedDomains = Array.isArray(record.verifiedDomains) ? record.verifiedDomains.map(object) : []
    const initialDomain = verifiedDomains.find((domain) => domain.isInitial === true && typeof domain.name === "string" && domain.name.toLowerCase().endsWith(".onmicrosoft.com"))
    return {
      id,
      ...(stringValue(record.displayName) ? { displayName: stringValue(record.displayName)! } : {}),
      ...(typeof initialDomain?.name === "string" ? { initialDomain: initialDomain.name.toLowerCase() } : {}),
    }
  }

  async findUser(customerTenantId: string, userPrincipalName: string): Promise<MicrosoftUser | null> {
    try {
      return await this.#request<MicrosoftUser>({
        resource: "graph",
        tenantId: customerTenantId,
        method: "GET",
        path: `/users/${encodePath(userPrincipalName)}`,
        operation: "user read",
      })
    } catch (error) {
      if (error instanceof MicrosoftApiError && error.status === 404) return null
      throw error
    }
  }

  async ensureUser(customerTenantId: string, input: {
    userPrincipalName: string
    displayName: string
    mailNickname: string
    temporaryPassword: string
    usageLocation: string
  }): Promise<MicrosoftUser> {
    const existing = await this.findUser(customerTenantId, input.userPrincipalName)
    if (existing) return existing
    return this.createUser(customerTenantId, input)
  }

  async createUser(customerTenantId: string, input: { userPrincipalName: string; displayName: string; mailNickname: string; temporaryPassword: string; usageLocation: string }): Promise<MicrosoftUser> {
    const created = await this.#request<MicrosoftUser>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "POST",
      path: "/users",
      operation: "user creation",
      body: {
        accountEnabled: true,
        displayName: input.displayName,
        mailNickname: input.mailNickname,
        userPrincipalName: input.userPrincipalName,
        usageLocation: input.usageLocation,
        passwordProfile: {
          password: input.temporaryPassword,
          // Login-only product: the delivered password is the customer's password.
          forceChangePasswordNextSignIn: false,
        },
      },
    })
    if (!created?.id || created.userPrincipalName?.toLowerCase() !== input.userPrincipalName.toLowerCase()) throw new MicrosoftIndeterminateWriteError("user creation readback")
    return created
  }

  async assignLicense(customerTenantId: string, userId: string, skuId: string): Promise<void> {
    await this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "POST",
      path: `/users/${encodePath(userId)}/assignLicense`,
      operation: "license assignment",
      body: { addLicenses: [{ skuId, disabledPlans: [] }], removeLicenses: [] },
    })
  }

  /** Tenant security defaults (forced MFA registration). Throws when the response is not the documented shape. */
  async getSecurityDefaultsEnabled(customerTenantId: string): Promise<boolean> {
    const raw = object(await this.#request<unknown>({ resource: "graph", tenantId: customerTenantId, method: "GET", operation: "security defaults read",
      path: "/policies/identitySecurityDefaultsEnforcementPolicy" }))
    if (typeof raw.isEnabled !== "boolean") throw new MicrosoftApiError("security defaults read", 200, "unexpected_shape")
    return raw.isEnabled
  }

  async setSecurityDefaultsEnabled(customerTenantId: string, isEnabled: boolean): Promise<void> {
    await this.#request({ resource: "graph", tenantId: customerTenantId, method: "PATCH", operation: "security defaults update",
      path: "/policies/identitySecurityDefaultsEnforcementPolicy", body: { isEnabled } })
  }

  async getMailboxSettings(customerTenantId: string, userId: string): Promise<unknown> {
    return this.#request<unknown>({
      resource: "graph",
      tenantId: customerTenantId,
      method: "GET",
      path: `/users/${encodePath(userId)}/mailboxSettings`,
      operation: "mailbox readiness read",
    })
  }

  async #request<T>(input: {
    resource: MicrosoftResource
    tenantId: string
    method: "GET" | "POST" | "PATCH" | "DELETE"
    path: string
    operation: string
    body?: unknown
    headers?: Record<string, string>
  }): Promise<T> {
    const token = await this.#accessToken({ tenantId: input.tenantId, resource: input.resource })
    const base = input.resource === "graph"
      ? this.#graphBase
      : this.#partnerCenterBase
    let response: Response
    try {
      response = await this.#fetch(`${base}${input.path}`, {
        method: input.method,
        signal: AbortSignal.timeout(30_000),
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...input.headers,
          ...(input.body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      })
    } catch {
      if (input.method !== "GET") throw new MicrosoftIndeterminateWriteError(input.operation)
      throw new MicrosoftApiError(input.operation, 0, "network_error")
    }
    const payload = await responseJson(response)
    if (!response.ok) {
      if (input.method !== "GET" && (response.status === 408 || response.status >= 500)) {
        throw new MicrosoftIndeterminateWriteError(input.operation)
      }
      throw new MicrosoftApiError(input.operation, response.status, errorCode(payload), typeof object(payload).isRetryable === "boolean" ? object(payload).isRetryable as boolean : null)
    }
    return payload as T
  }
}
