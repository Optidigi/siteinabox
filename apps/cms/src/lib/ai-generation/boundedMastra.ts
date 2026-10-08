import { createOpenAI } from "@ai-sdk/openai"
import type { BuilderExecutionContext, BuilderModelCall, BuilderTokenUsage } from "@/lib/builder/executionContext"

export const CUSTOMER_MODEL = "openai/gpt-5.6-luna" as const
export const CUSTOMER_INPUT_BYTES = 65536
// Reserve room for protocol framing in addition to the complete text-only HTTP body.
// This inference remains an activation gate until the provider framing contract is established.
export const CUSTOMER_PROTOCOL_ALLOWANCE = 4096
export const customerModelLimits = (effort: "low" | "medium", generation = false): BuilderModelCall => ({
  model: CUSTOMER_MODEL,
  reasoningEffort: effort,
  inputBytes: CUSTOMER_INPUT_BYTES,
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
  if (limits && (inputTokens > limits.inputBytes * limits.maxSteps || outputTokens > limits.maxOutputTokens * limits.maxSteps)) throw new Error("Builder provider usage exceeds its reserved token envelope.")
  const cachedInputTokens = tokenCount(usage?.cachedInputTokens)
  const cacheCreationInputTokens = tokenCount(usage?.cacheCreationInputTokens)
  if ((cachedInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) > inputTokens) return null
  return { inputTokens, outputTokens, cachedInputTokens, cacheCreationInputTokens }
}

/** Closed text-only Responses transport. Bound the actual UTF-8 SDK wire body on EVERY step. */
export const boundedResponsesFetch = (
  executionContext: BuilderExecutionContext,
  limits: BuilderModelCall,
  transport: typeof fetch = fetch,
): typeof fetch => async (url, init) => {
  await executionContext.assertActive()
  executionContext.signal.throwIfAborted()
  if (typeof init?.body !== "string" || Buffer.byteLength(init.body, "utf8") > limits.inputBytes - CUSTOMER_PROTOCOL_ALLOWANCE) {
    throw new Error("Builder provider input exceeds its reserved UTF-8 request envelope.")
  }
  const body: unknown = JSON.parse(init.body)
  const request = record(body)
  const reasoning = record(request?.reasoning)
  if (request?.model !== "gpt-5.6-luna" || reasoning?.effort !== limits.reasoningEffort
    || request.store !== false || request.previous_response_id !== undefined
    || request.max_output_tokens !== limits.maxOutputTokens || (request.stream !== undefined && typeof request.stream !== "boolean")) {
    throw new Error("Builder provider request does not match the reserved model/output contract.")
  }
  // Only text input/function tools; no media, hosted tools, external purchases or executable authority.
  const input = request.input
  if (!Array.isArray(input) || input.some((item: unknown) => {
    const row = record(item)
    if (!row) return true
    if (row.type === "function_call" || row.type === "function_call_output") return false
    if (typeof row.content === "string") return !["developer", "system", "user", "assistant"].includes(String(row.role))
    return !Array.isArray(row.content) || row.content.some((part: unknown) => {
      const content = record(part)
      return content?.type !== "input_text" && content?.type !== "output_text"
    })
  })) throw new Error("Builder provider accepts text and scoped function results only.")
  if (Array.isArray(request.tools) && request.tools.some((tool: unknown) => record(tool)?.type !== "function")) {
    throw new Error("Builder provider does not authorize hosted tools.")
  }
  const response = await transport(url, { ...init, signal: AbortSignal.any([executionContext.signal, ...(init.signal ? [init.signal] : [])]) })
  if (!response.body) return response
  let bytes = 0
  const bodyStream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      executionContext.signal.throwIfAborted()
      bytes += chunk.byteLength
      if (bytes > 262144) throw new Error("Builder provider response exceeds the local byte limit; remote cost remains unknown.")
      controller.enqueue(chunk)
    },
  }))
  return new Response(bodyStream, { status: response.status, statusText: response.statusText, headers: response.headers })
}

export const customerMastraModel = (executionContext: BuilderExecutionContext, limits: BuilderModelCall) => {
  const configured = process.env.SITE_GENERATION_MASTRA_MODEL?.trim()
  if (configured && configured !== CUSTOMER_MODEL) throw new Error("Customer builder model override is outside the reviewed candidate family.")
  return createOpenAI({ fetch: boundedResponsesFetch(executionContext, limits) }).responses("gpt-5.6-luna")
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
