import "server-only"

export type ExchangeWorkerOperation = "ensure_info_shared" | "ensure_info_forward" | "ensure_info_alias" | "get_dkim_targets" | "enable_dkim" | "verify_mailboxes" | "verify_access"

export type ExchangeWorkerRequest = {
  operation: ExchangeWorkerOperation
  customerTenantId: string
  customerOrganizationDomain: string
  accessToken: string
  partnerUserPrincipalName: string
  domain: string
  infoAddress?: string
  forwardTo?: string
  targetAddress?: string
  mailboxAddresses?: string[]
}

export type ExchangeWorkerResult = {
  operation: ExchangeWorkerOperation
  completed: boolean
  sharedMailbox?: string
  sharedMailboxMembers?: string[]
  forwardingAddress?: string
  alias?: string
  aliasTarget?: string
  mailboxesReady?: boolean
  accessVerified?: boolean
  dkimDnsReady?: boolean
  dkimEnabled?: boolean
  dkimRecords?: Array<{ selector: string; target: string }>
}

export type ExchangeWorkerHealth = { healthy: boolean; protocolVersion: 1; moduleVersion: string; dnsToolAvailable: boolean }

export function exchangeWorkerEndpointAllowed(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return false
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "siteinabox-exchange-worker" && url.port === "8081" && url.pathname === "/jobs")
  } catch { return false }
}

export class ExchangeWorkerError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(`Exchange worker failed (${code}, HTTP ${status}).`)
    this.name = "ExchangeWorkerError"
    this.code = code
    this.status = status
  }
}

export class ExchangeWorkerIndeterminateWriteError extends Error {
  readonly operation: ExchangeWorkerOperation

  constructor(operation: ExchangeWorkerOperation) {
    super(`Exchange worker ${operation} outcome is unknown; reconcile before retrying.`)
    this.name = "ExchangeWorkerIndeterminateWriteError"
    this.operation = operation
  }
}

export class ExchangeWorkerClient {
  readonly #endpoint: URL
  readonly #sharedSecret: string
  readonly #fetch: typeof fetch

  constructor(options: { endpoint: string; sharedSecret: string; fetchImpl?: typeof fetch }) {
    this.#endpoint = new URL(options.endpoint)
    this.#sharedSecret = options.sharedSecret.trim()
    this.#fetch = options.fetchImpl ?? fetch
    if (!exchangeWorkerEndpointAllowed(options.endpoint)) {
      throw new Error("Exchange worker endpoint requires HTTPS or the isolated Compose worker address.")
    }
    if (this.#sharedSecret.length < 32) {
      throw new Error("Exchange worker shared secret must be at least 32 characters.")
    }
  }

  async execute(request: ExchangeWorkerRequest): Promise<ExchangeWorkerResult> {
    if (!request.customerTenantId.trim() || !request.accessToken.trim()) {
      throw new Error("Exchange worker jobs require a customer tenant and Exchange access token.")
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.partnerUserPrincipalName)) throw new Error("The Exchange job requires the connected partner identity.")
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onmicrosoft\.com$/i.test(request.customerOrganizationDomain)) {
      throw new Error("Exchange worker jobs require the customer's initial .onmicrosoft.com domain.")
    }
    if (request.operation === "ensure_info_forward" && (!request.infoAddress || !request.forwardTo)) {
      throw new Error("The info forwarding job requires both mailbox addresses.")
    }
    if (request.operation === "ensure_info_shared" && (!request.infoAddress || !request.mailboxAddresses?.length || request.mailboxAddresses.length > 300)) throw new Error("Shared inbox requires members.")
    if (request.operation === "ensure_info_alias" && (!request.infoAddress || !request.targetAddress)) {
      throw new Error("The info alias job requires the alias and destination mailbox.")
    }
    if (request.operation === "verify_mailboxes" && (!request.mailboxAddresses?.length || request.mailboxAddresses.length > 300)) throw new Error("Mailbox verification requires 1–300 addresses.")
    let response: Response
    try {
      response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#sharedSecret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      })
    } catch {
      throw new ExchangeWorkerIndeterminateWriteError(request.operation)
    }
    let body: unknown = null
    try { body = await response.json() as unknown } catch { /* untrusted worker response */ }
    if (!response.ok) {
      if (response.status === 408 || response.status >= 500) {
        throw new ExchangeWorkerIndeterminateWriteError(request.operation)
      }
      const code = body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "worker_request_failed"
      throw new ExchangeWorkerError(code, response.status)
    }
    if (!body || typeof body !== "object" || !("completed" in body) || body.completed !== true || !("operation" in body) || body.operation !== request.operation) throw new ExchangeWorkerIndeterminateWriteError(request.operation)
    const result = body as Record<string, unknown>
    if (request.operation === "ensure_info_shared" && (result.sharedMailbox !== request.infoAddress || !Array.isArray(result.sharedMailboxMembers) || JSON.stringify([...result.sharedMailboxMembers].sort()) !== JSON.stringify([...(request.mailboxAddresses ?? [])].sort())) ||
      request.operation === "ensure_info_alias" && (result.alias !== request.infoAddress || result.aliasTarget !== request.targetAddress) ||
      request.operation === "ensure_info_forward" && (result.sharedMailbox !== request.infoAddress || result.forwardingAddress !== request.forwardTo) ||
      request.operation === "verify_mailboxes" && typeof result.mailboxesReady !== "boolean" ||
      request.operation === "verify_access" && result.accessVerified !== true ||
      request.operation === "enable_dkim" && !(result.dkimEnabled === true || result.dkimEnabled === false && result.dkimDnsReady === false) ||
      request.operation === "get_dkim_targets" && (!Array.isArray(result.dkimRecords) || result.dkimRecords.length !== 2 || !["selector1", "selector2"].every(selector =>
        (result.dkimRecords as unknown[]).some(value => value && typeof value === "object" && "selector" in value && value.selector === selector && "target" in value && typeof value.target === "string" && /^[a-z0-9_.-]{1,253}$/i.test(value.target))))) {
      throw new ExchangeWorkerIndeterminateWriteError(request.operation)
    }
    return body as ExchangeWorkerResult
  }

  async health(): Promise<ExchangeWorkerHealth> {
    const endpoint = new URL(this.#endpoint)
    endpoint.pathname = "/health"
    endpoint.search = ""
    let response: Response
    try {
      response = await this.#fetch(endpoint, {
        method: "GET",
        headers: { authorization: `Bearer ${this.#sharedSecret}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new ExchangeWorkerError("worker_unavailable", 0)
    }
    let body: unknown = null
    try { body = await response.json() as unknown } catch { /* untrusted worker response */ }
    if (!response.ok || !body || typeof body !== "object" || !("healthy" in body) || body.healthy !== true || !("protocolVersion" in body) || body.protocolVersion !== 1 || !("dnsToolAvailable" in body) || body.dnsToolAvailable !== true || !("moduleVersion" in body) || typeof body.moduleVersion !== "string") {
      throw new ExchangeWorkerError("worker_unhealthy", response.status)
    }
    return body as ExchangeWorkerHealth
  }
}
