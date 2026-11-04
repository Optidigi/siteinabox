import "server-only"

export { MAIL_BOOTSTRAP_PROTOCOL, createMailBootstrapJob, type MailBootstrapInput, type MailBootstrapJob, type MailBootstrapReceipt } from "@siteinabox/contracts/microsoft-mail-authority"
import { MAIL_BOOTSTRAP_PROTOCOL, type MailBootstrapJob, type MailBootstrapReceipt } from "@siteinabox/contracts/microsoft-mail-authority"

export function bootstrapEndpointAllowed(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" }
  catch { return false }
}

/** Private worker protocol, not a Microsoft/Pax8 API. PUT retries must reconcile the same durable job. */
export class ManagedMailBootstrapClient {
  readonly #endpoint: string
  readonly #secret: string
  readonly #fetch: typeof fetch
  readonly #identity: {applicationId: string; partnerTenantId: string; groupId: string} | null
  constructor(input: { endpoint: string; secret: string; fetchImpl?: typeof fetch; identity?: {applicationId: string; partnerTenantId: string; groupId: string} }) {
    if (!bootstrapEndpointAllowed(input.endpoint) || input.secret.trim().length < 32) throw new Error("MAIL_BOOTSTRAP_CONFIGURATION_INVALID")
    this.#endpoint = new URL(input.endpoint).origin
    this.#secret = input.secret.trim()
    this.#fetch = input.fetchImpl ?? fetch
    this.#identity = input.identity ?? null
  }
  async ready(): Promise<boolean> {
    const identity = this.#identity
    if (!identity) return false
    try {
      const { response, body } = await this.#request("GET", "/health")
      return response.ok && body.protocol === MAIL_BOOTSTRAP_PROTOCOL && body.unattended === true && body.qualified === true && Object.entries(identity).every(([key, expected]) => {const actual = body[key]; return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase()})
    } catch { return false }
  }
  async advance(job: MailBootstrapJob): Promise<MailBootstrapReceipt> {
    const { response, body } = await this.#request("PUT", `/jobs/${job.id}`, job)
    if (!response.ok) {
      if ([401,403,422].includes(response.status)) return { phase: "blocked" }
      throw new Error("MAIL_BOOTSTRAP_OUTCOME_UNKNOWN")
    }
    if (body.protocol !== MAIL_BOOTSTRAP_PROTOCOL || body.jobId !== job.id || body.binding !== job.binding) throw new Error("MAIL_BOOTSTRAP_RESPONSE_INVALID")
    if (body.phase === "pending" || body.phase === "blocked" || body.phase === "uncertain") return { phase: body.phase }
    if (body.phase === "complete" && body.relationshipId === job.targetRelationshipId && typeof body.relationshipId === "string" && /^[a-z0-9-]{1,160}$/i.test(body.relationshipId)) return { phase: "complete", relationshipId: body.relationshipId }
    throw new Error("MAIL_BOOTSTRAP_RESPONSE_INVALID")
  }
  async #request(method: "GET" | "PUT", path: string, job?: MailBootstrapJob) {
    try {
      const response = await this.#fetch(`${this.#endpoint}${path}`, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${this.#secret}`, ...(job ? { "content-type": "application/json" } : {}) }, ...(job ? { body: JSON.stringify(job) } : {}) })
      const value: unknown = await response.json()
      const body: Record<string, unknown> = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
      return { response, body }
    } catch { throw new Error("MAIL_BOOTSTRAP_OUTCOME_UNKNOWN") }
  }
}

/** Configuration is deliberately insufficient without the separately reviewed live proof marker. */
export function requireManagedMailBootstrap(env: Readonly<Record<string, string | undefined>> = process.env): ManagedMailBootstrapClient {
  const endpoint = env["MICROSOFT_MAIL_BOOTSTRAP_WORKER_URL"] ?? ""
  const secret = env["MICROSOFT_MAIL_BOOTSTRAP_WORKER_SECRET"] ?? ""
  if (env["MICROSOFT_MAIL_AUTHORITY_QUALIFIED"] !== "managed-admin-v1" || !bootstrapEndpointAllowed(endpoint) || secret.trim().length < 32) throw new Error("MAIL_BOOTSTRAP_NOT_QUALIFIED")
  const identity = {applicationId:env.MICROSOFT_PARTNER_APP_CLIENT_ID ?? "",partnerTenantId:env.MICROSOFT_PARTNER_TENANT_ID ?? "",groupId:env.MICROSOFT_PARTNER_SECURITY_GROUP_ID ?? ""}
  if (Object.values(identity).some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) throw new Error("MAIL_BOOTSTRAP_NOT_QUALIFIED")
  return new ManagedMailBootstrapClient({ endpoint, secret, identity })
}
