import { randomUUID } from "node:crypto"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { getTestPayload } from "./_helpers"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { buildRawIntakeFromBuilderFacts } from "@/lib/builder/rawIntake"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { storeIntakeSubmission } from "@/lib/intake/storeIntakeSubmission"
import { processStoredIntakeSubmission } from "@/lib/intake/processIntakeSubmission"
import { normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Intake fences require isolated payload_test, disabled jobs and mock Sitegen.")
  payload = await getTestPayload()
}, 60000)
afterEach(() => vi.restoreAllMocks())

const fixture = async () => {
  const id = randomUUID(), email = `intake-${id}@example.test`
  const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, enabled: true })
  await service.initialize()
  const eligible = async () => {}
  const admission = await service.reserve(email, { operationId: id, message: "Save an offline intake fixture" }, eligible)
  if (admission.status !== "reserved") throw new Error(`Expected reservation, received ${admission.status}`)
  await service.claim(admission.lease, eligible)
  const execution = new ReservedBuilderExecution(service, admission.lease, eligible)
  const raw = buildRawIntakeFromBuilderFacts({
    facts: heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", null),
    contact: { name: "Fixture", email, phone: "" },
    legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
  })
  return { service, admission, execution, raw, email }
}

// Roll back the installed adapter transaction after a real Local API call. Its
// session is now absent; the pinned getTransaction would use the root DB if a
// subsequent unguarded Local API operation reused this transaction request.
const loseSession = async (requestID: unknown) => {
  const sessions = payload.db.sessions
  if (!sessions) throw new Error("Expected initialized adapter sessions")
  const transactionID = requestID ?? Object.keys(sessions)[0]
  if (typeof transactionID !== "number" && typeof transactionID !== "string") throw new Error("Expected a live owned SDK session")
  if (!sessions[String(transactionID)]) throw new Error("Expected installed adapter session")
  await payload.db.rollbackTransaction(transactionID)
  expect(sessions[String(transactionID)]).toBeUndefined()
}

describe("intake public Local SDK transaction-loss regressions", () => {
  it.each([false, true])("does not persist outside its lease after dedup loses the real session (invalid=%s)", async (invalid) => {
    const { service, admission, execution, raw, email } = await fixture()
    if (invalid) raw.company.companyName = ""
    const find = payload.find.bind(payload)
    const create = vi.spyOn(payload, "create")
    let lost = false
    vi.spyOn(payload, "find").mockImplementation(async (args) => {
      const result = await find(args)
      if (!lost && args.collection === "intake-submissions") {
        lost = true
        await loseSession(args.req?.transactionID)
      }
      return result
    })
    try {
      await expect(storeIntakeSubmission(payload, raw, { executionContext: execution })).rejects.toThrow("builder_transaction_lost")
      expect(lost).toBe(true)
      expect(create.mock.calls.filter(([args]) => args.collection === "intake-submissions")).toHaveLength(0)
      expect((await find({ collection: "intake-submissions", where: { contactEmail: { equals: email } }, depth: 0, overrideAccess: true })).docs).toHaveLength(0)
    } finally {
      vi.restoreAllMocks()
      await service.fail(admission.lease, "fixture_complete", true)
      execution.dispose()
    }
  })

  it("rolls back intake update and prevents readback when its real SDK session disappears", async () => {
    const { service, admission, execution, raw } = await fixture()
    const intake = await payload.create({ collection: "intake-submissions", data: { businessName: raw.company.companyName, contactEmail: raw.finalDetails.email, source: "builder", idempotencyKey: `intake-fence-${randomUUID()}`, status: "submitted", raw, normalized: normalizeIntakeSubmission(raw) }, depth: 0, overrideAccess: true })
    const update = payload.update.bind(payload)
    const findByID = vi.spyOn(payload, "findByID")
    vi.spyOn(payload, "update").mockImplementation(async (args) => {
      const result = await update(args)
      if (args.collection === "intake-submissions") await loseSession(args.req?.transactionID)
      return result
    })
    try {
      await expect(processStoredIntakeSubmission(payload, intake.id, { executionContext: execution })).rejects.toThrow("builder_transaction_lost")
      expect(findByID.mock.calls.filter(([args]) => args.collection === "intake-submissions")).toHaveLength(1)
      vi.restoreAllMocks()
      expect(await payload.findByID({ collection: "intake-submissions", id: intake.id, depth: 0, overrideAccess: true })).toMatchObject({ status: "submitted" })
      expect((await payload.find({ collection: "site-generation-runs", where: { intakeSubmission: { equals: intake.id } }, overrideAccess: true })).docs).toHaveLength(0)
    } finally {
      vi.restoreAllMocks()
      await service.fail(admission.lease, "fixture_complete", true)
      execution.dispose()
    }
  })
})
