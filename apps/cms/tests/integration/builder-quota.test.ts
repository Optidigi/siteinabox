import { randomUUID } from "node:crypto"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { getTestPayload } from "./_helpers"
import { BuilderQuotaService, type BuilderAdmission, type BuilderOperationLease } from "@/lib/builder/quota"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { loadBuilderThread } from "@/lib/builder/sessionStore"
import { assertBuilderAccountEligible } from "@/lib/builder/access"

const deferred = <T>() => {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => { complete = resolve })
  return { promise, resolve: (value: T) => { if (!complete) throw new Error("Deferred initialization failed"); complete(value) } }
}

let payload: Awaited<ReturnType<typeof getTestPayload>>
let service: BuilderQuotaService
const eligible = async () => undefined
const accountEmail = "quota-fixture@example.test"
const policy = { ...builderQuotaPolicy, enabled: true, transactionRetries: 5 }
const input = (operationId = randomUUID()) => ({ operationId, message: "Build a fixture bakery" })
const thread = (email = accountEmail) => ({ customerEmail: email, displayName: "Quota fixture", contactPhone: "", legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false }, facts: null, clientSlug: null, messages: [] })
const terminal = { ok: true, text: "Fixture clarification completed.", messages: [] }
const leaseFrom = (value: BuilderAdmission): BuilderOperationLease => {
  if (value.status !== "reserved") throw new Error(`Expected reservation, received ${value.status}`)
  return value.lease
}
const claim = async (email = accountEmail) => {
  const lease = leaseFrom(await service.reserve(email, input(), eligible))
  await service.claim(lease, eligible)
  return lease
}
const call = { model: "openai/gpt-5.6-luna", reasoningEffort: "low", inputBytes: 100, maxOutputTokens: 100, maxSteps: 1 } as const
const usage = { inputTokens: 100, outputTokens: 100, cachedInputTokens: 0, cacheCreationInputTokens: 0 }

beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Quota integration requires isolated payload_test, disabled jobs and mock Sitegen.")
  payload = await getTestPayload()
}, 60_000)
beforeEach(async () => {
  // The harness already rebuilt the disposable DB. This suite owns only its
  // quota/thread fixtures; never clean durable accounting in application jobs.
  for (const collection of ["builder-operations", "builder-quota-accounts", "builder-quota-global", "builder-sessions"] as const) {
    const rows = await payload.find({ collection, limit: 1000, overrideAccess: true, depth: 0 })
    for (const row of rows.docs) await payload.delete({ collection, id: row.id, overrideAccess: true })
  }
  service = new BuilderQuotaService(payload, policy)
  await service.initialize()
})
afterEach(() => vi.restoreAllMocks())

