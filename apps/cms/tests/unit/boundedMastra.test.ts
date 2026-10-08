import { Agent } from "@mastra/core/agent"
import { createOpenAI } from "@ai-sdk/openai"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuilderExecutionContext } from "@/lib/builder/executionContext"
import { boundedResponsesFetch, customerMastraSettings, customerModelLimits, mastraAggregateUsage } from "@/lib/ai-generation/boundedMastra"

const context = (): BuilderExecutionContext => ({
  signal: new AbortController().signal,
  deadlineAt: new Date(Date.now() + 90000).toISOString(),
  assertActive: vi.fn(async () => {}),
  modelCall: async (_limits, generate) => generate(new AbortController().signal),
  withWrite: async (mutation) => mutation({ transactionID: "fixture-only" }),
  recordGenerationReferences: async () => {},
})
const sse = () => new Response([
  { type: "response.created", response: { id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1 } },
  { type: "response.output_text.delta", item_id: "msg_fixture", output_index: 0, content_index: 0, delta: "Hello fixture" },
  { type: "response.completed", response: { id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, status: "completed", usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } } },
].map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } })

describe("installed Mastra Responses contract without network", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it.each(["low", "medium"] as const)("captures exact %s effort/output wire through real Agent and adapter", async (effort) => {
    const ctx = context()
    const limits = customerModelLimits(effort)
    const capture = vi.fn<typeof fetch>(async (_url, init) => {
      expect(typeof init?.body).toBe("string")
      const body: unknown = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ model: "gpt-5.6-luna", reasoning: { effort }, store: false, max_output_tokens: 2048 })
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, status: "completed", output: [{ type: "message", id: "msg_fixture", role: "assistant", content: [{ type: "output_text", text: "Hello fixture", annotations: [] }] }], usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } }), { headers: { "content-type": "application/json" } })
    })
    const model = createOpenAI({ apiKey: "synthetic-offline-key", fetch: boundedResponsesFetch(ctx, limits, capture) }).responses("gpt-5.6-luna")
    const agent = new Agent({ id: "wire-fixture", name: "wire fixture", model, instructions: "Respond briefly", maxRetries: 0 })
    const result = await agent.generate("Hello", { ...customerMastraSettings(ctx, limits), providerOptions: { openai: { reasoningEffort: effort, store: false } } })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(result.text).toBe("Hello fixture")
    expect(mastraAggregateUsage(result)).toMatchObject({ inputTokens: 17, outputTokens: 9 })
  })
  it("holds the production first-site model callback until the full JSON body completes", async () => {
    const { runFirstSiteTurn } = await import("@/lib/builder/firstSiteAgent")
    const { createTestPayload } = await import("../_helpers/testPayload")
    vi.stubEnv("OPENAI_API_KEY", "synthetic-offline-key")
    vi.stubEnv("SITE_GENERATION_MASTRA_CHAT_REASONING_EFFORT", "medium")
    let completeBody: (() => void) | undefined
    let called: (() => void) | undefined
    const dispatched = new Promise<void>((resolve) => { called = resolve })
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) {
      completeBody = () => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, status: "completed", output: [{ type: "message", id: "msg_fixture", role: "assistant", content: [{ type: "output_text", text: "Which two services do you offer?", annotations: [] }] }], usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } })))
        controller.close()
      }
      called?.()
    } }), { headers: { "content-type": "application/json" } })))
    const ctx = context()
    let completed = false
    ctx.modelCall = async (limits, generate, usage) => {
      expect(limits).toMatchObject({ maxSteps: 4, maxOutputTokens: 2048 })
      const result = await generate(ctx.signal)
      expect(await usage(result)).toMatchObject({ inputTokens: 17, outputTokens: 9 })
      completed = true
      return result
    }
    const pending = runFirstSiteTurn({ payload: createTestPayload(), executionContext: ctx, locale: "en", message: "I want a website", previous: null, contact: { name: "Fixture", email: "fixture@example.test", phone: "" }, legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false } })
    await dispatched
    expect(completed).toBe(false)
    completeBody?.()
    expect((await pending).text).toBe("Which two services do you offer?")
    expect(completed).toBe(true)
  })
  it("consumes actual SDK SSE completion and aggregate usage", async () => {
    const ctx = context()
    const limits = customerModelLimits("low")
    const capture = vi.fn<typeof fetch>(async () => sse())
    const model = createOpenAI({ apiKey: "synthetic-offline-key", fetch: boundedResponsesFetch(ctx, limits, capture) }).responses("gpt-5.6-luna")
    const agent = new Agent({ id: "stream-fixture", name: "stream fixture", model, instructions: "Respond briefly", maxRetries: 0 })
    const streamed = await agent.stream("Hello", { ...customerMastraSettings(ctx, limits), providerOptions: { openai: { reasoningEffort: "low", store: false } } })
    const result = await streamed.getFullOutput()
    expect(mastraAggregateUsage(result, limits)).toMatchObject({ inputTokens: 17, outputTokens: 9 })
    expect(capture).toHaveBeenCalledTimes(1)
  })
  it("rejects oversize UTF-8 provider body before forwarding", async () => {
    const capture = vi.fn<typeof fetch>()
    await expect(boundedResponsesFetch(context(), customerModelLimits("low"), capture)("https://offline.invalid", { body: "é".repeat(40000) })).rejects.toThrow("UTF-8")
    expect(capture).not.toHaveBeenCalled()
  })
  it("aborted operation rejects before transport and oversized body rejects during consumption", async () => {
    const controller = new AbortController()
    const ctx: BuilderExecutionContext = { ...context(), signal: controller.signal }
    controller.abort(new Error("fixture canceled"))
    const capture = vi.fn<typeof fetch>()
    await expect(boundedResponsesFetch(ctx, customerModelLimits("low"), capture)("https://offline.invalid", { body: "{}" })).rejects.toThrow("fixture canceled")
    expect(capture).not.toHaveBeenCalled()
    const limits = customerModelLimits("low")
    const wire = JSON.stringify({ model: "gpt-5.6-luna", reasoning: { effort: "low" }, store: false, max_output_tokens: 2048, input: [{ role: "user", content: "Hello" }] })
    const transport = vi.fn<typeof fetch>(async () => new Response("x".repeat(262145)))
    const response = await boundedResponsesFetch(context(), limits, transport)("https://offline.invalid", { body: wire })
    await expect(response.text()).rejects.toThrow("response exceeds")
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it("missing aggregate usage never becomes last-step usage or zero", () => {
    expect(mastraAggregateUsage({ usage: { inputTokens: 1, outputTokens: 1 } })).toBeNull()
    expect(mastraAggregateUsage({ totalUsage: { inputTokens: -1, outputTokens: 1 } })).toBeNull()
  })
})
