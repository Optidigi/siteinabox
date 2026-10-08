export class BodyReadError extends Error {
  constructor(readonly code: "payload_too_large" | "invalid_json" | "body_timed_out" | "body_aborted") { super(code); this.name = "BodyReadError" }
}

/** Count the actual UTF-8 stream bytes before parsing; headers cannot relax
 * this limit. One deadline covers all chunks and cancels stalled readers. */
export async function readBoundedJSON(req: Request, maxBytes: number, timeoutMs = 5000): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid body read limits")
  const length = req.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new BodyReadError("payload_too_large")
  if (!req.body) throw new BodyReadError("invalid_json")
  const reader = req.body.getReader(), chunks: Uint8Array[] = []
  let bytes = 0
  let abortRead: (() => void) | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  const interrupted = new Promise<never>((_, reject) => {
    abortRead = () => reject(new BodyReadError("body_aborted"))
    req.signal.addEventListener("abort", abortRead, { once: true })
    if (req.signal.aborted) abortRead()
    timeout = setTimeout(() => reject(new BodyReadError("body_timed_out")), timeoutMs)
    timeout.unref?.()
  })
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), interrupted])
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maxBytes) throw new BodyReadError("payload_too_large")
      chunks.push(chunk.value)
    }
    const body = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) }
    catch { throw new BodyReadError("invalid_json") }
  } catch (error) {
    // Underlying cancellation may itself never settle. It does not extend the
    // body's local deadline or retain this handler waiting for remote input.
    void reader.cancel().catch(() => undefined)
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
    if (abortRead) req.signal.removeEventListener("abort", abortRead)
    reader.releaseLock()
  }
}
