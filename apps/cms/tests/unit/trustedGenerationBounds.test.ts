import { afterEach, describe, expect, it, vi } from "vitest"
import { createOpenAISiteGenerationProvider, createSiteGenerationProviderRequest } from "@/lib/ai-generation/providers"
import { offlineBuilderExecution } from "../_helpers/builderExecution"
const request = () => createSiteGenerationProviderRequest({ businessName: "Fixture", tenantSlug: "fixture", primaryDomain: "fixture.test", siteUrl: "https://fixture.test", language: "en", serviceArea: ["Utrecht"], goals: ["contact"], requestedPages: [{ slug: "index", title: "Home" }] })
describe("explicit trusted legacy generation transport", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("refuses customer authority before network and bounds one trusted wire request without retries", async () => {
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: "gpt-5.5", max_output_tokens: 8192, store: false })
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ error: { message: "Synthetic rate limit" } }), { status: 429 })
    })
    vi.stubGlobal("fetch", transport)
    const provider = createOpenAISiteGenerationProvider({ apiKey: "synthetic-offline-key" })
    await expect(provider.generate({ ...request(), executionContext: offlineBuilderExecution() })).rejects.toThrow("bounded Mastra")
    expect(transport).not.toHaveBeenCalled()
    await expect(provider.generate(request())).rejects.toThrow("Synthetic rate limit")
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