describe("durable quota on real PostgreSQL", () => {
  it("counts twelve lifetime successful turns including initial/clarification/refusal; thirteenth and thread deletion do not reset", async () => {
    for (let turn = 0; turn < 12; turn++) {
      const lease = await claim()
      const result = { ...terminal, text: turn === 0 ? "Initial generation" : turn === 11 ? "Supported refusal" : "Clarification" }
      const quota = await service.settle(lease, eligible, { thread: thread(), result })
      expect(quota).toMatchObject({ used: turn + 1, reserved: 0, remaining: 11 - turn })
    }
    const sessions = await payload.find({ collection: "builder-sessions", overrideAccess: true })
    for (const row of sessions.docs) await payload.delete({ collection: "builder-sessions", id: row.id, overrideAccess: true })
    expect(await service.reserve(accountEmail, input(), eligible)).toMatchObject({ status: "denied", reason: "quota_exhausted", quota: { used: 12, remaining: 0 } })
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 12, visibleReserved: 0, attempts: 12 })
  })
  it("limits authenticated ingress independently of visible turns and rolls over only the daily request counters", async () => {
    for (let request = 0; request < 200; request++) expect(await service.consumeIngress(accountEmail)).toBe(true)
    expect(await service.consumeIngress(accountEmail)).toBe(false)
    const lease = await claim()
    const before = await service.account(accountEmail)
    expect(before).toMatchObject({ visibleUsed: 0, visibleReserved: 1, activeOperationKey: lease.operationKey, ingressRequests: 200 })
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 86400000)
    expect(await service.consumeIngress(accountEmail)).toBe(true)
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 0, visibleReserved: 1, activeOperationKey: lease.operationKey, chargedCostUnits: 200000, attempts: 1, ingressRequests: 1 })
  }, 60_000)
  it("enforces the independent global ingress ceiling without touching technical/visible counters", async () => {
    await service.transaction(async (req) => {
      const global = await service.lockGlobal(req)
      const { quotaGlobalSchema } = await import("@/lib/builder/quotaSchemas")
      await service.cas("builder-quota-global", global, { ingressDay: new Date(Date.now()).toISOString().slice(0, 10), ingressRequests: 9999 }, quotaGlobalSchema, req)
    })
    expect(await service.consumeIngress(accountEmail)).toBe(true)
    expect(await service.consumeIngress("quota-other@example.test")).toBe(false)
    expect(await service.global()).toMatchObject({ ingressRequests: 10000, attempts: 0, activeOperations: 0, chargedCostUnits: 0 })
  })
  it("requires its own ingress nonce after rollback even when another same-account request commits identical numeric counters", async () => {
    const rollback = payload.db.rollbackTransaction.bind(payload.db)
    vi.spyOn(payload.db, "commitTransaction").mockImplementationOnce(async (id) => {
      await rollback(id)
      expect(await service.consumeIngress(accountEmail)).toBe(true)
    })
    await expect(service.consumeIngress(accountEmail)).rejects.toThrow("builder_ingress_commit_unverified")
    expect(await service.account(accountEmail)).toMatchObject({ ingressRequests: 1, visibleUsed: 0, attempts: 0 })
    expect(await service.global()).toMatchObject({ ingressRequests: 1, attempts: 0 })
  })
  it("deduplicates eight same-UUID requests, caches terminal result and rejects changed text", async () => {
    const request = input()
    const contenders = await Promise.allSettled(Array.from({ length: 8 }, () => service.reserve(accountEmail, request, eligible)))
    expect(contenders.every((result) => result.status === "fulfilled")).toBe(true)
    const winners = contenders.flatMap((result) => result.status === "fulfilled" && result.value.status === "reserved" ? [result.value] : [])
    expect(winners).toHaveLength(1)
    const lease = leaseFrom(winners[0]!)
    await service.claim(lease, eligible)
    await service.settle(lease, eligible, { thread: thread(), result: terminal })
    expect(await service.reserve(accountEmail, request, eligible)).toMatchObject({ status: "complete", result: terminal })
    expect(await service.reserve(accountEmail, { ...request, message: "Changed text" }, eligible)).toMatchObject({ status: "denied", reason: "operation_conflict" })
    const rows = await payload.find({ collection: "builder-operations", overrideAccess: true })
    expect(rows.docs).toHaveLength(1)
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 1, attempts: 1 })
  })
  it("allows only one account operation and at most the bounded global slots", async () => {
    const contenders = await Promise.allSettled(Array.from({ length: 30 }, () => service.reserve(accountEmail, input(), eligible)))
    const winners = contenders.flatMap((result) => result.status === "fulfilled" && result.value.status === "reserved" ? [result.value] : [])
    expect(winners).toHaveLength(1)
    const other = await service.reserve("quota-other@example.test", input(), eligible)
    expect(other.status).toBe("reserved")
    expect(await service.reserve("quota-third@example.test", input(), eligible)).toMatchObject({ status: "denied", reason: "busy" })
    expect(await service.global()).toMatchObject({ activeOperations: 2, chargedCostUnits: 400000 })
  })
  it("rolls back all three records when operation creation fails after both ledger writes", async () => {
    const create = payload.db.create.bind(payload.db)
    vi.spyOn(payload.db, "create").mockImplementation(async (args) => {
      if (args.collection === "builder-operations") throw new Error("Synthetic operation insert failure")
      return create(args)
    })
    await expect(service.reserve(accountEmail, input(), eligible)).rejects.toThrow("Synthetic operation insert failure")
    expect(await service.global()).toMatchObject({ activeOperations: 0, chargedCostUnits: 0, attempts: 0 })
    expect(await service.account(accountEmail)).toBeNull()
    expect((await payload.find({ collection: "builder-operations", overrideAccess: true })).docs).toHaveLength(0)
  })
  it("blocks model dispatch after a swallowed commit that actually rolled back", async () => {
    const lease = await claim(), execution = new ReservedBuilderExecution(service, lease, eligible)
    const rollback = payload.db.rollbackTransaction.bind(payload.db)
    vi.spyOn(payload.db, "commitTransaction").mockImplementation(async (id) => { await rollback(id) })
    const provider = vi.fn(async () => "response")
    await expect(execution.modelCall(call, provider, () => usage)).rejects.toThrow("builder_write_commit_unverified")
    expect(provider).not.toHaveBeenCalled()
    execution.dispose()
  })
  it("rejects a disappeared live SDK session before any fallback DB call", async () => {
    await service.transaction(async (req) => {
      const id = req.transactionID
      if (typeof id !== "number" && typeof id !== "string") throw new Error("Expected scalar owned transaction")
      const sessions = payload.db.sessions, session = sessions?.[String(id)]
      if (!sessions || !session) throw new Error("Expected installed live transaction session")
      const find = vi.spyOn(payload, "find")
      delete sessions[String(id)]
      try {
        await expect(service.account(accountEmail, req)).rejects.toThrow("builder_transaction_lost")
        expect(find).not.toHaveBeenCalled()
      } finally { sessions[String(id)] = session }
    })
  })
  it("fences expired failed-result thread saves while still allowing ledger-only failure release", async () => {
    const lease = await claim()
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(lease.deadlineAt) + 1)
    await expect(service.settle(lease, eligible, { thread: { ...thread(), displayName: "Late overwritten fixture" }, result: { ...terminal, ok: false, error: "synthetic_failure" } })).rejects.toThrow("builder_deadline_exceeded")
    expect(await loadBuilderThread(payload, accountEmail)).toBeNull()
    await service.fail(lease, "builder_deadline_exceeded", true)
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 0, visibleReserved: 0 })
  })
  it("releases failed visible turns but keeps known incurred cost and technical attempts", async () => {
    const lease = await claim(), execution = new ReservedBuilderExecution(service, lease, eligible)
    await execution.modelCall(call, async () => "complete response", () => usage)
    await service.fail(lease, "synthetic_customer_failure", true)
    await service.fail(lease, "duplicate_failure", true)
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 140, attempts: 2 })
    expect(await service.global()).toMatchObject({ activeOperations: 0, chargedCostUnits: 140, attempts: 2 })
    execution.dispose()
  })
  it("retains unknown cost and quarantines an abort-ignoring provider slot", async () => {
    const lease = await claim(), disconnect = new AbortController()
    const execution = new ReservedBuilderExecution(service, lease, eligible, disconnect.signal)
    const providerStarted = deferred<void>()
    const remote = deferred<string>()
    const running = execution.modelCall(call, () => { providerStarted.resolve(undefined); return remote.promise }, () => usage)
    await providerStarted.promise
    disconnect.abort()
    await expect(running).rejects.toThrow("builder_execution_aborted")
    await service.fail(lease, "synthetic_disconnect", true)
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 200000 })
    expect(await service.global()).toMatchObject({ activeOperations: 1, chargedCostUnits: 200000 })
    expect(await service.reserve(accountEmail, input(), eligible)).toMatchObject({ status: "denied", reason: "busy" })
    expect(await service.operation(lease.operationKey)).toMatchObject({ state: "failed", slotHeld: true, costKnown: false, outstandingCalls: 1 })
    remote.resolve("Late response")
    await Promise.resolve()
    await expect(execution.withWrite(async () => undefined)).rejects.toThrow()
    execution.dispose()
  })
  it("reconciles expired reservations once without replay and rejects a stale lease/ABA token", async () => {
    const lease = leaseFrom(await service.reserve(accountEmail, input(), eligible))
    const now = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(now + policy.operationTimeoutMs + 1)
    const first = await service.reconcile(), second = await service.reconcile()
    expect(first).toMatchObject({ examined: 1, settled: 1, quarantined: 0 })
    expect(second).toMatchObject({ examined: 0, settled: 0, quarantined: 0 })
    expect(await service.account(accountEmail)).toMatchObject({ visibleUsed: 0, visibleReserved: 0, attempts: 1 })
    await expect(service.claim(lease, eligible)).rejects.toThrow("builder_lease_lost")
    await expect(service.readLease({ ...lease, reservationToken: randomUUID() })).rejects.toThrow("builder_lease_lost")
  })
  it("executes actual Payload authority hooks with a live transaction before collection validation", async () => {
    const before = await service.global()
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Quota hook fixture", slug: "quota-hook-fixture", domain: "quota-hook.example.test", status: "active" } })
    const after = await service.global()
    expect(after.revision).toBeGreaterThan(before.revision)
    expect(after.activeOperations).toBe(0)
    await payload.update({ collection: "tenants", id: tenant.id, overrideAccess: true, data: { status: "archived" } })
    expect((await service.global()).revision).toBeGreaterThan(after.revision)
  })
  it("holds the actual short transaction across tool writes and rolls back on purchase fence failure", async () => {
    const lease = await claim()
    let fenced = false
    const authority = async () => { if (fenced) throw new Error("post_purchase_ai_disabled") }
    const execution = new ReservedBuilderExecution(service, lease, authority)
    await expect(execution.withWrite(async (req) => {
      await payload.create({ collection: "builder-sessions", req, overrideAccess: true, data: { ...thread(), messages: [], legal: thread().legal } })
      fenced = true
    })).rejects.toThrow("post_purchase_ai_disabled")
    expect(await loadBuilderThread(payload, accountEmail)).toBeNull()
    execution.dispose()
  })
  it("checks real membership authority before admission even if the request claims a free account", async () => {
    await payload.create({ collection: "users", overrideAccess: true, data: { email: accountEmail, role: "super-admin", password: "synthetic-fixture-only" } })
    await expect(service.reserve(accountEmail, input(), (req) => assertBuilderAccountEligible(payload, accountEmail, req))).rejects.toThrow("builder_customer_cms_only")
    expect(await service.account(accountEmail)).toBeNull()
  })
})
