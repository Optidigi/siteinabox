import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  get: vi.fn(async () => new Response(null, { status: 204 })),
  post: vi.fn(async () => new Response(null, { status: 204 })),
  isAllowedHost: vi.fn(async () => true),
}))

vi.mock("@/lib/betterAuth", () => ({ auth: {} }))

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: mocks.get,
    POST: mocks.post,
  }),
}))

vi.mock("@/lib/socialAuth/hosts", () => ({
  isAllowedSocialAuthHost: mocks.isAllowedHost,
  buildCmsAuthRequest: (request: Request) => request,
}))

describe("social auth route callback evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-id")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret")
    vi.stubEnv("SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS", "")
  })

  it("rejects crafted social initiation and callback on an unregistered host", async () => {
    const route = await import("@/app/api/auth/[...all]/route")
    const post = await route.POST(new Request(
      "https://admin.client.nl/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          host: "admin.client.nl",
          "content-type": "application/json",
        },
        body: JSON.stringify({ provider: "google" }),
      },
    ))
    const get = await route.GET(new Request(
      "https://admin.client.nl/api/auth/callback/google?code=opaque",
      { headers: { host: "admin.client.nl" } },
    ))

    expect(post.status).toBe(404)
    expect(get.status).toBe(404)
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it("allows only the exact provider and callback host with evidence", async () => {
    vi.stubEnv(
      "SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS",
      "admin.siteinabox.nl,admin.client.nl",
    )
    const route = await import("@/app/api/auth/[...all]/route")
    const response = await route.POST(new Request(
      "https://admin.client.nl/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          host: "admin.client.nl",
          "content-type": "application/json",
        },
        body: JSON.stringify({ provider: "google" }),
      },
    ))

    expect(response.status).toBe(204)
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it("rejects a forwarded-host mismatch instead of trusting it as callback evidence", async () => {
    vi.stubEnv(
      "SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS",
      "admin.attacker.example",
    )
    const route = await import("@/app/api/auth/[...all]/route")
    const response = await route.POST(new Request(
      "https://admin.client.nl/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          host: "admin.client.nl",
          "x-forwarded-host": "admin.attacker.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ provider: "google" }),
      },
    ))

    expect(response.status).toBe(404)
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it("keeps magic-link initiation available on valid tenant hosts", async () => {
    const route = await import("@/app/api/auth/[...all]/route")
    const response = await route.POST(new Request(
      "https://admin.client.nl/api/auth/sign-in/magic-link",
      {
        method: "POST",
        headers: {
          host: "admin.client.nl",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "owner@example.test" }),
      },
    ))

    expect(response.status).toBe(204)
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })
})
