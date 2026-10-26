import "server-only"
import type { MailDnsChange, MailDnsRecord, MailDnsWriteRecord } from "./dns.ts"

export type CloudflareMailZone = {
  id: string
  name: string
  status: string
}

export type CloudflareEmailRoutingRule = {
  enabled: boolean
  matchers: Array<{ type: "all" | "literal"; field?: string; value?: string }>
  actions: Array<{ type: "drop" | "forward" | "worker"; value?: string[] }>
}

export class CloudflareMailDnsError extends Error {
  readonly operation: string
  readonly status: number

  constructor(operation: string, status: number) {
    super(`Cloudflare ${operation} failed with HTTP ${status}.`)
    this.name = "CloudflareMailDnsError"
    this.operation = operation
    this.status = status
  }
}

export class CloudflareMailDnsIndeterminateError extends Error {
  readonly operation: string

  constructor(operation: string) {
    super(`Cloudflare ${operation} has an indeterminate outcome; reconcile DNS before retrying.`)
    this.name = "CloudflareMailDnsIndeterminateError"
    this.operation = operation
  }
}

export type CloudflareMailDnsClientOptions = {
  token: string
  accountId: string
  fetchImpl?: typeof fetch
  apiBase?: string
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const array = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(object) : []

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

const normalizeDomain = (value: string) => value.trim().toLowerCase().replace(/\.$/, "")

export class CloudflareMailDnsClient {
  readonly #token: string
  readonly #accountId: string
  readonly #fetch: typeof fetch
  readonly #apiBase: string

  constructor(options: CloudflareMailDnsClientOptions) {
    this.#token = options.token.trim()
    this.#accountId = options.accountId.trim()
    this.#fetch = options.fetchImpl ?? fetch
    this.#apiBase = (options.apiBase ?? "https://api.cloudflare.com/client/v4").replace(/\/+$/, "")
    if (!this.#token || !this.#accountId) throw new Error("Cloudflare mail DNS credentials are not configured.")
  }

  async findZone(domainInput: string): Promise<CloudflareMailZone | null> {
    const domain = normalizeDomain(domainInput)
    const query = new URLSearchParams({ "account.id": this.#accountId, name: domain, match: "all", per_page: "5" })
    const body = await this.#read("zone lookup", `/zones?${query}`)
    const matches = array(object(body).result).filter((record) =>
      typeof record.name === "string" && normalizeDomain(record.name) === domain)
    if (matches.length > 1) throw new CloudflareMailDnsError("ambiguous exact zone lookup", 409)
    const result = matches[0]
    if (!result || typeof result.id !== "string" || typeof result.name !== "string") return null
    return { id: result.id, name: normalizeDomain(result.name), status: String(result.status ?? "unknown") }
  }

  async listDnsRecords(zoneId: string): Promise<MailDnsRecord[]> {
    const records: MailDnsRecord[] = []
    let page = 1
    let expectedPages: number | null = null
    while (true) {
      const query = new URLSearchParams({ per_page: "500", page: String(page) })
      const body = await this.#read("DNS record list", `/zones/${encodeURIComponent(zoneId)}/dns_records?${query}`)
      const result = object(body)
      for (const record of array(result.result)) {
        const type = record.type
        if (type !== "MX" && type !== "TXT" && type !== "CNAME") continue
        if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.content !== "string") continue
        records.push({
          id: record.id,
          type,
          name: normalizeDomain(record.name),
          content: record.content,
          ...(Number.isSafeInteger(record.priority) ? { priority: Number(record.priority) } : {}),
          proxied: record.proxied === true,
        })
      }
      const info = object(result.result_info)
      const pageCount = Number(info.total_pages)
      if (Number.isSafeInteger(pageCount) && pageCount >= 1) {
        if (expectedPages != null && expectedPages !== pageCount) {
          throw new CloudflareMailDnsError("DNS record pagination changed", 409)
        }
        expectedPages = pageCount
        if (page >= pageCount) break
      } else if (array(result.result).length < 500) {
        break
      }
      page += 1
      if (page > 1000) throw new CloudflareMailDnsError("DNS record pagination limit", 400)
    }
    return records
  }

  async listEmailRoutingRules(zoneId: string): Promise<CloudflareEmailRoutingRule[]> {
    const endpoint = `/zones/${encodeURIComponent(zoneId)}/email/routing/rules`
    const read = (path: string) => this.#read("Email Routing rules read", path).catch(error => {
      if (error instanceof CloudflareMailDnsError && error.status === 404) return { result: [] }
      throw error
    })
    const raw: Record<string, unknown>[] = []
    for (let page = 1; page <= 500; page++) {
      const body = object(await read(`${endpoint}?per_page=50&page=${page}`))
      raw.push(...array(body.result))
      const pages = Number(object(body.result_info).total_pages ?? 1)
      if (page >= pages) break
      if (page === 500) throw new CloudflareMailDnsError("Email Routing pagination limit", 422)
    }
    const catchAll = object(object(await read(`${endpoint}/catch_all`)).result)
    if (catchAll.enabled === true) raw.push(catchAll)
    return raw.map(record => {
      const enabled = record.enabled === true
      const matchers = array(record.matchers)
      const actions = array(record.actions)
      if (enabled && (matchers.some(value => value.type !== "all" && value.type !== "literal") || actions.some(value => !["drop", "forward", "worker"].includes(String(value.type))))) {
        throw new CloudflareMailDnsError("Unsupported existing Email Routing rule", 422)
      }
      return { enabled,
        matchers: matchers.map(matcher => ({ type: matcher.type as "all" | "literal", field: typeof matcher.field === "string" ? matcher.field : undefined, value: typeof matcher.value === "string" ? matcher.value : undefined })),
        actions: actions.map(action => ({ type: action.type as "drop" | "forward" | "worker", value: Array.isArray(action.value) ? action.value.filter((value): value is string => typeof value === "string") : undefined })),
      }
    })
  }

  async applyChanges(zoneId: string, changes: readonly MailDnsChange[]): Promise<void> {
    for (const change of changes) {
      if (change.action === "keep") continue
      if (change.action === "delete") {
        await this.#write("DNS record deletion", "DELETE", `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(change.id)}`)
        continue
      }
      const record = this.#body(change.record)
      if (change.action === "create") {
        await this.#write("DNS record creation", "POST", `/zones/${encodeURIComponent(zoneId)}/dns_records`, record)
      } else {
        await this.#write("DNS record update", "PUT", `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(change.id)}`, record)
      }
    }
  }

  #body(record: MailDnsWriteRecord) {
    return {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: 1,
      proxied: false,
      ...(record.priority == null ? {} : { priority: record.priority }),
    }
  }

  async #read(operation: string, path: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.#fetch(`${this.#apiBase}${path}`, { method: "GET", headers: this.#headers() })
    } catch {
      throw new CloudflareMailDnsError(operation, 0)
    }
    const body = await parseJson(response)
    if (!response.ok || object(body).success === false) throw new CloudflareMailDnsError(operation, response.status)
    return body
  }

  async #write(operation: string, method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<void> {
    let response: Response
    try {
      response = await this.#fetch(`${this.#apiBase}${path}`, {
        method,
        headers: this.#headers(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      throw new CloudflareMailDnsIndeterminateError(operation)
    }
    const parsed = await parseJson(response)
    if (!response.ok || object(parsed).success === false) {
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw new CloudflareMailDnsIndeterminateError(operation)
      }
      throw new CloudflareMailDnsError(operation, response.status)
    }
  }

  #headers(): Record<string, string> {
    return { authorization: `Bearer ${this.#token}`, accept: "application/json", "content-type": "application/json" }
  }
}
