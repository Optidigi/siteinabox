import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildOpenProviderDomainRegistrationRequest,
  buildOpenProviderCustomerRequest,
  checkOpenProviderDomainAvailability,
  createOpenProviderCustomerHandle,
  loginOpenProvider,
  registerOpenProviderDomain,
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
      data: { results: [{ status: "premium", price: { amount: "250.00", currency: "EUR" } }] },
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
})
