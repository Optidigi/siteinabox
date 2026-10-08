import { mastraOpenAIProviderOptions } from "@/lib/ai-generation/mastraProvider"
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { Agent } from "@mastra/core/agent"
import { createOpenAI } from "@ai-sdk/openai"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuilderExecutionContext } from "@/lib/builder/executionContext"
import { boundedResponsesFetch, customerMastraSettings, customerModelLimits, mastraAggregateUsage, createCustomerUsageCapture } from "@/lib/ai-generation/boundedMastra"

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
  { type: "response.completed", response: { id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, service_tier: "default", status: "completed", usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } } },
].map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } })

describe("installed Mastra Responses contract without network", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it.each(["low", "medium"] as const)("captures exact %s effort/output wire through real Agent and adapter", async (effort) => {
    const ctx = context()
    const limits = customerModelLimits(effort)
    const usageCapture = createCustomerUsageCapture(limits)
    const capture = vi.fn<typeof fetch>(async (_url, init) => {
      expect(typeof init?.body).toBe("string")
      const body: unknown = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ model: "gpt-5.6-luna", reasoning: { effort }, store: false, max_output_tokens: 2048 })
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, service_tier: "default", status: "completed", output: [{ type: "message", id: "msg_fixture", role: "assistant", content: [{ type: "output_text", text: "Hello fixture", annotations: [] }] }], usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } }), { headers: { "content-type": "application/json" } })
    })
    const model = createOpenAI({ apiKey: "synthetic-offline-key", fetch: boundedResponsesFetch(ctx, limits, capture, usageCapture) }).responses("gpt-5.6-luna")
    const agent = new Agent({ id: "wire-fixture", name: "wire fixture", model, instructions: "Respond briefly", maxRetries: 0 })
    const result = await agent.generate("Hello", { ...customerMastraSettings(ctx, limits), providerOptions: mastraOpenAIProviderOptions(effort) })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(result.text).toBe("Hello fixture")
    expect(usageCapture.usage()).toMatchObject({ inputTokens: 17, outputTokens: 9, cachedInputTokens: 0, cacheCreationInputTokens: 0, stepUsage: [{ inputTokens: 17, outputTokens: 9, cachedInputTokens: 0, cacheCreationInputTokens: 0 }] })
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
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ id: "resp_fixture", model: "gpt-5.6-luna", created_at: 1, service_tier: "default", status: "completed", output: [{ type: "message", id: "msg_fixture", role: "assistant", content: [{ type: "output_text", text: "Which two services do you offer?", annotations: [] }] }], usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 3 } } })))
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
    const usageCapture = createCustomerUsageCapture(limits)
    const capture = vi.fn<typeof fetch>(async () => sse())
    const model = createOpenAI({ apiKey: "synthetic-offline-key", fetch: boundedResponsesFetch(ctx, limits, capture, usageCapture) }).responses("gpt-5.6-luna")
    const agent = new Agent({ id: "stream-fixture", name: "stream fixture", model, instructions: "Respond briefly", maxRetries: 0 })
    const streamed = await agent.stream("Hello", { ...customerMastraSettings(ctx, limits), providerOptions: mastraOpenAIProviderOptions("low") })
    const result = await streamed.getFullOutput()
    expect(result.text).toBe("Hello fixture")
    expect(usageCapture.usage()).toMatchObject({ inputTokens: 17, outputTokens: 9, cacheCreationInputTokens: 0 })
    expect(capture).toHaveBeenCalledTimes(1)
  })
  it("rejects oversize UTF-8 provider body before forwarding", async () => {
    const capture = vi.fn<typeof fetch>()
    await expect(boundedResponsesFetch(context(), customerModelLimits("low"), capture)("https://api.openai.com/v1/responses", { method: "POST", body: "é".repeat(40000) })).rejects.toThrow("UTF-8")
    expect(capture).not.toHaveBeenCalled()
  })
  it("aborted operation rejects before transport and oversized body rejects during consumption", async () => {
    const controller = new AbortController()
    const ctx: BuilderExecutionContext = { ...context(), signal: controller.signal }
    controller.abort(new Error("fixture canceled"))
    const capture = vi.fn<typeof fetch>()
    await expect(boundedResponsesFetch(ctx, customerModelLimits("low"), capture)("https://api.openai.com/v1/responses", { method: "POST", body: "{}" })).rejects.toThrow("fixture canceled")
    expect(capture).not.toHaveBeenCalled()
    const limits = customerModelLimits("low")
    const wire = JSON.stringify({ model: "gpt-5.6-luna", reasoning: { effort: "low", mode: "standard" }, service_tier: "default", truncation: "disabled", store: false, max_output_tokens: 2048, input: [{ role: "user", content: "Hello" }] })
    const transport = vi.fn<typeof fetch>(async () => new Response("x".repeat(262145)))
    const response = await boundedResponsesFetch(context(), limits, transport)("https://api.openai.com/v1/responses", { method: "POST", body: wire })
    await expect(response.text()).rejects.toThrow("response exceeds")
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it("captures all real Agent tool-loop steps without encrypted reasoning references", async () => {
    const ctx = context(), limits = customerModelLimits("low"), usage = createCustomerUsageCapture(limits)
    let calls = 0
    const transport = vi.fn<typeof fetch>(async (_url, init) => {
      calls++
      const wire: unknown = JSON.parse(String(init?.body))
      expect(wire).not.toHaveProperty("include")
      if (calls === 2) expect(wire).toMatchObject({ input: expect.arrayContaining([expect.objectContaining({ type: "function_call_output", output: expect.any(String) })]) })
      return new Response(JSON.stringify({ id: `resp_${calls}`, model: "gpt-5.6-luna", service_tier: "default", created_at: 1, status: "completed", output: calls === 1 ? [{ type: "function_call", id: "fc_fixture", call_id: "call_fixture", name: "note", arguments: "{}" }] : [{ type: "message", id: "msg_fixture", role: "assistant", content: [{ type: "output_text", text: "Done", annotations: [] }] }], usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 3 } } }), { headers: { "content-type": "application/json" } })
    })
    const agent = new Agent({ id: "tool-wire", name: "tool wire", instructions: "Use note", maxRetries: 0, model: createOpenAI({ apiKey: "synthetic-offline-key", fetch: boundedResponsesFetch(ctx, limits, transport, usage) }).responses("gpt-5.6-luna"), tools: { note: createTool({ id: "note", description: "Offline fixture", inputSchema: z.object({}), execute: async () => ({ saved: true }) }) } })
    const result = await agent.generate("Save note", { ...customerMastraSettings(ctx, limits), providerOptions: mastraOpenAIProviderOptions("low") })
    expect(result.text).toBe("Done")
    expect(calls).toBe(2)
    expect(usage.usage()).toMatchObject({ inputTokens: 34, outputTokens: 18, cacheCreationInputTokens: 6 })
  })
  it("captures raw per-step cache writes and never completes at response headers", async () => {
    const limits = customerModelLimits("medium")
    const usage = createCustomerUsageCapture(limits)
    const wire = JSON.stringify({ model: "gpt-5.6-luna", reasoning: { effort: "medium", mode: "standard" }, service_tier: "default", truncation: "disabled", store: false, max_output_tokens: 2048, input: [{ role: "user", content: "Hello" }] })
    const transport = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ model: "gpt-5.6-luna", service_tier: "default", status: "completed", usage: { input_tokens: 300000, output_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 40 } } })))
    const bounded = boundedResponsesFetch(context(), limits, transport, usage)
    const first = await bounded("https://api.openai.com/v1/responses", { method: "POST", body: wire })
    expect(usage.usage()).toBeNull()
    await expect(bounded("https://api.openai.com/v1/responses", { method: "POST", body: wire })).rejects.toThrow("retry/step")
    await first.text()
    const second = await bounded("https://api.openai.com/v1/responses", { method: "POST", body: wire })
    await second.text()
    expect(usage.usage()).toMatchObject({ inputTokens: 600000, outputTokens: 200, cachedInputTokens: 40, cacheCreationInputTokens: 80 })
    expect(usage.usage()?.stepUsage).toHaveLength(2)
  })
  it("retains unknown billing when raw cache-write detail is absent", () => {
    const usage = createCustomerUsageCapture(customerModelLimits("low"))
    const index = usage.begin()
    usage.complete(index, { model: "gpt-5.6-luna", service_tier: "default", status: "completed", usage: { input_tokens: 17, output_tokens: 9, input_tokens_details: { cached_tokens: 0 } } })
    expect(usage.usage()?.cacheCreationInputTokens).toBeNull()
  })
  it("rejects endpoint, tier, reasoning mode, opaque references and hosted tools before transport", async () => {
    const transport = vi.fn<typeof fetch>()
    const limits = customerModelLimits("low")
    const body = { model: "gpt-5.6-luna", reasoning: { effort: "low", mode: "standard" }, service_tier: "default", truncation: "disabled", store: false, max_output_tokens: 2048, input: [{ role: "user", content: "Hello" }] }
    const bounded = boundedResponsesFetch(context(), limits, transport)
    await expect(bounded("https://api.openai.com/v1/chat/completions", { method: "POST", body: JSON.stringify(body) })).rejects.toThrow("endpoint")
    for (const change of [{ service_tier: "priority" }, { reasoning: { effort: "low", mode: "pro" } }, { previous_response_id: "opaque" }, { tools: [{ type: "web_search" }] }, { input: [{ type: "item_reference", id: "opaque" }] }]) {
      await expect(bounded("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ ...body, ...change }) })).rejects.toThrow()
    }
    expect(transport).not.toHaveBeenCalled()
  })
  it("missing aggregate usage never becomes last-step usage or zero", () => {
    expect(mastraAggregateUsage({ usage: { inputTokens: 1, outputTokens: 1 } })).toBeNull()
    expect(mastraAggregateUsage({ totalUsage: { inputTokens: -1, outputTokens: 1 } })).toBeNull()
  })
})
