import "server-only"

export type Pax8Company = {
  id: string
  name: string
  status?: string
  website?: string | null
  externalId?: string | null
}

export type Pax8Contact = {
  firstName: string
  lastName: string
  email: string
  phone: string
  types: Array<{ type: "Admin" | "Billing" | "Technical"; primary: boolean }>
}

export type Pax8Product = {
  id: string
  name: string
  vendorName?: string
  requiresCommitment?: boolean
}

export type Pax8ProvisioningField = {
  key: string
  label?: string
  required?: boolean
  valueType?: string
  possibleValues?: string[] | null
  description?: string
}

export type Pax8Commitment = {
  id: string
  term: string
  autoRenew?: boolean
}

export type Pax8Subscription = {
  id: string
  currentSubscriptionId?: string
  companyId: string
  productId: string
  productName?: string
  status: string
  quantity: number
  billingTerm: string
  startDate?: string
  endDate?: string
  commitmentTermStartDate?: string
  commitmentTermEndDate?: string
  vendorSkuId?: string
}

export type Pax8Order = {
  id?: string
  companyId: string
  createdDate?: string
  orderedByUserEmail?: string
  lineItems: Array<{
    subscriptionId: string | null
    productId: string
    quantity: number
    billingTerm: string
    commitmentTermId?: string
  }>
}

export type Pax8CompanyInput = {
  name: string
  website: string
  externalId?: string
  phone: string
  address: { street: string; city: string; postalCode: string; country: string }
  contacts: Pax8Contact[]
}

export type Pax8Pricing = Record<string, unknown>

export type Pax8OrderInput = {
  companyId: string
  orderedByUserEmail: string
  lineItems: Array<{
    productId: string
    lineItemNumber: number
    quantity: number
    billingTerm: "Annual" | "Monthly"
    commitmentTermId: string
    provisioningDetails: Array<{ key: string; values: string[] }>
  }>
}

export class Pax8ApiError extends Error {
  readonly operation: string
  readonly status: number
  readonly code: string | null

  constructor(
    operation: string,
    status: number,
    code: string | null,
  ) {
    super(`Pax8 ${operation} failed with HTTP ${status}${code ? ` (${code})` : ""}.`)
    this.name = "Pax8ApiError"
    this.operation = operation
    this.status = status
    this.code = code
  }
}

export class Pax8IndeterminateWriteError extends Error {
  readonly operation: string

  constructor(operation: string) {
    super(`Pax8 ${operation} has an indeterminate outcome; reconcile before retrying.`)
    this.name = "Pax8IndeterminateWriteError"
    this.operation = operation
  }
}

type Pax8ClientOptions = {
  clientId: string
  clientSecret: string
  apiBase?: string
  audience?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

const hostOf = (value: string): string => {
  const trimmed = value.trim().toLowerCase()
  try {
    const url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.host.replace(/^www\./, "")
  } catch {
    return trimmed.replace(/^www\./, "")
  }
}

function companyPhoneNumber(phone: string, country: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, "").replace(/^(?:\+|00)/, "")
  if (country.toUpperCase() === "NL" && /^0[1-9]\d{8}$/.test(compact)) return `31${compact.slice(1)}`
  return compact
}

export class Pax8Client {
  readonly #clientId: string
  readonly #clientSecret: string
  readonly #apiBase: string
  readonly #audience: string
  readonly #fetch: typeof fetch
  readonly #now: () => number
  #token: { value: string; expiresAt: number } | null = null

