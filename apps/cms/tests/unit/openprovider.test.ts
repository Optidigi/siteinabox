import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildOpenProviderDomainRegistrationRequest,
  buildOpenProviderCustomerRequest,
  checkOpenProviderDomainAvailability,
  checkOpenProviderDomainsAvailability,
  createOpenProviderCustomerHandle,
  findOpenProviderCustomerByReference,
  findOpenProviderDomain,
  loginOpenProvider,
  normalizeOpenProviderSuggestionResponse,
  OpenProviderIndeterminateWriteError,
  registerOpenProviderDomain,
  suggestOpenProviderDomains,
} from "@/lib/domains/openprovider"

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
})

const env = {
  OPENPROVIDER_API_BASE_URL: "https://openprovider.test/v1beta",
  OPENPROVIDER_USERNAME: "user",
  OPENPROVIDER_PASSWORD: "pass",
  OPENPROVIDER_OWNER_HANDLE: "OWNER",
  OPENPROVIDER_ADMIN_HANDLE: "ADMIN",
  OPENPROVIDER_TECH_HANDLE: "TECH",
  OPENPROVIDER_BILLING_HANDLE: "BILLING",
  OPENPROVIDER_NS_GROUP: "siab-default",
} as unknown as NodeJS.ProcessEnv

