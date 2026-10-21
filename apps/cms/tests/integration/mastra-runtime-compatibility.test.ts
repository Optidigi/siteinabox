// Integration boundary: real application callers, installed SDK and provider adapter.
// Controlled models/HTTP fakes forbid live provider requests; guarded Vitest setup owns isolation.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMockModel, MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock"
import type { Agent as SdkAgent, ToolsInput } from "@mastra/core/agent"
import type { WidenedMastraModelConfig } from "@mastra/core/llm"
import { createMastraSiteGenerationProvider } from "@/lib/ai-generation/mastraProvider"
import { createSiteGenerationProviderRequest } from "@/lib/ai-generation/providers"
import { runFirstSiteTurn } from "@/lib/builder/firstSiteAgent"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { runSiteEditorAgent, runExistingSiteTurn, streamSiteEditorAgent, streamExistingSiteTurn, type SiteEditorStreamEvent } from "@/lib/agent/siteEditorAgent"

const runtime = vi.hoisted(() => ({
  model: undefined as ReturnType<typeof createMockModel> | MastraLanguageModelV2Mock | undefined,
  customerRevoked: false,
  useConfiguredModel: false,
  agents: [] as Array<{ listErrorProcessors(): Promise<unknown[]> }>,
  configurations: [] as Array<ConstructorParameters<typeof SdkAgent>[0]>,
}))
vi.mock("@mastra/core/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mastra/core/agent")>()
  return { ...actual, Agent: class extends actual.Agent<string, ToolsInput, unknown> {
    constructor(config: ConstructorParameters<typeof actual.Agent>[0]) {
      let model: WidenedMastraModelConfig
      if (runtime.useConfiguredModel) {
        if (typeof config.model !== "string") throw new Error("A configured model ID is required")
        model = config.model
      } else {
        if (!runtime.model) throw new Error("Controlled model is required")
        model = runtime.model
      }
      super({ ...config, model })
      runtime.configurations.push(config)
      runtime.agents.push(this)
    }
  } }
})

vi.mock("@/lib/auth/customerWorkspace", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/auth/customerWorkspace")>()
  const { CustomerIdentityError } = await import("@/lib/auth/verifiedCustomer")
  return { ...actual, assertCustomerAccess: async () => {
    if (runtime.customerRevoked) throw new CustomerIdentityError("E_CUSTOMER_SESSION_REQUIRED")
  } }
})

const normalized = {
  businessName: "Fixture Studio", tenantSlug: "fixture-studio", primaryDomain: "fixture.example.test",
  siteUrl: "https://fixture.example.test", language: "nl", contact: { name: "Fixture", email: "fixture@example.test", phone: "0612345678" },
  industry: "Design", serviceArea: ["Nederland"], goals: ["Contact"], requestedPages: [{ slug: "index", title: "Home", purpose: "Homepage" }],
}
const request = () => createSiteGenerationProviderRequest(normalized)
const output = { pages: [{ slug: "index", title: "Home", sections: [{ blockType: "hero", variant: "hero-01", heading: "Fixture", body: "Studio", primaryAction: { label: "Contact", href: "#contact" }, secondaryAction: null, mediaId: null }] }] }
const payload = () => ({
  find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === "pages" ? [{ id: 1, slug: "index", title: "Home", blocks: [] }] : [] })),
  findByID: vi.fn(async () => ({ id: 7, theme: null })), update: vi.fn(), create: vi.fn(),
})
const editorInput = () => {
  const database = payload()
  return { database, ctx: { payload: database as never, tenantId: 7 }, message: "Lees de huidige preview", pageSlug: "index", facts: heuristicExtractBuilderFacts("Fixture Studio", null) }
}
const firstSite = () => runFirstSiteTurn({ payload: payload() as never, message: "Ik ben ontwerper in Tilburg", previous: null, contact: normalized.contact, legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false } })

