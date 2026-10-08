import { createOpenAI } from "@ai-sdk/openai"
import type { BuilderExecutionContext, BuilderModelCall, BuilderTokenUsage, BuilderStepTokenUsage } from "@/lib/builder/executionContext"

export const CUSTOMER_MODEL = "openai/gpt-5.6-luna" as const
export const CUSTOMER_INPUT_BYTES = 65536
export const CUSTOMER_BILLABLE_INPUT_TOKENS = 1050000
export const customerModelLimits = (effort: "low" | "medium", generation = false): BuilderModelCall => ({
  model: CUSTOMER_MODEL,
  reasoningEffort: effort,
  inputBytes: CUSTOMER_INPUT_BYTES,
  maxBillableInputTokens: CUSTOMER_BILLABLE_INPUT_TOKENS,
  maxOutputTokens: generation ? 8192 : 2048,
  maxSteps: generation ? 1 : 4,
})

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
const tokenCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null

/** Full-loop usage only. Missing/malformed usage retains the reserved liability. */
export const mastraAggregateUsage = (result: unknown, limits?: BuilderModelCall): BuilderTokenUsage | null => {
  const usage = record(record(result)?.totalUsage)
  const inputTokens = tokenCount(usage?.inputTokens)
  const outputTokens = tokenCount(usage?.outputTokens)
  if (inputTokens === null || outputTokens === null) return null
  if (limits && (inputTokens > limits.maxBillableInputTokens * limits.maxSteps || outputTokens > limits.maxOutputTokens * limits.maxSteps)) throw new Error("Builder provider usage exceeds its reserved token envelope.")
  const cachedInputTokens = tokenCount(usage?.cachedInputTokens)
  const cacheCreationInputTokens = tokenCount(usage?.cacheCreationInputTokens)
  if ((cachedInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) > inputTokens) return null
  return { inputTokens, outputTokens, cachedInputTokens, cacheCreationInputTokens }
}

/** Capture complete raw provider usage, including cache writes omitted by SDK totals. */
export const createCustomerUsageCapture = (limits: BuilderModelCall) => {
  const steps: (BuilderStepTokenUsage | null)[] = []
  let active = false
  return {
    begin() {
      if (active || steps.length >= limits.maxSteps) throw new Error("Builder provider retry/step exceeds its reserved envelope.")
      active = true
      steps.push(null)
      return steps.length - 1
    },
    complete(index: number, response: unknown) {
      active = false
      const row = record(response), usage = record(row?.usage), detail = record(usage?.input_tokens_details)
      const inputTokens = tokenCount(usage?.input_tokens), outputTokens = tokenCount(usage?.output_tokens)
      if (!row || !["completed", "incomplete"].includes(String(row.status)) || row.model !== "gpt-5.6-luna" || row.service_tier !== "default" || inputTokens === null || outputTokens === null) return
      if (inputTokens > limits.maxBillableInputTokens || outputTokens > limits.maxOutputTokens) throw new Error("Builder provider usage exceeds its reserved token envelope.")
      const cachedInputTokens = tokenCount(detail?.cached_tokens), cacheCreationInputTokens = tokenCount(detail?.cache_write_tokens)
      if ((cachedInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) > inputTokens) return
      steps[index] = { inputTokens, outputTokens, cachedInputTokens, cacheCreationInputTokens }
    },
    usage(): BuilderTokenUsage | null {
      if (active || !steps.length || steps.some((step) => step === null)) return null
      const complete = steps.filter((step): step is BuilderStepTokenUsage => step !== null)
      const sum = (field: "inputTokens" | "outputTokens") => complete.reduce((total, step) => total + step[field], 0)
      const cache = (field: "cachedInputTokens" | "cacheCreationInputTokens") => complete.some((step) => step[field] === null) ? null : complete.reduce((total, step) => total + (step[field] ?? 0), 0)
      return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), cachedInputTokens: cache("cachedInputTokens"), cacheCreationInputTokens: cache("cacheCreationInputTokens"), stepUsage: complete }
    },
  }
}
export type CustomerUsageCapture = ReturnType<typeof createCustomerUsageCapture>

