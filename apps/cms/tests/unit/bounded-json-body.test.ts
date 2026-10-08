import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readBoundedJSON } from "@/lib/http/body"

const request = (stream: ReadableStream<Uint8Array>, signal?: AbortSignal, headers?: HeadersInit) => new NextRequest("https://admin.siteinabox.nl/api/fixture", { method: "POST", body: stream, signal, headers })
const encodedStream = (...chunks: string[]) => new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close() } })
afterEach(() => vi.useRealTimers())
describe("bounded JSON body stream", () => {
  it("parses bounded chunked JSON without requiring content-length", async () => {
    expect(await readBoundedJSON(request(encodedStream('{"message":', '"Bäckerei"}')), 64)).toEqual({ message: "Bäckerei" })
  })
  it("counts actual multibyte bytes even when a smaller content-length is supplied", async () => {
    await expect(readBoundedJSON(request(encodedStream('{"message":"', "é".repeat(20), '"}'), undefined, { "content-length": "2" }), 32)).rejects.toThrow("payload_too_large")
  })
  it("aborts a stalled stream at the whole-body deadline and does not await hung cancellation", async () => {
    vi.useFakeTimers()
    const cancel = vi.fn(() => new Promise<void>(() => undefined))
    const req = request(new ReadableStream<Uint8Array>({ cancel }))
    const reading = readBoundedJSON(req, 32, 5000)
    const assertion = expect(reading).rejects.toThrow("body_timed_out")
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("observes request cancellation while reading and closes its reader", async () => {
    const controller = new AbortController(), cancel = vi.fn()
    const reading = readBoundedJSON(request(new ReadableStream<Uint8Array>({ cancel }), controller.signal), 32)
    const assertion = expect(reading).rejects.toThrow("body_aborted")
    controller.abort()
    await assertion
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("rejects malformed UTF-8 and invalid JSON before callers can admit work", async () => {
    const invalidUTF8 = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close() } })
    await expect(readBoundedJSON(request(invalidUTF8), 32)).rejects.toThrow("invalid_json")
    await expect(readBoundedJSON(request(encodedStream("{broken}")), 32)).rejects.toThrow("invalid_json")
  })
})