  constructor(options: Pax8ClientOptions) {
    this.#clientId = options.clientId.trim()
    this.#clientSecret = options.clientSecret
    this.#apiBase = (options.apiBase ?? "https://api.pax8.com/v1").replace(/\/+$/, "")
    this.#audience = (options.audience ?? new URL(this.#apiBase).origin).replace(/\/+$/, "")
    this.#fetch = options.fetchImpl ?? fetch
    this.#now = options.now ?? Date.now
    if (!this.#clientId || !this.#clientSecret) throw new Error("Pax8 API credentials are not configured.")
  }

  async #accessToken(): Promise<string> {
    const now = this.#now()
    if (this.#token && this.#token.expiresAt > now + 30_000) return this.#token.value
    let response: Response
    try {
      response = await this.#fetch(`${this.#apiBase}/token`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          audience: this.#audience,
          grant_type: "client_credentials",
        }),
      })
    } catch {
      throw new Pax8ApiError("token", 0, "network_error")
    }
    const body = object(await parseJson(response))
    if (!response.ok) throw new Pax8ApiError("token", response.status, stringValue(body.error))
    const accessToken = stringValue(body.access_token)
    const expiresIn = Number(body.expires_in)
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Pax8ApiError("token", response.status, "invalid_token_response")
    }
    this.#token = { value: accessToken, expiresAt: now + expiresIn * 1000 }
    return accessToken
  }

  async #request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    const token = await this.#accessToken()
    const url = path.startsWith("https://") ? path : `${this.#apiBase}${path}`
    let response: Response
    try {
      response = await this.#fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      if (method !== "GET") throw new Pax8IndeterminateWriteError(path)
      throw new Pax8ApiError(path, 0, "network_error")
    }
    const payload = await parseJson(response)
    if (!response.ok) {
      if (method !== "GET" && (response.status === 408 || response.status >= 500)) {
        throw new Pax8IndeterminateWriteError(path)
      }
      const bodyRecord = object(payload)
      const code = stringValue(bodyRecord.code) ?? stringValue(object(bodyRecord.error).code)
      throw new Pax8ApiError(path, response.status, code)
    }
    return payload as T
  }

  async listCompanies(): Promise<Pax8Company[]> {
    const companies: Pax8Company[] = []
    let page = 0
    let totalPages: number | null = null
    while (page === 0 || totalPages != null && page < totalPages) {
      const body = object(await this.#request<unknown>("GET", `/companies?page=${page}&size=200`))
      const content = Array.isArray(body.content) ? body.content : []
      companies.push(...content.map((entry) => entry as Pax8Company))
      const pageInfo = object(body.page)
      const nextTotal = Number(pageInfo.totalPages)
      totalPages = Number.isSafeInteger(nextTotal) && nextTotal >= 0 ? nextTotal : null
      if (totalPages == null || page + 1 >= totalPages) break
      page += 1
      if (page > 500) throw new Pax8ApiError("companies", 200, "pagination_safety_limit")
    }
    return companies
  }

  async findCompanyByWebsite(website: string): Promise<Pax8Company | null> {
    const domain = hostOf(website)
    if (!domain) return null
    const companies = await this.listCompanies()
    return companies.find((company) => hostOf(company.website ?? "") === domain) ?? null
  }

  async createCompany(input: Pax8CompanyInput): Promise<Pax8Company> {
    return this.#request<Pax8Company>("POST", "/companies", {
      ...input,
      phone: companyPhoneNumber(input.phone, input.address.country),
      contacts: input.contacts.map(contact => ({ ...contact, phone: companyPhoneNumber(contact.phone, input.address.country) })),
      billOnBehalfOfEnabled: false,
      selfServiceAllowed: false,
      orderApprovalRequired: false,
    })
  }

  async updateCompanyExternalId(companyId: string, externalId: string): Promise<Pax8Company> {
    const value = externalId.trim()
    if (!value) throw new Error("A Microsoft tenant ID is required for the Pax8 external ID mapping.")
    return this.#request<Pax8Company>("PATCH", `/companies/${encodeURIComponent(companyId)}`, { externalId: value })
  }

  async searchProducts(query: string): Promise<Pax8Product[]> {
    const body = object(await this.#request<unknown>("GET", `/products?search=${encodeURIComponent(query)}&size=50`))
    return Array.isArray(body.content) ? body.content as Pax8Product[] : []
  }

  async getProduct(productId: string): Promise<Pax8Product> {
    return this.#request<Pax8Product>("GET", `/products/${encodeURIComponent(productId)}`)
  }

  async getProvisioningFields(productId: string): Promise<Pax8ProvisioningField[]> {
    const body = object(await this.#request<unknown>("GET", `/products/${encodeURIComponent(productId)}/provision-details`))
    return Array.isArray(body.content) ? body.content as Pax8ProvisioningField[] : []
  }

  async getCommitmentTerms(productId: string): Promise<Pax8Commitment[]> {
    const body = object(await this.#request<unknown>("GET", `/products/${encodeURIComponent(productId)}/dependencies`))
    return Array.isArray(body.commitmentDependencies) ? body.commitmentDependencies as Pax8Commitment[] : []
  }

  async getDependencies(productId: string): Promise<Record<string, unknown>> {
    return object(await this.#request<unknown>("GET", `/products/${encodeURIComponent(productId)}/dependencies`))
  }

  async getPricing(productId: string, companyId?: string): Promise<Pax8Pricing> {
    const query = companyId ? `?${new URLSearchParams({ companyId })}` : ""
    return object(await this.#request<unknown>("GET", `/products/${encodeURIComponent(productId)}/pricing${query}`))
  }

  async getCompany(companyId: string): Promise<Pax8Company> {
    return this.#request<Pax8Company>("GET", `/companies/${encodeURIComponent(companyId)}`)
  }

  async getOrder(orderId: string): Promise<Pax8Order> {
    return this.#request<Pax8Order>("GET", `/orders/${encodeURIComponent(orderId)}`)
  }

  async createOrder(input: Pax8OrderInput, options: { mock: boolean }): Promise<Pax8Order> {
    const query = options.mock ? "?isMock=true" : ""
    return this.#request<Pax8Order>("POST", `/orders${query}`, {
      companyId: input.companyId,
      orderedBy: "Pax8 Partner",
      orderedByUserEmail: input.orderedByUserEmail,
      lineItems: input.lineItems,
    })
  }

  async listSubscriptions(companyId: string): Promise<Pax8Subscription[]> {
    const all: Pax8Subscription[] = []
    let page = 0
    let totalPages: number | null = null
    while (page === 0 || totalPages != null && page < totalPages) {
      const query = new URLSearchParams({ companyId, page: String(page), size: "200" })
      const body = object(await this.#request<unknown>("GET", `/subscriptions?${query}`))
      const content = Array.isArray(body.content) ? body.content : []
      all.push(...content.map((entry) => entry as Pax8Subscription))
      const pageInfo = object(body.page)
      const nextTotal = Number(pageInfo.totalPages)
      totalPages = Number.isSafeInteger(nextTotal) && nextTotal >= 0 ? nextTotal : null
      if (totalPages == null || page + 1 >= totalPages) break
      page += 1
      if (page > 500) throw new Pax8ApiError("subscriptions", 200, "pagination_safety_limit")
    }
    return all
  }

  async getSubscription(subscriptionId: string): Promise<Pax8Subscription> {
    return this.#request<Pax8Subscription>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`)
  }

  async updateSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<Pax8Subscription> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error("Pax8 subscription quantity must be a positive integer.")
    }
    return this.#request<Pax8Subscription>("PUT", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { quantity })
  }

  async scheduleEndOfTermCancellation(subscriptionId: string, commitmentEndsAt: string): Promise<void> {
    const date = new Date(commitmentEndsAt)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= this.#now()) throw new Error("Future verified term end required for scheduled cancellation.")
    await this.#request<void>("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}?${new URLSearchParams({ cancelDate: date.toISOString() })}`)
  }
}

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null
