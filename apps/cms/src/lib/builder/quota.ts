import "server-only"
import type { PostgresAdapter } from "@payloadcms/db-postgres"
import { is } from "drizzle-orm"
import { PgTransaction } from "drizzle-orm/pg-core"
import { createHash, randomUUID } from "node:crypto"
import type { Payload, PayloadRequest, Where } from "payload"
import { z } from "zod"
import { builderQuotaPolicy, BuilderQuotaPolicySchema, type BuilderQuotaPolicy } from "./quotaPolicy"
import { builderOperationInputSchema, builderSettlementSchema, quotaAccountSchema, quotaGlobalSchema, quotaOperationSchema, type BuilderOperationInput, type BuilderTerminalResult, type QuotaAccount, type QuotaGlobal, type QuotaOperation } from "./quotaSchemas"
import { normalizeBuilderEmail } from "./thread"
import { loadBuilderThread, saveBuilderThread } from "./sessionStore"
import { assertLiveBuilderTransaction } from "./quotaTransaction"
export { assertLiveBuilderTransaction } from "./quotaTransaction"

// The public entity guard supports SDK handles across peer-flavored copies.
// Refine to the pinned SDK's own public session type: returning the direct
// dependency's constructor type would introduce nominal protected-schema drift.
// Called only on the live SDK-created session after adapter/session validation.
type SDKTransactionDB = NonNullable<PostgresAdapter["sessions"]>[string]["db"]
const isSDKPostgresTransaction = (value: unknown): value is SDKTransactionDB => is(value, PgTransaction)

export class BuilderQuotaError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "BuilderQuotaError" }
}
class RetryTransaction extends BuilderQuotaError { constructor() { super("builder_quota_contention") } }
export type BuilderQuotaView = Readonly<{ limit: number; used: number; reserved: number; remaining: number }>
export type BuilderOperationLease = Readonly<{ operationKey: string; reservationToken: string; deadlineAt: string; customerEmail: string }>
export type BuilderAdmission =
  | { status: "reserved"; lease: BuilderOperationLease; quota: BuilderQuotaView }
  | { status: "complete"; result: BuilderTerminalResult; quota: BuilderQuotaView }
  | { status: "pending"; operationId: string; quota: BuilderQuotaView }
  | { status: "denied"; reason: string; quota: BuilderQuotaView }
export type BuilderEligibilityCheck = (req?: Partial<PayloadRequest>) => Promise<void>
type Collection = "builder-quota-global" | "builder-quota-accounts" | "builder-operations"
type Scalars = Record<string, string | number | boolean | null>
const isTerminal = (op: QuotaOperation) => ["succeeded", "failed", "interrupted"].includes(op.state)
export const builderOperationKey = (email: string, operationId: string) => createHash("sha256").update(JSON.stringify([normalizeBuilderEmail(email), operationId])).digest("hex")
const messageHash = (input: BuilderOperationInput) => createHash("sha256").update(JSON.stringify([input.message, input.locale ?? "nl"])).digest("hex")