/** Closed global text-only Responses transport; every wire step has its own capture. */
export const boundedResponsesFetch = (
  executionContext: BuilderExecutionContext,
  limits: BuilderModelCall,
  transport: typeof fetch = fetch,
  capture = createCustomerUsageCapture(limits),
): typeof fetch => async (url, init) => {
  await executionContext.assertActive()
  executionContext.signal.throwIfAborted()
  if (typeof init?.body !== "string" || Buffer.byteLength(init.body, "utf8") > limits.inputBytes) throw new Error("Builder provider input exceeds its reserved UTF-8 request envelope.")
  const address = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
  if (address !== "https://api.openai.com/v1/responses" || init.method !== "POST") throw new Error("Builder provider endpoint is outside the reviewed global contract.")
  const request = record(JSON.parse(init.body)), reasoning = record(request?.reasoning)
  const allowed = ["model", "input", "reasoning", "store", "max_output_tokens", "stream", "tools", "tool_choice", "parallel_tool_calls", "include", "text", "service_tier", "truncation"]
  if (!request || Object.keys(request).some((key) => !allowed.includes(key)) || request.model !== "gpt-5.6-luna" || reasoning?.effort !== limits.reasoningEffort || reasoning.mode !== "standard" || Object.keys(reasoning).some((key) => !["effort", "mode"].includes(key)) || request.service_tier !== "default" || request.truncation !== "disabled" || request.store !== false || request.max_output_tokens !== limits.maxOutputTokens || (request.stream !== undefined && typeof request.stream !== "boolean")) throw new Error("Builder provider request does not match the reserved model/output contract.")
  // The installed SDK automatically requests encrypted reasoning when store=false.
  // Remove only that opt-in, so later steps cannot replay opaque input references.
  if (request.include !== undefined) {
    if (!Array.isArray(request.include) || request.include.length !== 1 || request.include[0] !== "reasoning.encrypted_content") throw new Error("Builder provider does not authorize opaque references.")
    delete request.include
  }
  if (!Array.isArray(request.input) || request.input.some((item: unknown) => {
    const row = record(item)
    if (!row) return true
    if (row.type === "function_call") return typeof row.call_id !== "string" || typeof row.name !== "string" || typeof row.arguments !== "string"
    if (row.type === "function_call_output") return typeof row.call_id !== "string" || typeof row.output !== "string"
    if (!["developer", "system", "user", "assistant"].includes(String(row.role))) return true
    if (typeof row.content === "string") return false
    return !Array.isArray(row.content) || row.content.some((part: unknown) => { const content = record(part); return !content || !["input_text", "output_text"].includes(String(content.type)) || typeof content.text !== "string" || Object.keys(content).some((key) => !["type", "text", "annotations"].includes(key)) })
  })) throw new Error("Builder provider accepts text and scoped function results only.")
  if (request.tools !== undefined && (!Array.isArray(request.tools) || request.tools.some((tool: unknown) => record(tool)?.type !== "function"))) throw new Error("Builder provider does not authorize hosted tools.")
  const wire = JSON.stringify(request)
  if (Buffer.byteLength(wire, "utf8") > limits.inputBytes) throw new Error("Builder provider input exceeds its reserved UTF-8 request envelope.")
  const index = capture.begin()
  const response = await transport(url, { ...init, body: wire, redirect: "error", signal: AbortSignal.any([executionContext.signal, ...(init.signal ? [init.signal] : [])]) })
  if (!response.body) return response
  let bytes = 0
  const chunks: Uint8Array[] = []
  const bodyStream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      executionContext.signal.throwIfAborted()
      bytes += chunk.byteLength
      if (bytes > 262144) throw new Error("Builder provider response exceeds the local byte limit; remote cost remains unknown.")
      chunks.push(chunk); controller.enqueue(chunk)
    },
    flush() {
      executionContext.signal.throwIfAborted()
      const text = Buffer.concat(chunks).toString("utf8")
      let terminal: unknown
      try {
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          const terminals = text.split(/\r?\n\r?\n/).flatMap((frame) => {
            const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n")
            if (!data || data === "[DONE]") return []
            const event = record(JSON.parse(data))
            return event && ["response.completed", "response.incomplete"].includes(String(event.type)) ? [event.response] : []
          })
          if (terminals.length === 1) terminal = terminals[0]
        } else terminal = JSON.parse(text)
      } catch { terminal = undefined }
      capture.complete(index, terminal)
    },
  }))
  return new Response(bodyStream, { status: response.status, statusText: response.statusText, headers: response.headers })
}

export const customerMastraModel = (executionContext: BuilderExecutionContext, limits: BuilderModelCall, capture: CustomerUsageCapture) => {
  const configured = process.env.SITE_GENERATION_MASTRA_MODEL?.trim()
  if (configured && configured !== CUSTOMER_MODEL) throw new Error("Customer builder model override is outside the reviewed candidate family.")
  return createOpenAI({ fetch: boundedResponsesFetch(executionContext, limits, fetch, capture) }).responses("gpt-5.6-luna")
}

export const customerMastraSettings = (executionContext: BuilderExecutionContext, limits: BuilderModelCall) => {
  const remaining = Date.parse(executionContext.deadlineAt) - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Builder execution deadline has expired.")
  return {
    maxSteps: limits.maxSteps,
    abortSignal: executionContext.signal,
    toolCallConcurrency: 1,
    modelSettings: { maxOutputTokens: limits.maxOutputTokens, maxRetries: 0, timeout: { totalMs: remaining, stepMs: Math.min(remaining, 45000) } },
  }
}

export const customerEffort = (value: string): "low" | "medium" => {
  if (value !== "low" && value !== "medium") throw new Error("Customer builder requires a reviewed luna-low or luna-medium candidate.")
  return value
}