describe("OpenProvider adapter", () => {
  const registrant = {
    companyName: "Acme Studio",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "client@example.com",
    street: "Main Street",
    number: "10",
    suffix: null,
    zipcode: "1011AB",
    city: "Amsterdam",
    country: "NL",
    state: null,
    phoneCountryCode: "+31",
    phoneAreaCode: "20",
    phoneSubscriberNumber: "1234567",
    locale: "nl_NL",
  }

  it("logs in with server-side credentials and returns the bearer token", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { token: "token-123" } }))

    await expect(loginOpenProvider({ env, fetchImpl: fetchMock as typeof fetch })).resolves.toBe("token-123")

    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/auth/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "user", password: "pass" }),
    })
  })

  it("checks availability and exposes provider price details", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        results: [{
          domain: "example.nl",
          status: "free",
          price: { price: "8.50", currency: "EUR" },
        }],
      },
    }))

    await expect(checkOpenProviderDomainAvailability("Example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual({
      status: "available",
      domain: "example.nl",
      available: true,
      premium: false,
      price: { amount: "8.50", currency: "EUR" },
      internalReason: null,
    })

    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify({
        domains: [{ name: "example", extension: "nl" }],
        with_price: true,
      }),
    }))
  })

  it("batch checks multiple domains with one provider request", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        results: [
          {
            domain: "example.nl",
            status: "free",
            price: { price: "8.50", currency: "EUR" },
          },
          {
            domain: { name: "taken", extension: "nl" },
            status: "active",
          },
        ],
      },
    }))

    await expect(checkOpenProviderDomainsAvailability(["Example.nl", "taken.nl"], {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([
      {
        status: "available",
        domain: "example.nl",
        available: true,
        premium: false,
        price: { amount: "8.50", currency: "EUR" },
        internalReason: null,
      },
      {
        status: "unavailable",
        domain: "taken.nl",
        available: false,
        premium: false,
        price: null,
        internalReason: "domain_unavailable",
      },
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify({
        domains: [
          { name: "example", extension: "nl" },
          { name: "taken", extension: "nl" },
        ],
        with_price: true,
      }),
    }))
  })

  it("can check availability without requesting price details", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        results: [{ domain: "fast-check.nl", status: "free" }],
      },
    }))

    await expect(checkOpenProviderDomainAvailability("fast-check.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
      withPrice: false,
    })).resolves.toMatchObject({
      domain: "fast-check.nl",
      status: "available",
      price: null,
    })

    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify({
        domains: [{ name: "fast-check", extension: "nl" }],
        with_price: false,
      }),
    }))
  })

  it("batch availability logs in once when no token is supplied", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/auth/login")) return Response.json({ data: { token: "token-123" } })
      return Response.json({
        data: {
          results: [
            { domain: "one.nl", status: "free", price: { price: "8.50", currency: "EUR" } },
            { domain: "two.nl", status: "free", price: { price: "8.50", currency: "EUR" } },
          ],
        },
      })
    })

    await expect(checkOpenProviderDomainsAvailability(["one.nl", "two.nl"], {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toHaveLength(2)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://openprovider.test/v1beta/auth/login", expect.objectContaining({
      method: "POST",
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify({
        domains: [
          { name: "one", extension: "nl" },
          { name: "two", extension: "nl" },
        ],
        with_price: true,
      }),
    }))
  })

  it("reuses one process-local login for concurrent and later callers", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { token: "shared-token" } }))

    await expect(Promise.all([
      loginOpenProvider({ env, fetchImpl: fetchMock as typeof fetch }),
      loginOpenProvider({ env, fetchImpl: fetchMock as typeof fetch }),
    ])).resolves.toEqual(["shared-token", "shared-token"])
    await expect(loginOpenProvider({ env, fetchImpl: fetchMock as typeof fetch })).resolves.toBe("shared-token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/auth/login", expect.objectContaining({
      method: "POST",
    }))
  })

  it("refreshes the cached token once after an availability 401 and retries the read-only request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/auth/login")) {
        const loginCount = fetchMock.mock.calls.filter(([calledInput]) => String(calledInput).endsWith("/auth/login")).length
        return Response.json({ data: { token: loginCount === 1 ? "old-token" : "fresh-token" } })
      }
      if (url.endsWith("/domains/check") && init?.headers && JSON.stringify(init.headers).includes("old-token")) {
        return new Response("expired", { status: 401 })
      }
      return Response.json({
        data: {
          results: [{ domain: "refresh.nl", status: "free", price: { price: "8.50", currency: "EUR" } }],
        },
      })
    })

    await expect(checkOpenProviderDomainAvailability("refresh.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "refresh.nl",
      status: "available",
      price: { amount: "8.50", currency: "EUR" },
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://openprovider.test/v1beta/auth/login", expect.objectContaining({
      method: "POST",
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer old-token" }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://openprovider.test/v1beta/auth/login", expect.objectContaining({
      method: "POST",
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    }))
  })

  it("caches normalized availability results briefly and bypasses that cache for explicit tokens", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/auth/login")) return Response.json({ data: { token: "cache-token" } })
      return Response.json({
        data: {
          results: [{ domain: "cache.nl", status: "free", price: { price: "8.50", currency: "EUR" } }],
        },
      })
    })

    await expect(checkOpenProviderDomainsAvailability(["Cache.nl", "cache.nl"], {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([{
      status: "available",
      domain: "cache.nl",
      available: true,
      premium: false,
      price: { amount: "8.50", currency: "EUR" },
      internalReason: null,
    }])

    await expect(checkOpenProviderDomainAvailability("CACHE.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "cache.nl",
      status: "available",
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(checkOpenProviderDomainAvailability("cache.nl", {
      env,
      token: "explicit-token",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "cache.nl",
      status: "available",
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenLastCalledWith("https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer explicit-token" }),
    }))
  })

  it("keeps price and no-price availability cache entries separate", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/auth/login")) return Response.json({ data: { token: "split-cache-token" } })

      const body = typeof init?.body === "string"
        ? JSON.parse(init.body) as { with_price?: boolean }
        : {}
      return Response.json({
        data: {
          results: [{
            domain: "split-cache.nl",
            status: body.with_price === false ? "active" : "free",
            ...(body.with_price === false ? {} : { price: { price: "8.50", currency: "EUR" } }),
          }],
        },
      })
    })

    await expect(checkOpenProviderDomainAvailability("split-cache.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
      withPrice: false,
    })).resolves.toMatchObject({
      domain: "split-cache.nl",
      status: "unavailable",
      price: null,
    })

    await expect(checkOpenProviderDomainAvailability("split-cache.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "split-cache.nl",
      status: "available",
      price: { amount: "8.50", currency: "EUR" },
    })

    await expect(checkOpenProviderDomainAvailability("split-cache.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
      withPrice: false,
    })).resolves.toMatchObject({
      domain: "split-cache.nl",
      status: "unavailable",
      price: null,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      body: expect.stringContaining('"with_price":false'),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://openprovider.test/v1beta/domains/check", expect.objectContaining({
      body: expect.stringContaining('"with_price":true'),
    }))
  })

  it("scopes availability cache entries by account context", async () => {
    const alternateEnv = {
      ...env,
      OPENPROVIDER_USERNAME: "alternate-user",
      OPENPROVIDER_PASSWORD: "alternate-pass",
    } as unknown as NodeJS.ProcessEnv
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/auth/login")) {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { username?: string } : {}
        return Response.json({ data: { token: body.username === "alternate-user" ? "alternate-token" : "primary-token" } })
      }
      const headers = JSON.stringify(init?.headers)
      return Response.json({
        data: {
          results: [{
            domain: "scoped-cache.nl",
            status: headers.includes("alternate-token") ? "active" : "free",
          }],
        },
      })
    })

    await expect(checkOpenProviderDomainAvailability("scoped-cache.nl", {
      env,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "scoped-cache.nl",
      status: "available",
    })

    await expect(checkOpenProviderDomainAvailability("scoped-cache.nl", {
      env: alternateEnv,
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      domain: "scoped-cache.nl",
      status: "unavailable",
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("parses nested OpenProvider product price details", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        results: [{
          domain: "example.nl",
          status: "free",
          price: {
            product: {
              price: 8.06,
              currency: "EUR",
            },
          },
        }],
      },
    }))

    await expect(checkOpenProviderDomainAvailability("example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      status: "available",
      price: { amount: "8.06", currency: "EUR" },
    })
  })

  it("requests provider-backed domain suggestions for the same extension", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        results: [
          { name: "level-web.nl", domain: "level-web", tld: "nl" },
          { domain: { name: "levelonline", extension: "nl" } },
          "broken suggestion",
        ],
      },
    }))

    await expect(suggestOpenProviderDomains("levelweb.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
      limit: 4,
    })).resolves.toEqual([
      { domain: "level-web.nl", name: "level-web", extension: "nl" },
      { domain: "levelonline.nl", name: "levelonline", extension: "nl" },
    ])

    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/domains/suggest-name", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify({
        language: "dut",
        limit: 4,
        name: "levelweb",
        provider: "namestudio",
        sensitive: true,
        tlds: ["nl"],
      }),
    }))
  })

  it("normalizes suggestion responses from multiple provider shapes", () => {
    expect(normalizeOpenProviderSuggestionResponse({
      data: {
        suggestions: [
          { name: "acme-shop", extension: ".com" },
          { domain: "acme-online.com" },
          "acme-studio.com",
        ],
      },
    })).toEqual([
      { domain: "acme-shop.com", name: "acme-shop", extension: "com" },
      { domain: "acme-online.com", name: "acme-online", extension: "com" },
      { domain: "acme-studio.com", name: "acme-studio", extension: "com" },
    ])
  })

  it("maps unavailable, premium, and provider errors into integration-safe results", async () => {
    const unavailable = vi.fn(async () => Response.json({ data: { results: [{ status: "active" }] } }))
    await expect(checkOpenProviderDomainAvailability("taken.nl", {
      env,
      token: "token",
      fetchImpl: unavailable as typeof fetch,
    })).resolves.toMatchObject({
      status: "unavailable",
      available: false,
      internalReason: "domain_unavailable",
    })

    const premium = vi.fn(async () => Response.json({
      data: { results: [{ status: "premium", premium: { currency: "EUR", price: { create: "250.00" } } }] },
    }))
    await expect(checkOpenProviderDomainAvailability("premium.nl", {
      env,
      token: "token",
      fetchImpl: premium as typeof fetch,
    })).resolves.toMatchObject({
      status: "premium",
      premium: true,
      price: { amount: "250.00", currency: "EUR" },
      internalReason: "premium_domain",
    })

    const failed = vi.fn(async () => new Response("nope", { status: 503 }))
    await expect(checkOpenProviderDomainAvailability("broken.nl", {
      env,
      token: "token",
      fetchImpl: failed as typeof fetch,
    })).resolves.toMatchObject({
      status: "internal",
      internalReason: "provider_http_503",
    })
  })

  it("builds registration requests only when contact handles and DNS config are present", () => {
    expect(() => buildOpenProviderDomainRegistrationRequest("example.nl", {
      ...env,
      OPENPROVIDER_NS_GROUP: "",
      OPENPROVIDER_NAMESERVERS: "",
    } as unknown as NodeJS.ProcessEnv)).toThrow("OPENPROVIDER_NS_GROUP or OPENPROVIDER_NAMESERVERS")

    expect(buildOpenProviderDomainRegistrationRequest("example.nl", env)).toEqual({
      domain: { name: "example", extension: "nl" },
      period: 1,
      owner_handle: "OWNER",
      admin_handle: "ADMIN",
      tech_handle: "TECH",
      billing_handle: "BILLING",
      autorenew: "on",
      ns_group: "siab-default",
    })

    expect(buildOpenProviderDomainRegistrationRequest("example.nl", {
      ...env,
      OPENPROVIDER_NS_GROUP: "",
      OPENPROVIDER_NAMESERVERS: "ns1.example.nl, ns2.example.nl",
    } as unknown as NodeJS.ProcessEnv)).toMatchObject({
      name_servers: [{ name: "ns1.example.nl" }, { name: "ns2.example.nl" }],
    })
  })

  it("creates customer handles from checkout registrant details", async () => {
    expect(buildOpenProviderCustomerRequest(registrant)).toMatchObject({
      company_name: "Acme Studio",
      email: "client@example.com",
      name: { first_name: "Ada", last_name: "Lovelace" },
      address: {
        street: "Main Street",
        number: "10",
        zipcode: "1011AB",
        city: "Amsterdam",
        country: "NL",
      },
      phone: {
        country_code: "+31",
        area_code: "20",
        subscriber_number: "1234567",
      },
    })
    const fetchMock = vi.fn(async () => Response.json({ data: { handle: "OWNER-CLIENT" } }))
    await expect(createOpenProviderCustomerHandle(registrant, {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual({ handle: "OWNER-CLIENT", raw: { data: { handle: "OWNER-CLIENT" } } })
    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/customers", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
    }))
  })

  it("executes domain registration with a configured request body", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { id: 42 } }))

    await expect(registerOpenProviderDomain("example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: 42,
      domain: "example.nl",
      status: "registered",
    })

    expect(fetchMock).toHaveBeenCalledWith("https://openprovider.test/v1beta/domains", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      body: JSON.stringify(buildOpenProviderDomainRegistrationRequest("example.nl", env)),
    }))
  })

  it("reconciles domain ownership, nameservers, and registrant verification by full name", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      code: 0,
      data: {
        results: [{
          id: 9001,
          domain: { name: "example", extension: "nl" },
          status: "ACT",
          owner_handle: "OWNER-CLIENT",
          admin_handle: "ADMIN",
          name_servers: [
            { name: "ada.ns.cloudflare.com" },
            { name: "bob.ns.cloudflare.com" },
          ],
          renewal_date: "2027-07-26 00:00:00",
          verification_email_status: "verified",
          verification_email_status_description: "Registrant email verified",
        }],
      },
    }))

    await expect(findOpenProviderDomain("Example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({
      id: 9001,
      domain: "example.nl",
      status: "ACT",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "ADMIN",
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      verificationEmailStatus: "verified",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openprovider.test/v1beta/domains?full_name=example.nl&with_verification_email=true&limit=2",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("finds the customer handle through the persisted provisioning reference", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      code: 0,
      data: {
        results: [{
          handle: "OWNER-CLIENT",
          comments: "domain-registration:order:600:v1",
        }],
      },
    }))

    await expect(findOpenProviderCustomerByReference("domain-registration:order:600:v1", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toMatchObject({ handle: "OWNER-CLIENT" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openprovider.test/v1beta/customers?comment_pattern=domain-registration%3Aorder%3A600%3Av1&limit=2",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("classifies a registration transport timeout as indeterminate", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("socket closed")
    })

    await expect(registerOpenProviderDomain("example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "ADMIN",
      nameServers: [{ name: "ada.ns.cloudflare.com" }],
      nsGroup: null,
      reference: "domain-registration:order:600:v1",
    })).rejects.toBeInstanceOf(OpenProviderIndeterminateWriteError)
  })

  it("classifies a malformed successful registration response as indeterminate", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>upstream truncated</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }))

    await expect(registerOpenProviderDomain("example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "ADMIN",
      nameServers: [{ name: "ada.ns.cloudflare.com" }],
      nsGroup: null,
      reference: "domain-registration:order:600:v1",
    })).rejects.toBeInstanceOf(OpenProviderIndeterminateWriteError)
  })

  it("classifies a successful registration response without a provider id as indeterminate", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      code: 0,
      data: { status: "ACT" },
    }))

    await expect(registerOpenProviderDomain("example.nl", {
      env,
      token: "token-123",
      fetchImpl: fetchMock as typeof fetch,
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "ADMIN",
      nameServers: [{ name: "ada.ns.cloudflare.com" }],
      nsGroup: null,
      reference: "domain-registration:order:600:v1",
    })).rejects.toBeInstanceOf(OpenProviderIndeterminateWriteError)
  })
})