export class BuilderQuotaService {
  readonly policy: BuilderQuotaPolicy
  constructor(readonly payload: Payload, policy: BuilderQuotaPolicy = builderQuotaPolicy) { this.policy = BuilderQuotaPolicySchema.parse(policy) }
  view(account?: QuotaAccount | null): BuilderQuotaView {
    const used = account?.visibleUsed ?? 0, reserved = account?.visibleReserved ?? 0
    return { limit: this.policy.visibleLimit, used, reserved, remaining: Math.max(0, this.policy.visibleLimit - used - reserved) }
  }
  async find<C extends Collection>(collection: C, where: Where, req?: Partial<PayloadRequest>) {
    if (req) assertLiveBuilderTransaction(this.payload, req)
    return this.payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true, req })
  }
  async operation(key: string, req?: Partial<PayloadRequest>): Promise<QuotaOperation | null> {
    const found = await this.find("builder-operations", { operationKey: { equals: key } }, req)
    return found.docs[0] ? quotaOperationSchema.parse(found.docs[0]) : null
  }
  async account(email: string, req?: Partial<PayloadRequest>): Promise<QuotaAccount | null> {
    const found = await this.find("builder-quota-accounts", { customerEmail: { equals: email } }, req)
    return found.docs[0] ? quotaAccountSchema.parse(found.docs[0]) : null
  }
  async global(req?: Partial<PayloadRequest>): Promise<QuotaGlobal> {
    const found = await this.find("builder-quota-global", { key: { equals: "builder" } }, req)
    if (!found.docs[0]) throw new BuilderQuotaError("builder_ledger_not_initialized")
    return quotaGlobalSchema.parse(found.docs[0])
  }
  // Idempotent local bootstrap only. Unique index chooses one singleton;
  // no admission or model call is allowed before durable readback.
  async initialize(req?: Partial<PayloadRequest>): Promise<void> {
    const found = await this.find("builder-quota-global", { key: { equals: "builder" } }, req)
    if (!found.docs[0]) {
      try {
        if (req) assertLiveBuilderTransaction(this.payload, req)
        await this.payload.create({ collection: "builder-quota-global", req, data: { key: "builder", activeOperations: 0, chargedCostUnits: 0, attempts: 0, revision: 0, ingressDay: new Date(Date.now()).toISOString().slice(0, 10), ingressRequests: 0 }, overrideAccess: true }) }
      catch (error) {
        // A unique conflict aborts a Postgres transaction; never continue using
        // that transaction. An outside bootstrap loser may safely read back.
        if (req) throw error
      }
    }
    await this.global(req)
  }
  // Daily verified-account ingress is independent of visible credits and
  // technical calls. Invalid/conflicting/busy/replayed submissions count too.
  async consumeIngress(email: string): Promise<boolean> {
    const customerEmail = z.email().parse(normalizeBuilderEmail(email))
    await this.initialize()
    const today = new Date(Date.now()).toISOString().slice(0, 10), ingressToken = randomUUID()
    const receipt = await this.retry(() => this.transaction(async (req) => {
      const global = await this.lockGlobal(req)
      let owner = await this.account(customerEmail, req)
      if (!owner) {
        assertLiveBuilderTransaction(this.payload, req)
        owner = quotaAccountSchema.parse(await this.payload.create({ collection: "builder-quota-accounts", req, overrideAccess: true, data: {
          customerEmail, visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 0, attempts: 0, revision: 0,
          ingressDay: today, ingressRequests: 0, lastActivityAt: new Date(Date.now()).toISOString(),
        } }))
      }
      const accountRequests = owner.ingressDay === today ? owner.ingressRequests : 0
      const globalRequests = global.ingressDay === today ? global.ingressRequests : 0
      if (accountRequests >= 200 || globalRequests >= 10000) return null
      const nextGlobal = await this.cas("builder-quota-global", global, { ingressDay: today, ingressRequests: globalRequests + 1 }, quotaGlobalSchema, req)
      const nextOwner = await this.cas("builder-quota-accounts", owner, { ingressDay: today, ingressRequests: accountRequests + 1, ingressToken, lastActivityAt: new Date(Date.now()).toISOString() }, quotaAccountSchema, req)
      return { globalRevision: nextGlobal.revision, accountRevision: nextOwner.revision, requests: accountRequests + 1 }
    }))
    if (!receipt) return false
    const durableGlobal = await this.global(), durableOwner = await this.account(customerEmail)
    if (!durableOwner || durableOwner.ingressDay !== today || durableGlobal.ingressDay !== today || durableOwner.ingressToken !== ingressToken || durableOwner.ingressRequests < receipt.requests || durableOwner.revision < receipt.accountRevision || durableGlobal.revision < receipt.globalRevision) throw new BuilderQuotaError("builder_ingress_commit_unverified")
    return true
  }
  async transaction<T>(work: (req: Partial<PayloadRequest>) => Promise<T>): Promise<T> {
    if (this.payload.db.name !== "postgres") throw new BuilderQuotaError("builder_transactions_required")
    const transactionID = await this.payload.db.beginTransaction()
    if (transactionID == null) throw new BuilderQuotaError("builder_transactions_required")
    const req: Partial<PayloadRequest> = { transactionID }
    try {
      assertLiveBuilderTransaction(this.payload, req)
      const session = this.payload.db.sessions?.[String(transactionID)]
      if (!session || !isSDKPostgresTransaction(session.db)) throw new BuilderQuotaError("builder_transaction_lost")
      const transactionDB = session.db
      // These SET LOCAL statements use the owned transaction's actual DB,
      // never the adapter's root connection. Bound lock/query/idle waits.
      for (const raw of ["SET LOCAL lock_timeout = '5s'", "SET LOCAL statement_timeout = '5s'", "SET LOCAL idle_in_transaction_session_timeout = '10s'"]) {
        assertLiveBuilderTransaction(this.payload, req)
        if (this.payload.db.sessions?.[String(transactionID)]?.db !== transactionDB) throw new BuilderQuotaError("builder_transaction_lost")
        await this.payload.db.execute({ db: transactionDB, raw })
      }
      const result = await work(req)
      assertLiveBuilderTransaction(this.payload, req)
      await this.payload.db.commitTransaction(transactionID)
      return result
    } catch (error) {
      await this.payload.db.rollbackTransaction(transactionID).catch(() => undefined)
      throw error
    }
  }
  async cas<T extends { id: number; revision: number }>(collection: Collection, original: T, data: Scalars, schema: z.ZodType<T>, req: Partial<PayloadRequest>): Promise<T> {
    assertLiveBuilderTransaction(this.payload, req)
    const update = { ...data, revision: original.revision + 1 }
    const receipt: unknown = await this.payload.db.updateOne({ collection, req,
      where: { and: [{ id: { equals: original.id } }, { revision: { equals: original.revision } }] },
      data: update, options: { atomic: true }, returning: true })
    if (receipt === null) throw new RetryTransaction()
    const parsed = schema.parse(receipt)
    const fields = z.record(z.string(), z.unknown()).parse(receipt)
    if (parsed.id !== original.id || Object.entries(update).some(([key, value]) => fields[key] !== value)) throw new BuilderQuotaError("builder_atomic_receipt_invalid")
    const prior = z.record(z.string(), z.unknown()).parse(original)
    for (const key of ["key", "customerEmail", "operationKey", "operationId", "messageHash", "reservationToken"]) {
      if (prior[key] !== undefined && fields[key] !== prior[key]) throw new BuilderQuotaError("builder_atomic_identity_invalid")
    }
    return parsed
  }
  async lockGlobal(req: Partial<PayloadRequest>): Promise<QuotaGlobal> {
    const global = await this.global(req)
    return this.cas("builder-quota-global", global, {}, quotaGlobalSchema, req)
  }
  async retry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.policy.transactionRetries; attempt++) {
      try { return await work() } catch (error) {
        if (!(error instanceof RetryTransaction) || attempt === this.policy.transactionRetries - 1) throw error
      }
    }
    throw new BuilderQuotaError("builder_quota_contention")
  }
  replay(op: QuotaOperation, hash: string, quota: BuilderQuotaView): BuilderAdmission {
    if (op.messageHash !== hash) return { status: "denied", reason: "operation_conflict", quota }
    if (isTerminal(op)) {
      if (op.result) return { status: "complete", result: op.result, quota }
      return { status: "denied", reason: op.errorCode ?? "operation_interrupted", quota }
    }
    return { status: "pending", operationId: op.operationId, quota }
  }
  async reserve(email: string, raw: BuilderOperationInput, eligible: BuilderEligibilityCheck): Promise<BuilderAdmission> {
    const customerEmail = z.email().parse(normalizeBuilderEmail(email))
    const input = builderOperationInputSchema.parse(raw), key = builderOperationKey(customerEmail, input.operationId), hash = messageHash(input)
    await eligible()
    const prior = await this.operation(key), account = await this.account(customerEmail)
    if (prior) return this.replay(prior, hash, this.view(account))
    if (!this.policy.enabled) return { status: "denied", reason: "builder_activation_disabled", quota: this.view(account) }
    await this.initialize()
    let admission: BuilderAdmission
    try { admission = await this.retry(() => this.transaction(async (req): Promise<BuilderAdmission> => {
      let global = await this.lockGlobal(req)
      await eligible(req)
      const existing = await this.operation(key, req)
      let owner = await this.account(customerEmail, req)
      if (existing) return this.replay(existing, hash, this.view(owner))
      if (!owner) {
        assertLiveBuilderTransaction(this.payload, req)
        owner = quotaAccountSchema.parse(await this.payload.create({ collection: "builder-quota-accounts", req, overrideAccess: true,
          data: { customerEmail, visibleUsed: 0, visibleReserved: 0, chargedCostUnits: 0, attempts: 0, revision: 0, ingressDay: new Date(Date.now()).toISOString().slice(0, 10), ingressRequests: 0, lastActivityAt: new Date().toISOString() } }))
      }
      const quota = this.view(owner)
      if (!quota.remaining) return { status: "denied", reason: "quota_exhausted", quota }
      if (owner.activeOperationKey || owner.visibleReserved || global.activeOperations >= this.policy.globalMaxActive) return { status: "denied", reason: "busy", quota }
      const cost = this.policy.operationCostUnits
      if (owner.chargedCostUnits + cost > this.policy.accountMaxCostUnits || global.chargedCostUnits + cost > this.policy.globalMaxCostUnits || owner.attempts + 1 > this.policy.accountMaxAttempts || global.attempts + 1 > this.policy.globalMaxAttempts) return { status: "denied", reason: "technical_limit", quota }
      global = await this.cas("builder-quota-global", global, { activeOperations: global.activeOperations + 1, chargedCostUnits: global.chargedCostUnits + cost, attempts: global.attempts + 1 }, quotaGlobalSchema, req)
      owner = await this.cas("builder-quota-accounts", owner, { visibleReserved: 1, activeOperationKey: key, chargedCostUnits: owner.chargedCostUnits + cost, attempts: owner.attempts + 1, lastActivityAt: new Date().toISOString() }, quotaAccountSchema, req)
      const startedAt = new Date().toISOString(), deadlineAt = new Date(Date.now() + this.policy.operationTimeoutMs).toISOString(), reservationToken = randomUUID()
      assertLiveBuilderTransaction(this.payload, req)
      quotaOperationSchema.parse(await this.payload.create({ collection: "builder-operations", req, overrideAccess: true, data: {
        operationKey: key, operationId: input.operationId, customerEmail, messageHash: hash, state: "reserved", reservationToken,
        revision: 0, startedAt, deadlineAt, reservedCostUnits: cost, settledCostUnits: 0, dispatchedCostUnits: 0, knownCostUnits: 0,
        modelCalls: 0, weightedSteps: 0, unknownCalls: 0, outstandingCalls: 0, costKnown: true, slotHeld: true, configurationRevision: this.policy.configurationRevision,
      } }))
      return { status: "reserved", lease: { operationKey: key, reservationToken, customerEmail, deadlineAt }, quota: this.view(owner) }
    })) } catch (error) {
      if (!(error instanceof RetryTransaction)) throw error
      const committed = await this.operation(key)
      if (!committed) throw error
      return this.replay(committed, hash, this.view(await this.account(customerEmail)))
    }
    if (admission.status === "reserved") await this.readLease(admission.lease, ["reserved"])
    return admission
  }
  async readLease(lease: BuilderOperationLease, states: QuotaOperation["state"][] = ["running"], req?: Partial<PayloadRequest>): Promise<QuotaOperation> {
    const op = await this.operation(lease.operationKey, req)
    if (!op || op.reservationToken !== lease.reservationToken || op.customerEmail !== lease.customerEmail || op.deadlineAt !== lease.deadlineAt || !states.includes(op.state) || Date.parse(op.deadlineAt) <= Date.now()) throw new BuilderQuotaError("builder_lease_lost")
    return op
  }
  async claim(lease: BuilderOperationLease, eligible: BuilderEligibilityCheck): Promise<void> {
    const claimed = await this.retry(() => this.transaction(async (req) => {
      await this.lockGlobal(req)
      await eligible(req)
      const op = await this.readLease(lease, ["reserved"], req)
      return this.cas("builder-operations", op, { state: "running" }, quotaOperationSchema, req)
    }))
    const durable = await this.readLease(lease)
    if (durable.revision !== claimed.revision) throw new BuilderQuotaError("builder_commit_unverified")
  }
  async ownedWrite<T>(lease: BuilderOperationLease, eligible: BuilderEligibilityCheck, mutation: (req: Partial<PayloadRequest>, op: QuotaOperation, account: QuotaAccount, global: QuotaGlobal) => Promise<T>): Promise<T> {
    const committed = await this.retry(() => this.transaction(async (req) => {
      const global = await this.lockGlobal(req)
      await eligible(req)
      const op = await this.readLease(lease, ["running"], req)
      const account = await this.account(lease.customerEmail, req)
      if (!account || account.activeOperationKey !== op.operationKey || account.visibleReserved !== 1) throw new BuilderQuotaError("builder_lease_lost")
      await this.cas("builder-operations", op, {}, quotaOperationSchema, req)
      assertLiveBuilderTransaction(this.payload, req)
      const result = await mutation(req, { ...op, revision: op.revision + 1 }, account, global)
      assertLiveBuilderTransaction(this.payload, req)
      // No await outside the owned transaction may grant a stale worker writes.
      if (Date.parse(op.deadlineAt) <= Date.now()) throw new BuilderQuotaError("builder_deadline_exceeded")
      await eligible(req)
      const final = await this.readLease(lease, ["running"], req)
      return { result, revision: final.revision }
    }))
    const durable = await this.readLease(lease)
    if (durable.revision !== committed.revision) throw new BuilderQuotaError("builder_write_commit_unverified")
    return committed.result
  }
  async settle(lease: BuilderOperationLease, eligible: BuilderEligibilityCheck, raw: z.input<typeof builderSettlementSchema>): Promise<BuilderQuotaView> {
    const input = builderSettlementSchema.parse(raw)
    await this.finish(lease, { result: input.result, success: input.result.ok, stopped: true, errorCode: input.result.error ?? "builder_failed" }, eligible, async (req) => { await saveBuilderThread(this.payload, input.thread, req) })
    return this.view(await this.account(lease.customerEmail))
  }
  async fail(lease: BuilderOperationLease, errorCode: string, stopped: boolean): Promise<void> {
    const thread = await loadBuilderThread(this.payload, lease.customerEmail)
    await this.finish(lease, { success: false, stopped, errorCode, result: {
      ok: false, text: "This builder operation could not be completed.", error: errorCode.slice(0, 120), messages: thread?.messages ?? [],
      facts: thread?.facts ?? null, clientSlug: thread?.clientSlug ?? null,
    } })
  }
  private async finish(lease: BuilderOperationLease, input: { result?: BuilderTerminalResult; success: boolean; stopped: boolean; errorCode: string }, eligible?: BuilderEligibilityCheck, save?: (req: Partial<PayloadRequest>) => Promise<void>): Promise<void> {
    await this.retry(() => this.transaction(async (req) => {
      const global = await this.lockGlobal(req), op = await this.operation(lease.operationKey, req)
      if (!op || op.reservationToken !== lease.reservationToken || op.customerEmail !== lease.customerEmail) throw new BuilderQuotaError("builder_lease_lost")
      if (isTerminal(op)) return
      if ((input.success || save) && Date.parse(op.deadlineAt) <= Date.now()) throw new BuilderQuotaError("builder_deadline_exceeded")
      if (eligible) await eligible(req)
      const owner = await this.account(lease.customerEmail, req)
      if (!owner || owner.activeOperationKey !== op.operationKey || owner.visibleReserved !== 1) throw new BuilderQuotaError("builder_lease_lost")
      const known = op.unknownCalls === 0
      const cost = known ? op.knownCostUnits : op.reservedCostUnits
      const releaseSlot = input.stopped && op.outstandingCalls === 0
      if (cost > op.reservedCostUnits || global.chargedCostUnits < op.reservedCostUnits - cost || owner.chargedCostUnits < op.reservedCostUnits - cost || releaseSlot && global.activeOperations < 1) throw new BuilderQuotaError("builder_ledger_invalid")
      await this.cas("builder-quota-global", global, { activeOperations: global.activeOperations - (releaseSlot ? 1 : 0), chargedCostUnits: global.chargedCostUnits - op.reservedCostUnits + cost }, quotaGlobalSchema, req)
      await this.cas("builder-quota-accounts", owner, { visibleUsed: owner.visibleUsed + (input.success ? 1 : 0), visibleReserved: 0, activeOperationKey: releaseSlot ? null : op.operationKey, chargedCostUnits: owner.chargedCostUnits - op.reservedCostUnits + cost }, quotaAccountSchema, req)
      const terminal = await this.cas("builder-operations", op, { state: input.success ? "succeeded" : input.stopped ? "failed" : "interrupted", settledCostUnits: cost, costKnown: known, slotHeld: !releaseSlot, settledAt: new Date().toISOString(), errorCode: input.success ? null : input.errorCode.slice(0, 120) }, quotaOperationSchema, req)
      if (input.result) {
        assertLiveBuilderTransaction(this.payload, req)
        quotaOperationSchema.parse(await this.payload.update({ collection: "builder-operations", id: terminal.id, req, overrideAccess: true, data: { result: input.result } }))
      }
      if (save) { assertLiveBuilderTransaction(this.payload, req); await save(req) }
      if (eligible) await eligible(req)
      if ((input.success || save) && Date.parse(op.deadlineAt) <= Date.now()) throw new BuilderQuotaError("builder_deadline_exceeded")
    }))
    const durable = await this.operation(lease.operationKey)
    if (!durable || durable.reservationToken !== lease.reservationToken || !isTerminal(durable)) throw new BuilderQuotaError("builder_commit_unverified")
  }
  async reconcile(limit = 20): Promise<{ examined: number; settled: number; quarantined: number }> {
    z.number().int().min(1).max(100).parse(limit)
    const docs = await this.payload.find({ collection: "builder-operations", where: { and: [{ state: { in: ["reserved", "running"] } }, { deadlineAt: { less_than_equal: new Date(Date.now()).toISOString() } }] }, limit, depth: 0, overrideAccess: true, sort: "deadlineAt" })
    let settled = 0, quarantined = 0
    for (const raw of docs.docs) {
      const op = quotaOperationSchema.parse(raw)
      await this.fail({ operationKey: op.operationKey, reservationToken: op.reservationToken, customerEmail: op.customerEmail, deadlineAt: op.deadlineAt }, "builder_interrupted", op.outstandingCalls === 0)
      const result = await this.operation(op.operationKey)
      if (result && isTerminal(result)) { settled++; if (result.slotHeld) quarantined++ }
    }
    return { examined: docs.docs.length, settled, quarantined }
  }
}
