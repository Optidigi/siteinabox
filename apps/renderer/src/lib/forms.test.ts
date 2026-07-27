import assert from "node:assert/strict"
import test from "node:test"
import { fixturePublishedSiteSnapshot } from "../fixtures/published-site"
import { GET, POST } from "../pages/api/forms"

type CapturedFormsRequest = {
  body: Record<string, unknown>
  headers: Headers
}

const cmsUrl = "https://cms.example.test"

function snapshotForTest() {
  const snapshot = structuredClone(fixturePublishedSiteSnapshot)
  return {
    ...snapshot,
    tenantId: "tenant-from-snapshot",
    domain: "ami-care.nl",
    siteUrl: "https://ami-care.nl",
    manifest: {
      ...snapshot.manifest,
      tenantId: "tenant-from-snapshot",
    },
    settings: {
      ...snapshot.settings,
      siteUrl: "https://ami-care.nl",
    },
  }
}

function installFetchStub({
  snapshot = snapshotForTest(),
  formsStatus = 201,
}: {
  snapshot?: unknown | null
  formsStatus?: number
} = {}) {
  const previousFetch = globalThis.fetch
  const capturedFormsRequests: CapturedFormsRequest[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === "/api/renderer/snapshot") {
      if (!snapshot) {
        return Response.json({ error: "unknown_host" }, { status: 404 })
      }
      return Response.json({ snapshot })
    }

    if (url.pathname === "/api/forms") {
      capturedFormsRequests.push({
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        headers: new Headers(init?.headers),
      })
      return Response.json({ id: "form-1" }, { status: formsStatus })
    }

    return Response.json({ error: "not_found" }, { status: 404 })
  }) as typeof fetch

  return {
    capturedFormsRequests,
    restore() {
      globalThis.fetch = previousFetch
    },
  }
}

function withRendererEnv() {
  const previousCmsUrl = process.env.SIAB_CMS_URL
  const previousFixtureMode = process.env.SIAB_RENDERER_FIXTURE_MODE
  process.env.SIAB_CMS_URL = cmsUrl
  process.env.SIAB_RENDERER_FIXTURE_MODE = ""

  return () => {
    if (previousCmsUrl == null) delete process.env.SIAB_CMS_URL
    else process.env.SIAB_CMS_URL = previousCmsUrl
    if (previousFixtureMode == null) delete process.env.SIAB_RENDERER_FIXTURE_MODE
    else process.env.SIAB_RENDERER_FIXTURE_MODE = previousFixtureMode
  }
}

function rendererRequest(body: BodyInit, headers: HeadersInit = {}) {
  return new Request("https://ami-care.nl/api/forms", {
    method: "POST",
    headers: {
      host: "ami-care.nl",
      "x-forwarded-host": "ami-care.nl",
      ...headers,
    },
    body,
  })
}

test("proxies JSON form submissions with tenant derived from the active snapshot", async () => {
  const restoreEnv = withRendererEnv()
  const fetchStub = installFetchStub()
  try {
    const response = await POST({
      request: rendererRequest(
        JSON.stringify({
          tenant: "spoofed-tenant",
          formName: "contact",
          pageUrl: "https://ami-care.nl/contact",
          data: {
            email: "Visitor@Example.test",
            name: "Ada",
            message: "Hello",
          },
        }),
        {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10, 10.0.0.2",
        },
      ),
    } as Parameters<typeof POST>[0])

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      status: "received",
      message: "Thank you. Your message has been sent.",
    })
    assert.equal(fetchStub.capturedFormsRequests.length, 1)
    const forwarded = fetchStub.capturedFormsRequests[0]
    assert.equal(forwarded.body.tenant, "tenant-from-snapshot")
    assert.equal(forwarded.body.formName, "contact")
    assert.equal(forwarded.body.email, "visitor@example.test")
    assert.equal(forwarded.body.name, "Ada")
    assert.equal(forwarded.body.message, "Hello")
    assert.deepEqual(forwarded.body.data, {
      email: "Visitor@Example.test",
      name: "Ada",
      message: "Hello",
    })
    assert.equal(forwarded.headers.get("x-forwarded-for"), "203.0.113.10, 10.0.0.2")
    assert.equal(forwarded.headers.get("authorization"), null)
  } finally {
    fetchStub.restore()
    restoreEnv()
  }
})

test("proxies multipart form-data submissions", async () => {
  const restoreEnv = withRendererEnv()
  const fetchStub = installFetchStub()
  try {
    const formData = new FormData()
    formData.set("formName", "lead")
    formData.set("email", "lead@example.test")
    formData.set("name", "Lead Name")
    formData.set("message", "Please call me.")
    formData.set("company", "Example BV")

    const response = await POST({
      request: rendererRequest(formData, {
        referer: "https://ami-care.nl/#contact",
      }),
    } as Parameters<typeof POST>[0])

    assert.equal(response.status, 200)
    assert.equal(fetchStub.capturedFormsRequests.length, 1)
    const forwarded = fetchStub.capturedFormsRequests[0].body
    assert.equal(forwarded.tenant, "tenant-from-snapshot")
    assert.equal(forwarded.formName, "lead")
    assert.equal(forwarded.pageUrl, "https://ami-care.nl/#contact")
    assert.equal(forwarded.email, "lead@example.test")
    assert.equal(forwarded.name, "Lead Name")
    assert.equal(forwarded.message, "Please call me.")
    assert.deepEqual(forwarded.data, {
      formName: "lead",
      email: "lead@example.test",
      name: "Lead Name",
      message: "Please call me.",
      company: "Example BV",
    })
  } finally {
    fetchStub.restore()
    restoreEnv()
  }
})

test("returns friendly errors for missing snapshot, invalid method, invalid body, and CMS errors", async () => {
  const restoreEnv = withRendererEnv()
  const fetchStub = installFetchStub({ snapshot: null })
  try {
    const missingSnapshot = await POST({
      request: rendererRequest(JSON.stringify({ formName: "contact" }), {
        "content-type": "application/json",
      }),
    } as Parameters<typeof POST>[0])
    assert.equal(missingSnapshot.status, 404)
    assert.equal((await missingSnapshot.json()).error, "site_not_found")
    assert.equal(fetchStub.capturedFormsRequests.length, 0)

    const method = await GET({
      request: new Request("https://ami-care.nl/api/forms", { method: "GET" }),
    } as Parameters<typeof GET>[0])
    assert.equal(method.status, 405)
    assert.equal(method.headers.get("allow"), "POST")
    assert.equal((await method.json()).error, "method_not_allowed")
  } finally {
    fetchStub.restore()
    restoreEnv()
  }

  const restoreEnvAgain = withRendererEnv()
  const cmsErrorStub = installFetchStub({ formsStatus: 500 })
  try {
    const invalidBody = await POST({
      request: rendererRequest("{", {
        "content-type": "application/json",
      }),
    } as Parameters<typeof POST>[0])
    assert.equal(invalidBody.status, 400)
    assert.equal((await invalidBody.json()).error, "invalid_json")
    assert.equal(cmsErrorStub.capturedFormsRequests.length, 0)

    const cmsError = await POST({
      request: rendererRequest(JSON.stringify({ formName: "contact", message: "hello" }), {
        "content-type": "application/json",
      }),
    } as Parameters<typeof POST>[0])
    assert.equal(cmsError.status, 502)
    assert.equal((await cmsError.json()).error, "forms_unavailable")
  } finally {
    cmsErrorStub.restore()
    restoreEnvAgain()
  }
})
