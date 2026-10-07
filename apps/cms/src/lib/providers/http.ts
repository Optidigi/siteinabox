/** A request deadline includes headers, response consumption and bounded read retries. */
export interface ProviderRequestPolicy {
  operation: string
  timeoutMs: number
  maxBodyBytes: number
  readAttempts?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /** Only a documented HTTP 204/205 operation may omit its JSON response. */
  allowEmpty?: boolean
}

export class ProviderBoundaryError extends Error {
  constructor(readonly operation: string, readonly reason: "timeout" | "cancelled" | "body_limit" | "invalid_json" | "transport") {
    super(`${operation}: provider ${reason}.`)
    this.name = "ProviderBoundaryError"
  }
}

export interface ProviderJsonResponse { status: number; ok: boolean; body: unknown }

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) { abort(); return }
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

export async function requestProviderJson(url: string, init: RequestInit, policy: ProviderRequestPolicy): Promise<ProviderJsonResponse> {
  if (!Number.isSafeInteger(policy.timeoutMs) || policy.timeoutMs < 1 || !Number.isSafeInteger(policy.maxBodyBytes) || policy.maxBodyBytes < 1) {
    throw new Error("Invalid provider request policy.")
  }
  const read = (init.method ?? "GET").toUpperCase() === "GET"
  const attempts = read ? policy.readAttempts ?? 2 : 1
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) throw new Error("Invalid provider read retry policy.")
  const controller = new AbortController()
  const cancel = () => controller.abort(new ProviderBoundaryError(policy.operation, "cancelled"))
  if (policy.signal?.aborted || init.signal?.aborted) cancel()
  policy.signal?.addEventListener("abort", cancel, { once: true })
  init.signal?.addEventListener("abort", cancel, { once: true })
  const timer = setTimeout(() => controller.abort(new ProviderBoundaryError(policy.operation, "timeout")), policy.timeoutMs)
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      controller.signal.throwIfAborted()
      let response: Response
      try {
        response = await abortable((policy.fetchImpl ?? fetch)(url, { ...init, redirect: "error", signal: controller.signal }), controller.signal)
      } catch {
        if (controller.signal.aborted) throw controller.signal.reason
        if (attempt < attempts) continue
        throw new ProviderBoundaryError(policy.operation, "transport")
      }
      // Retry only reads. A write may have committed even when its response fails.
      if (read && attempt < attempts && (response.status === 429 || response.status >= 500)) {
        const retryAfter = response.headers.get("retry-after")
        const requestedDelay = retryAfter == null ? 100 * attempt : /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()
        // An excessive provider delay belongs to the durable scheduler, not this request.
        if (Number.isFinite(requestedDelay) && requestedDelay <= 1000) {
          void response.body?.cancel().catch(() => {})
          await abortable(new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, requestedDelay))), controller.signal)
          continue
        }
      }
      const declared = response.headers.get("content-length")
      if (declared && /^\d+$/.test(declared) && Number(declared) > policy.maxBodyBytes) {
        void response.body?.cancel().catch(() => {})
        throw new ProviderBoundaryError(policy.operation, "body_limit")
      }
      const reader = response.body?.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0
      try {
        if (reader) {
          while (true) {
            const chunk = await abortable(reader.read(), controller.signal)
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > policy.maxBodyBytes) throw new ProviderBoundaryError(policy.operation, "body_limit")
            chunks.push(chunk.value)
          }
        }
        const content = Buffer.concat(chunks).toString("utf8")
        if (bytes === 0 && policy.allowEmpty && [204, 205].includes(response.status)) {
          return { status: response.status, ok: response.ok, body: undefined }
        }
        let body: unknown
        try { body = JSON.parse(content) } catch {
          // An HTTP failure remains observable, without passing untrusted error prose.
          // Each adapter decides whether this status is authoritative for its operation.
          if (!response.ok) return { status: response.status, ok: false, body: undefined }
          throw new ProviderBoundaryError(policy.operation, "invalid_json")
        }
        return { status: response.status, ok: response.ok, body }
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        if (error instanceof ProviderBoundaryError) throw error
        throw new ProviderBoundaryError(policy.operation, "transport")
      } finally {
        if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock() }
      }
    }
    throw new ProviderBoundaryError(policy.operation, "transport")
  } finally {
    clearTimeout(timer)
    policy.signal?.removeEventListener("abort", cancel)
    init.signal?.removeEventListener("abort", cancel)
  }
}
