import { afterEach, describe, expect, it, vi } from "vitest"
import { createGeneratedPayloadStore } from "../_helpers/generatedPayloadStore"
import { offlineBuilderExecution } from "../_helpers/builderExecution"
import { intakeSubmissionFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { buildRawIntakeFromBuilderFacts } from "@/lib/builder/rawIntake"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { storeIntakeSubmission } from "@/lib/intake/storeIntakeSubmission"
import { processStoredIntakeSubmission } from "@/lib/intake/processIntakeSubmission"
import { normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"

const raw = () => buildRawIntakeFromBuilderFacts({
  facts: heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", null),
  contact: { name: "Fixture", email: "intake-fence@example.test", phone: "" },
  legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
})

const fixture = async () => {
  const store = { "intake-submissions": [], "site-generation-runs": [] }
  const { payload } = await createGeneratedPayloadStore({ collections: store })
  const req = { transactionID: "intake-owned-fixture" }
  const sessions = payload.db.sessions
  if (!sessions) throw new Error("Expected initialized adapter sessions")
  Object.defineProperty(sessions, req.transactionID, { value: { db: {} }, configurable: true })
  const executionContext = offlineBuilderExecution()
  executionContext.withWrite = async (mutation) => mutation(req)
  return { payload, executionContext, req, store, sessions }
}

afterEach(() => vi.restoreAllMocks())

describe("intake calls inside customer transaction callbacks", () => {
  it("passes the exact owned request through intake deduplication and creation", async () => {
    const { payload, executionContext, req } = await fixture()
    await storeIntakeSubmission(payload, raw(), { executionContext })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "intake-submissions", req }))
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "intake-submissions", req }))
  })

  it.each([false, true])("lost session after deduplication cannot trigger a fallback create (invalid=%s)", async (invalid) => {
    const { payload, executionContext, req, store, sessions } = await fixture()
    vi.spyOn(payload, "find").mockImplementation(async () => {
      delete sessions[req.transactionID]
      return paginatedFixture([])
    })
    const input = raw()
    if (invalid) input.company.companyName = ""
    await expect(storeIntakeSubmission(payload, input, { executionContext })).rejects.toThrow("builder_transaction_lost")
    expect(payload.create).not.toHaveBeenCalled()
    expect(store["intake-submissions"]).toHaveLength(0)
  })

  it.each(["abort", "deadline"])("stops before persistence when %s occurs during a read", async (reason) => {
    const { payload, executionContext, store } = await fixture()
    const controller = new AbortController()
    const context = { ...executionContext, signal: controller.signal }
    vi.spyOn(payload, "find").mockImplementation(async () => {
      if (reason === "abort") controller.abort()
      else vi.spyOn(Date, "now").mockReturnValue(Date.parse(context.deadlineAt) + 1)
      return paginatedFixture([])
    })
    await expect(storeIntakeSubmission(payload, raw(), { executionContext: context })).rejects.toThrow(reason === "abort" ? "builder_execution_aborted" : "builder_deadline_exceeded")
    expect(payload.create).not.toHaveBeenCalled()
    expect(store["intake-submissions"]).toHaveLength(0)
  })

  it("guards stored intake reads and stops immediately after a lost update session", async () => {
    const { payload, executionContext, req, sessions } = await fixture()
    const intake = intakeSubmissionFixture({ id: 23, status: "submitted", normalized: normalizeIntakeSubmission(raw()) })
    vi.spyOn(payload, "findByID").mockResolvedValue(intake)
    vi.spyOn(payload, "update").mockImplementation(async () => {
      delete sessions[req.transactionID]
      return intake
    })
    await expect(processStoredIntakeSubmission(payload, intake.id, { executionContext })).rejects.toThrow("builder_transaction_lost")
    expect(payload.findByID).toHaveBeenCalledTimes(1)
    expect(payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(payload.create).not.toHaveBeenCalled()
  })
})
