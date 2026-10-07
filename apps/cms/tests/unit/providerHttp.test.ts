import { describe, expect, it, vi } from "vitest"
import { requestProviderJson } from "@/lib/providers/http"

const policy = { operation: "Fixture provider", timeoutMs: 1000, maxBodyBytes: 64 }

describe("bounded provider transport", () => {
  it("accepts empty bodies only for explicitly documented no-content operations", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    await expect(requestProviderJson("https://example.invalid", { method: "DELETE" }, { ...policy, fetchImpl })).rejects.toMatchObject({ reason: "invalid_json" })
    expect(await requestProviderJson("https://example.invalid", { method: "DELETE" }, { ...policy, fetchImpl, allowEmpty: true })).toMatchObject({ status: 204, body: undefined })
  })
  it("preserves failure HTTP authority without leaking malformed provider error bodies", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret=private", { status: 401 }))
    expect(await requestProviderJson("https://example.invalid", {}, { ...policy, fetchImpl })).toEqual({ status: 401, ok: false, body: undefined })
  })
  it("leaves excessive Retry-After to the durable scheduler", async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 429, headers: { "retry-after": "60" } }))
    expect(await requestProviderJson("https://example.invalid", {}, { ...policy, fetchImpl })).toMatchObject({ status: 429 })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it("limits streamed bytes even when Content-Length is absent", async () => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(40)); controller.enqueue(new Uint8Array(40)); controller.close()
    } }))
    await expect(requestProviderJson("https://example.invalid", {}, { ...policy, fetchImpl: vi.fn().mockResolvedValue(response) })).rejects.toMatchObject({ reason: "body_limit" })
  })
  it("keeps the deadline active while consuming a stalled body", async () => {
    const cancel = vi.fn()
    const response = new Response(new ReadableStream({ cancel }))
    await expect(requestProviderJson("https://example.invalid", {}, { ...policy, timeoutMs: 20, fetchImpl: vi.fn().mockResolvedValue(response) })).rejects.toMatchObject({ reason: "timeout" })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("does not expose invalid provider JSON in diagnostics", async () => {
    await expect(requestProviderJson("https://example.invalid", {}, { ...policy, fetchImpl: vi.fn().mockResolvedValue(new Response("secret=private")) })).rejects.toMatchObject({ message: "Fixture provider: provider invalid_json." })
  })
  it("retries transient reads within a bounded attempt budget", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 429 })).mockResolvedValueOnce(Response.json({ value: "ok" }))
    expect(await requestProviderJson("https://example.invalid", {}, { ...policy, fetchImpl })).toMatchObject({ body: { value: "ok" } })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" })
  })
  it("makes a write once despite a transient server response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({}, { status: 503 }))
    expect(await requestProviderJson("https://example.invalid", { method: "POST" }, { ...policy, fetchImpl })).toMatchObject({ status: 503 })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it("honors caller cancellation without sending a request", async () => {
    const controller = new AbortController(); controller.abort()
    const fetchImpl = vi.fn()
    await expect(requestProviderJson("https://example.invalid", {}, { ...policy, signal: controller.signal, fetchImpl })).rejects.toMatchObject({ reason: "cancelled" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
