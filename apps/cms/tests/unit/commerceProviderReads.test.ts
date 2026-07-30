import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getOpenProviderDomainAuthCode,
  getOpenProviderResellerBalance,
} from "@/lib/domains/openprovider"
import {
  inspectMollieProfileCapabilities,
  listRecentMollieCustomers,
  listRecentMolliePayments,
} from "@/lib/payments/mollieAdapter"

describe("Phase 11 provider read contracts", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("reads only the external Openprovider transfer code and reseller balance", async () => {
    const fetchImpl = vi.fn(async (
      input: string | URL | Request,
      _init?: RequestInit,
    ) => {
      const url = String(input)
      if (url.endsWith("/domains/9001/authcode?auth_code_type=external")) {
        return Response.json({
          data: { auth_code: "epp-code", type: "external", success: true },
        })
      }
      if (url.endsWith("/resellers?with_settings=true")) {
        return Response.json({
          data: {
            balance: 125.5,
            reserved_balance: 20,
            settings: { currency: "eur" },
            contacts: [{ email: "must-not-be-returned@example.com" }],
          },
        })
      }
      throw new Error(`Unexpected provider read ${url}`)
    })
    const options = {
      token: "test-token",
      fetchImpl,
      env: {
        OPENPROVIDER_API_BASE_URL: "https://openprovider.sandbox.test/v1beta",
      } as unknown as NodeJS.ProcessEnv,
    }

    await expect(getOpenProviderDomainAuthCode("9001", options))
      .resolves.toEqual({
        delivery: "provider_returned",
        authCode: "epp-code",
      })
    await expect(getOpenProviderResellerBalance(options)).resolves.toEqual({
      availableAmount: 125.5,
      reservedAmount: 20,
      currency: "EUR",
    })
  })

  it("persists the provider signal when the registry sends the auth code to the registrant", async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      data: { auth_code: "", type: "external", success: true },
    }))
    await expect(getOpenProviderDomainAuthCode("9002", {
      token: "test-token",
      fetchImpl,
      env: {
        OPENPROVIDER_API_BASE_URL: "https://openprovider.sandbox.test/v1beta",
      } as unknown as NodeJS.ProcessEnv,
    })).resolves.toEqual({ delivery: "registrant_email" })
  })

  it("lists recent Mollie payments for indeterminate-write recovery", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_key")
    const fetchImpl = vi.fn(async () => Response.json({
      _embedded: {
        payments: [{ id: "tr_1", status: "paid" }],
      },
    }))
    vi.stubGlobal("fetch", fetchImpl)

    await expect(listRecentMolliePayments(250)).resolves.toEqual([
      { id: "tr_1", status: "paid" },
    ])
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.mollie.com/v2/payments?limit=250&sort=desc",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test_key",
        }),
      }),
    )
  })

  it("inspects the current Mollie profile and enabled payment sequences with GET only", async () => {
    const fetchImpl = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(init?.method).toBe("GET")
      const url = String(input)
      if (url.endsWith("/profiles/me")) {
        return Response.json({ id: "pfl_fixture" })
      }
      if (
        url.endsWith("/methods?sequenceType=first") ||
        url.endsWith("/methods?sequenceType=recurring")
      ) {
        return Response.json({
          _embedded: { methods: [{ id: "ideal" }] },
        })
      }
      throw new Error(`Unexpected Mollie read ${url}`)
    })

    await expect(inspectMollieProfileCapabilities({
      env: {
        MOLLIE_API_KEY: "live_fixture",
      } as unknown as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls.every(([, init]) => init?.method === "GET"))
      .toBe(true)
  })

  it("paginates missing-webhook recovery without forwarding credentials off-origin", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_key")
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({
        _embedded: { payments: [{ id: "tr_2", status: "open" }] },
        _links: {
          next: {
            href: "https://api.mollie.com/v2/payments?limit=250&from=tr_2",
          },
        },
      }))
      .mockResolvedValueOnce(Response.json({
        _embedded: { payments: [{ id: "tr_1", status: "paid" }] },
      }))
    vi.stubGlobal("fetch", fetchImpl)

    await expect(listRecentMolliePayments(250)).resolves.toEqual([
      { id: "tr_2", status: "open" },
      { id: "tr_1", status: "paid" },
    ])

    fetchImpl.mockReset()
    fetchImpl.mockResolvedValueOnce(Response.json({
      _embedded: { payments: [] },
      _links: { next: { href: "https://attacker.example/v2/payments" } },
    }))
    await expect(listRecentMolliePayments(250))
      .rejects.toThrow("untrusted next URL")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("rejects an off-origin Mollie customer pagination link", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "test_key")
    const fetchImpl = vi.fn(async () => Response.json({
      _embedded: { customers: [] },
      _links: { next: { href: "https://attacker.example/v2/customers" } },
    }))
    vi.stubGlobal("fetch", fetchImpl)

    await expect(listRecentMollieCustomers(250))
      .rejects.toThrow("untrusted next URL")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
