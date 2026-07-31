type ProviderCall<Operation extends string> = {
  operation: Operation
  method: string
  url: string
  body: unknown
}

type ProviderRouterOptions<Operation extends string> = {
  classify: (method: string, url: URL) => Operation | undefined
  perform: (
    operation: Operation,
    request: { method: string; url: URL; body: unknown },
  ) => Response | Promise<Response>
}

const requestBody = async (init: RequestInit | undefined): Promise<unknown> => {
  if (init?.body == null) return undefined
  const value = String(init.body)
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

const failure = (provider: string, operation: string) => Response.json({
  error: {
    code: "mock_operation_not_enabled",
    message: `${provider} mock operation ${operation} requires explicit opt-in.`,
  },
}, { status: 503 })

const createProviderRouter = <Operation extends string>(
  provider: string,
  options: ProviderRouterOptions<Operation>,
) => {
  const enabled = new Set<Operation>()
  const lostResponses = new Set<Operation>()
  const calls: ProviderCall<Operation>[] = []

  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(typeof input === "string" || input instanceof URL
      ? input
      : input.url)
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET"))
      .toUpperCase()
    const operation = options.classify(method, url)
    if (!operation) {
      return failure(provider, `unmatched:${method}:${url.pathname}`)
    }
    const body = await requestBody(init)
    calls.push({ operation, method, url: url.toString(), body })
    if (!enabled.has(operation)) return failure(provider, operation)
    const response = await options.perform(operation, { method, url, body })
    if (lostResponses.delete(operation)) {
      throw new TypeError(`${provider} mock lost the ${operation} response`)
    }
    return response
  }

  return {
    calls,
    fetch: fetch as typeof globalThis.fetch,
    allow(...operations: Operation[]) {
      for (const operation of operations) enabled.add(operation)
    },
    disallow(...operations: Operation[]) {
      for (const operation of operations) enabled.delete(operation)
    },
    loseNextResponse(operation: Operation) {
      lostResponses.add(operation)
    },
    operationCount(operation: Operation) {
      return calls.filter((call) => call.operation === operation).length
    },
  }
}

export type MollieMockOperation =
  | "create_customer"
  | "list_customers"
  | "create_payment"
  | "list_payments"
  | "read_payment"
  | "create_refund"
  | "read_refund"

export const createMollieMockRouter = () => {
  let customerSequence = 1
  let paymentSequence = 1
  let refundSequence = 1
  const customers = new Map<string, Record<string, unknown>>()
  const payments = new Map<string, Record<string, unknown>>()
  const refunds = new Map<string, Record<string, unknown>>()

  const router = createProviderRouter<MollieMockOperation>("Mollie", {
    classify(method, url) {
      if (method === "POST" && url.pathname === "/v2/customers") return "create_customer"
      if (method === "GET" && url.pathname === "/v2/customers") return "list_customers"
      if (method === "POST" && url.pathname === "/v2/payments") return "create_payment"
      if (method === "GET" && url.pathname === "/v2/payments") return "list_payments"
      if (method === "GET" && /^\/v2\/payments\/[^/]+$/.test(url.pathname)) {
        return "read_payment"
      }
      if (method === "POST" && /^\/v2\/payments\/[^/]+\/refunds$/.test(url.pathname)) {
        return "create_refund"
      }
      if (method === "GET" && /\/refunds\/[^/]+$/.test(url.pathname)) return "read_refund"
      return undefined
    },
    perform(operation, request) {
      const body = request.body && typeof request.body === "object"
        ? request.body as Record<string, unknown>
        : {}
      if (operation === "create_customer") {
        const id = `cst_mock_${customerSequence++}`
        const customer = { id, ...body }
        customers.set(id, customer)
        return Response.json(customer, { status: 201 })
      }
      if (operation === "list_customers") {
        return Response.json({ count: customers.size, _embedded: { customers: [...customers.values()] } })
      }
      if (operation === "create_payment") {
        const id = `tr_mock_${paymentSequence++}`
        const payment = {
          id,
          status: "open",
          ...body,
          _links: { checkout: { href: `https://mollie.test/checkout/${id}` } },
        }
        payments.set(id, payment)
        return Response.json(payment, { status: 201 })
      }
      if (operation === "list_payments") {
        return Response.json({ count: payments.size, _embedded: { payments: [...payments.values()] } })
      }
      if (operation === "read_payment") {
        const id = request.url.pathname.split("/").at(-1) ?? ""
        const payment = payments.get(id)
        return payment ? Response.json(payment) : Response.json({ status: 404 }, { status: 404 })
      }
      if (operation === "create_refund") {
        const id = `re_mock_${refundSequence++}`
        const paymentId = request.url.pathname.split("/").at(-2)
        const refund = { id, paymentId, status: "pending", ...body }
        refunds.set(id, refund)
        return Response.json(refund, { status: 201 })
      }
      const id = request.url.pathname.split("/").at(-1) ?? ""
      const refund = refunds.get(id)
      return refund ? Response.json(refund) : Response.json({ status: 404 }, { status: 404 })
    },
  })

  return { ...router, state: { customers, payments, refunds } }
}

export type OpenProviderMockOperation =
  | "login"
  | "create_customer"
  | "search_customers"
  | "create_domain"
  | "search_domains"
  | "read_domain"
  | "transfer_domain"
  | "update_nameservers"
  | "set_autorenew"

