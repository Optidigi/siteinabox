import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { rendererEdgeCheck } from "./edge-check"

const originalFetch = globalThis.fetch
const originalCmsUrl = process.env.SIAB_CMS_URL
const originalToken = process.env.SIAB_RENDERER_API_TOKEN

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalCmsUrl === undefined) delete process.env.SIAB_CMS_URL
  else process.env.SIAB_CMS_URL = originalCmsUrl
  if (originalToken === undefined) delete process.env.SIAB_RENDERER_API_TOKEN
  else process.env.SIAB_RENDERER_API_TOKEN = originalToken
})

test("returns the CMS-authoritative renderer identity", async () => {
  process.env.SIAB_CMS_URL = "https://cms.example.test"
  process.env.SIAB_RENDERER_API_TOKEN = "test-renderer-api-token"
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://cms.example.test/api/renderer/edge-check?host=www.ami-care.nl",
    )
    assert.equal(init?.method, "HEAD")
    assert.deepEqual(init?.headers, {
      authorization: "Bearer test-renderer-api-token",
    })
    return new Response(null, {
      status: 200,
      headers: { "x-siab-domain": "ami-care.nl" },
    })
  }

  const response = await rendererEdgeCheck("www.ami-care.nl")

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("x-siab-service"), "renderer")
  assert.equal(response.headers.get("x-siab-domain"), "ami-care.nl")
})

test("fails closed when CMS configuration, transport, or identity is invalid", async (t) => {
  await t.test("malformed CMS URL", async () => {
    process.env.SIAB_CMS_URL = "not a URL"
    assert.equal((await rendererEdgeCheck("ami-care.nl")).status, 404)
  })
  await t.test("CMS transport failure", async () => {
    process.env.SIAB_CMS_URL = "https://cms.example.test"
    globalThis.fetch = async () => {
      throw new Error("connection unavailable")
    }
    assert.equal((await rendererEdgeCheck("ami-care.nl")).status, 404)
  })
  await t.test("unauthorized or incomplete CMS response", async () => {
    globalThis.fetch = async () => new Response(null, { status: 401 })
    assert.equal((await rendererEdgeCheck("ami-care.nl")).status, 404)
    globalThis.fetch = async () => new Response(null, { status: 200 })
    assert.equal((await rendererEdgeCheck("ami-care.nl")).status, 404)
  })
})
