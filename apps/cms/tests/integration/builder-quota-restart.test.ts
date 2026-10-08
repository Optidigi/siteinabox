import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { once } from "node:events"
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { getTestPayload } from "./_helpers"
import { BuilderQuotaService } from "@/lib/builder/quota"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Worker restart integration requires isolated test PG, disabled jobs and mock Sitegen")
  payload = await getTestPayload()
}, 60_000)

const startWorker = (mode: "reserve" | "reconcile", email: string, operationId: string) => {
  const child = spawn(process.execPath, ["--import", path.resolve(import.meta.dirname, "../fixtures/builder-quota-loader.mjs"), "--import", "tsx", path.resolve(import.meta.dirname, "../fixtures/builder-quota-worker.ts"), mode, email, operationId], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] })
  // No credentials or raw child stderr are printed into the test reporter.
  let diagnostic = ""
  child.stderr.on("data", (chunk: Buffer) => {
    const sanitized = chunk.toString("utf8").replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/g, "[redacted URL]")
    diagnostic = (diagnostic + sanitized).slice(-4096)
  })
  let buffer = ""
  const receipt = new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Quota worker receipt timed out")) }, 20_000)
    child.once("error", (error) => { clearTimeout(timeout); reject(error) })
    child.once("exit", (code, signal) => { clearTimeout(timeout); reject(new Error(`Quota worker exited before receipt (${code ?? signal}): ${diagnostic.split("\n").filter((line) => line.length < 300 && !line.includes("sourceMappingURL") && !line.trimStart().startsWith("at ")).join(" | ")}`)) })
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8")
      if (buffer.length > 256 * 1024) { clearTimeout(timeout); child.kill("SIGKILL"); reject(new Error("Quota worker output exceeds fixture bound")); return }
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) if (line.startsWith("quota-worker:")) {
        clearTimeout(timeout)
        try { const value: unknown = JSON.parse(line.slice("quota-worker:".length)); resolve(value) }
        catch { reject(new Error("Malformed quota worker receipt")) }
      }
    })
  })
  return { child, receipt }
}

describe("durable builder worker process restart", () => {
  it("reconciles a SIGKILLed executor in a fresh process without replay and preserves unknown provider liability", async () => {
    const service = new BuilderQuotaService(payload)
    await service.initialize()
    const email = "quota-restart@example.test", operationId = randomUUID()
    const producer = startWorker("reserve", email, operationId)
    try {
      const dispatched = z.object({ phase: z.literal("dispatched"), operationKey: z.string() }).parse(await producer.receipt)
      expect(await service.operation(dispatched.operationKey)).toMatchObject({ state: "running", modelCalls: 1, outstandingCalls: 1 })
      const stopped = once(producer.child, "exit")
      producer.child.kill("SIGKILL")
      await stopped
      const recovery = startWorker("reconcile", email, operationId)
      try {
        const reconciled = z.object({ phase: z.literal("reconciled"), first: z.object({ settled: z.number(), quarantined: z.number() }), second: z.object({ examined: z.number(), settled: z.number() }), operation: z.object({ state: z.literal("interrupted"), modelCalls: z.literal(1), outstandingCalls: z.literal(1), slotHeld: z.literal(true), costKnown: z.literal(false) }), account: z.object({ visibleUsed: z.literal(0), visibleReserved: z.literal(0), activeOperationKey: z.string(), chargedCostUnits: z.literal(200000), attempts: z.literal(2) }), global: z.object({ activeOperations: z.literal(1), chargedCostUnits: z.literal(200000) }) }).parse(await recovery.receipt)
        expect(reconciled.first).toMatchObject({ settled: 1, quarantined: 1 })
        expect(reconciled.second).toMatchObject({ examined: 0, settled: 0 })
        expect(reconciled.account.activeOperationKey).toBe(dispatched.operationKey)
      } finally { recovery.child.kill("SIGKILL") }
    } finally { producer.child.kill("SIGKILL") }
  }, 60_000)
})