export const createOpenProviderMockRouter = () => {
  let customerSequence = 1
  let domainSequence = 9_001
  const customers = new Map<string, Record<string, unknown>>()
  const domains = new Map<string, Record<string, unknown>>()

  const router = createProviderRouter<OpenProviderMockOperation>("OpenProvider", {
    classify(method, url) {
      if (method === "POST" && url.pathname.endsWith("/auth/login")) return "login"
      if (method === "POST" && url.pathname.endsWith("/customers")) return "create_customer"
      if (method === "GET" && url.pathname.endsWith("/customers")) return "search_customers"
      if (method === "POST" && url.pathname.endsWith("/domains/transfer")) return "transfer_domain"
      if (method === "POST" && url.pathname.endsWith("/domains")) return "create_domain"
      if (method === "GET" && url.pathname.endsWith("/domains")) return "search_domains"
      if (method === "GET" && /\/domains\/[^/]+$/.test(url.pathname)) return "read_domain"
      if (method === "PUT" && url.pathname.endsWith("/autorenew")) return "set_autorenew"
      if (method === "PUT" && url.pathname.endsWith("/nameservers")) return "update_nameservers"
      return undefined
    },
    perform(operation, request) {
      const body = request.body && typeof request.body === "object"
        ? request.body as Record<string, unknown>
        : {}
      if (operation === "login") return Response.json({ data: { token: "mock-token" } })
      if (operation === "create_customer") {
        const handle = `OWNER-MOCK-${customerSequence++}`
        const customer = { handle, ...body }
        customers.set(handle, customer)
        return Response.json({ data: customer })
      }
      if (operation === "search_customers") {
        return Response.json({ data: { results: [...customers.values()] } })
      }
      if (operation === "create_domain" || operation === "transfer_domain") {
        const id = String(domainSequence++)
        const domain = {
          id,
          status: operation === "transfer_domain" ? "PENDING" : "ACT",
          ...body,
        }
        domains.set(id, domain)
        return Response.json({ data: domain })
      }
      if (operation === "search_domains") {
        return Response.json({ data: { results: [...domains.values()] } })
      }
      const segments = request.url.pathname.split("/")
      const id = segments.at(operation === "read_domain" ? -1 : -2) ?? ""
      const domain = domains.get(id)
      if (!domain) return Response.json({ code: 404 }, { status: 404 })
      if (operation === "set_autorenew") domain.autorenew = body.autorenew ?? "on"
      if (operation === "update_nameservers") domain.nameServers = body.nameServers ?? []
      return Response.json({ data: domain })
    },
  })

  return { ...router, state: { customers, domains } }
}

export type CloudflareMockOperation =
  | "list_zones"
  | "create_zone"
  | "list_records"
  | "create_record"
  | "read_dnssec"
  | "update_dnssec"

export const createCloudflareMockRouter = () => {
  let zoneSequence = 1
  let recordSequence = 1
  const zones = new Map<string, Record<string, unknown>>()
  const records = new Map<string, Map<string, Record<string, unknown>>>()

  const router = createProviderRouter<CloudflareMockOperation>("Cloudflare", {
    classify(method, url) {
      if (method === "GET" && url.pathname.endsWith("/zones")) return "list_zones"
      if (method === "POST" && url.pathname.endsWith("/zones")) return "create_zone"
      if (method === "GET" && url.pathname.endsWith("/dns_records")) return "list_records"
      if (method === "POST" && url.pathname.endsWith("/dns_records")) return "create_record"
      if (method === "GET" && url.pathname.endsWith("/dnssec")) return "read_dnssec"
      if ((method === "POST" || method === "PATCH") && url.pathname.endsWith("/dnssec")) {
        return "update_dnssec"
      }
      return undefined
    },
    perform(operation, request) {
      const body = request.body && typeof request.body === "object"
        ? request.body as Record<string, unknown>
        : {}
      if (operation === "list_zones") {
        return Response.json({ success: true, result: [...zones.values()] })
      }
      if (operation === "create_zone") {
        const id = `zone_mock_${zoneSequence++}`
        const zone = { id, status: "pending", ...body }
        zones.set(id, zone)
        records.set(id, new Map())
        return Response.json({ success: true, result: zone }, { status: 200 })
      }
      const zoneId = request.url.pathname.match(/\/zones\/([^/]+)/)?.[1] ?? ""
      if (operation === "list_records") {
        return Response.json({
          success: true,
          result: [...(records.get(zoneId)?.values() ?? [])],
        })
      }
      if (operation === "create_record") {
        const id = `record_mock_${recordSequence++}`
        const record = { id, ...body }
        const zoneRecords = records.get(zoneId) ?? new Map()
        zoneRecords.set(id, record)
        records.set(zoneId, zoneRecords)
        return Response.json({ success: true, result: record })
      }
      const zone = zones.get(zoneId)
      if (!zone) return Response.json({ success: false }, { status: 404 })
      if (operation === "update_dnssec") zone.dnssec = { status: "pending", ...body }
      return Response.json({
        success: true,
        result: zone.dnssec ?? { status: "disabled" },
      })
    },
  })

  return { ...router, state: { zones, records } }
}