beforeEach(() => {
  runtime.customerRevoked = false
  runtime.agents = []; runtime.configurations = []; runtime.useConfiguredModel = false
  vi.stubEnv("OPENAI_API_KEY", "synthetic-no-network")
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live requests are forbidden in deterministic runtime tests") }))
  runtime.model = createMockModel({ version: "v2", mockText: JSON.stringify(output) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("installed Mastra compatibility through application callers", () => {
  it.each(["generation", "first-site", "editor"])("does not add automatic recovery to %s", async (caller) => {
    if (caller === "generation") await createMastraSiteGenerationProvider().generate(request())
    else if (caller === "first-site") await firstSite()
    else await runSiteEditorAgent(editorInput())
    expect(runtime.configurations[0]).toMatchObject({ model: "openai/gpt-5.6-luna", maxRetries: 0, maxProcessorRetries: 0, errorProcessorDefaults: false })
    expect(await runtime.agents[0]!.listErrorProcessors()).toEqual([])
  })

  it("validates generated JSON and retains configured model and reasoning at the real SDK boundary", async () => {
    vi.stubEnv("SITE_GENERATION_MASTRA_MODEL", "openai/gpt-5.6-sol")
    vi.stubEnv("SITE_GENERATION_MASTRA_REASONING_EFFORT", "low")
    const spy = vi.fn()
    runtime.model = createMockModel({ version: "v2", mockText: JSON.stringify(output), spyGenerate: spy })
    const result = await createMastraSiteGenerationProvider().generate(request())
    expect(result.parsedOutput).toMatchObject(output)
    expect(runtime.configurations[0]?.model).toBe("openai/gpt-5.6-sol")
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerOptions: expect.objectContaining({ openai: expect.objectContaining({ reasoningEffort: "low" }) }) }))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("preserves the configured OpenAI route and reasoning in the actual provider adapter", async () => {
    runtime.useConfiguredModel = true
    const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      expect(String(url)).toBe("https://api.openai.com/v1/responses")
      const body = JSON.parse(String(options?.body))
      expect(body.model).toBe("gpt-5.6-luna")
      expect(body.reasoning).toMatchObject({ effort: "high" })
      return Response.json({ id: "resp_fixture", object: "response", created_at: 1, status: "completed", model: "gpt-5.6-luna",
        output: [{ id: "msg_fixture", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output), annotations: [] }] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await createMastraSiteGenerationProvider().generate(request())
    expect(result.parsedOutput).toMatchObject(output)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(["not JSON", '{"pages":'])("rejects invalid or partial generation: %s", async (text) => {
    runtime.model = createMockModel({ version: "v2", mockText: text })
    await expect(createMastraSiteGenerationProvider().generate(request())).rejects.toThrow()
  })

  it("completes the real editor stream before emitting done", async () => {
    runtime.model = createMockModel({ version: "v2", mockText: "De preview is ongewijzigd." })
    const input = editorInput(); const events: SiteEditorStreamEvent[] = []
    for await (const event of streamSiteEditorAgent(input)) events.push(event)
    expect(events.some((event) => event.type === "delta")).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: "done", result: { text: "De preview is ongewijzigd.", applied: false } })
    expect(input.database.update).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["error", "length"] as const)("rejects valid JSON from an incomplete %s terminal state", async (finishReason) => {
    runtime.model = new MastraLanguageModelV2Mock({ doGenerate: {
      content: [{ type: "text", text: JSON.stringify(output) }], finishReason,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [],
    } })
    await expect(createMastraSiteGenerationProvider().generate(request())).rejects.toThrow()
  })

  it("never emits successful done or performs fallback writes after a failed editor stream", async () => {
    runtime.model = new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "fixture" })
      controller.enqueue({ type: "text-delta", id: "fixture", delta: "Provisional response" })
      controller.enqueue({ type: "text-end", id: "fixture" })
      controller.enqueue({ type: "finish", finishReason: "error", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } })
      controller.close()
    } }) }) })
    const input = editorInput(); const events: SiteEditorStreamEvent[] = []
    const consume = async () => { for await (const event of streamExistingSiteTurn({ ...input, useMastra: true })) events.push(event) }
    await expect(consume()).rejects.toThrow()
    expect(events.some((event) => event.type === "delta")).toBe(true)
    expect(events.some((event) => event.type === "done")).toBe(false)
    expect(input.database.update).not.toHaveBeenCalled()
  })

  it("executes the first-site tool with its original input shape", async () => {
    let calls = 0
    runtime.model = new MastraLanguageModelV2Mock({ doGenerate: async () => {
      calls += 1
      return { content: calls === 1
        ? [{ type: "tool-call" as const, toolCallId: "note-fixture", toolName: "noteBrief", input: JSON.stringify({ businessName: "Controlled Studio" }) }]
        : [{ type: "text" as const, text: "Wat wil je bezoekers vertellen?" }],
      finishReason: calls === 1 ? "tool-calls" as const : "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }
    } })
    const result = await firstSite()
    expect(result.facts?.businessName).toBe("Controlled Studio")
    expect(calls).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("retains editor role checks inside real SDK tool execution", async () => {
    let calls = 0
    runtime.model = new MastraLanguageModelV2Mock({ doGenerate: async () => {
      calls += 1
      return { content: calls === 1
        ? [{ type: "tool-call" as const, toolCallId: "contact-fixture", toolName: "setContact", input: JSON.stringify({ phone: "0612345678" }) }]
        : [{ type: "text" as const, text: "Alleen de eigenaar kan dit wijzigen." }],
      finishReason: calls === 1 ? "tool-calls" as const : "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }
    } })
    const input = editorInput()
    const result = await runSiteEditorAgent({ ...input, role: "editor" })
    expect(result.applied).toBe(false)
    expect(input.database.update).not.toHaveBeenCalled()
    expect(input.database.create).not.toHaveBeenCalled()
  })

  it("does not turn an aborted editor provider into fallback completion", async () => {
    const aborted = vi.fn(async () => { throw new DOMException("Controlled interruption", "AbortError") })
    runtime.model = new MastraLanguageModelV2Mock({ doGenerate: aborted, doStream: aborted })
    const input = editorInput(); const events: SiteEditorStreamEvent[] = []
    const consume = async () => { for await (const event of streamExistingSiteTurn({ ...input, useMastra: true })) events.push(event) }
    await expect(consume()).rejects.toThrow("AI run did not complete")
    expect(events.some((event) => event.type === "done")).toBe(false)
    expect(input.database.update).not.toHaveBeenCalled()
    expect(aborted).toHaveBeenCalledTimes(1)
  })

  it("does not accept or retry an exhausted provider failure", async () => {
    const failure = vi.fn(async () => { throw new Error("synthetic provider failure") })
    runtime.model = new MastraLanguageModelV2Mock({ doGenerate: failure, doStream: failure })
    await expect(createMastraSiteGenerationProvider().generate(request())).rejects.toThrow()
    expect(failure).toHaveBeenCalledTimes(1)
  })
})


it.each(["generate", "stream"] as const)("checks current authority before every real SDK %s model step", async mode => {
  let modelRequests = 0, completedContextReads = 0
  const response = () => {
    modelRequests += 1
    return { content: modelRequests === 1
      ? [{ type: "tool-call" as const, toolCallId: "authority-context", toolName: "getSiteContext", input: "{}" }]
      : [{ type: "text" as const, text: "Must not dispatch this second request" }],
    finishReason: modelRequests === 1 ? "tool-calls" as const : "stop" as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }
  }
  runtime.model = new MastraLanguageModelV2Mock({ doGenerate: async () => response(), doStream: async () => {
    const result = response()
    return { stream: new ReadableStream({ start(controller) {
      for (const item of result.content) {
        if (item.type === "tool-call") controller.enqueue(item)
        else {
          controller.enqueue({ type: "text-start", id: "authority-text" })
          controller.enqueue({ type: "text-delta", id: "authority-text", delta: item.text })
          controller.enqueue({ type: "text-end", id: "authority-text" })
        }
      }
      controller.enqueue({ type: "finish", finishReason: result.finishReason, usage: result.usage })
      controller.close()
    } }) }
  } })
  const input = editorInput()
  input.database.find.mockImplementation(async ({ collection }) => {
    if (collection === "site-settings") {
      completedContextReads += 1
      if (modelRequests === 1) runtime.customerRevoked = true
    }
    return { docs: collection === "pages" ? [{ id: 1, slug: "index", title: "Home", blocks: [] }] : [] }
  })
  const guarded = { ...input, ctx: { ...input.ctx, customerAuthority: { accountId: 1, previewSessionId: "synthetic-session" } } }
  const execute = async () => {
    if (mode === "generate") await runSiteEditorAgent(guarded)
    else for await (const _event of streamSiteEditorAgent(guarded)) { /* Drain actual SDK until admission rejects the next step. */ }
  }
  await expect(execute()).rejects.toThrow()
  expect(completedContextReads).toBe(2)
  expect(modelRequests, "Revocation after a completed tool must stop the next provider step").toBe(1)
  expect(fetch).not.toHaveBeenCalled()
})


it("does not replay a maintainer write after a committed projection failure", async () => {
  const tools = await import("@/lib/agent/tools")
  const { CustomerProjectionError } = await import("@/lib/projection/customerTransaction")
  const error = new CustomerProjectionError()
  const prune = vi.spyOn(tools, "pruneUnavailableBlocksIfPresent").mockRejectedValue(error)
  runtime.model = createMockModel({ version: "v2", mockText: "De preview is bijgewerkt." })
  const input = editorInput()
  try {
    await expect(runExistingSiteTurn({ ...input, message: "Maak het thema groen en donker.", useMastra: true })).rejects.toBe(error)
    expect(input.database.update).not.toHaveBeenCalled()
    expect(input.database.create).not.toHaveBeenCalled()
  } finally { prune.mockRestore() }
})
