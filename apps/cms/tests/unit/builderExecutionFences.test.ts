import { describe, expect, it, vi } from "vitest"
import { createTestPayload } from "../_helpers/testPayload"
import { pageFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { offlineBuilderExecution } from "../_helpers/builderExecution"
import { createOfflineTransactionPayload } from "../_helpers/offlineTransactionPayload"
import { patchSection, updateSectionProps } from "@/lib/agent/tools"
import { runBuilderTurn, BuilderChatRequestSchema } from "@/lib/builder/runBuilderTurn"

const page = () => pageFixture({ id: 4, slug: "index", blocks: [{ blockType: "hero", variant: "hero-01", heading: "Before", body: "Before", primaryAction: { label: "Contact", href: "mailto:fixture@example.test" } }] })

describe("actual builder tool execution fences", () => {
  it("lease denial prevents the direct tool mutation and even its read", async () => {
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find")
    const update = vi.spyOn(payload, "update")
    const executionContext = offlineBuilderExecution()
    executionContext.withWrite = async () => { throw new Error("lease lost") }
    await expect(patchSection({ payload, tenantId: 7, executionContext }, { pageSlug: "index", patch: { heading: "After" } })).rejects.toThrow("lease lost")
    expect(find).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
  it("production direct bypass paths pass the transaction request into read and mutation", async () => {
    const payload = await createOfflineTransactionPayload()
    const find = vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([page()]))
    const update = vi.spyOn(payload, "update").mockResolvedValue(page())
    const executionContext = offlineBuilderExecution()
    const req = { transactionID: "offline-unit-fixture" }
    const fence = vi.fn()
    executionContext.withWrite = async (mutation) => { fence(); return mutation(req) }
    await updateSectionProps({ payload, tenantId: 7, executionContext }, { pageSlug: "index", field: "heading", value: "After" })
    expect(fence).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ req, data: { blocks: [expect.objectContaining({ heading: "After" })] } }))
  })
  it("customer builder refuses missing operation authority before any IO", async () => {
    const payload = createTestPayload()
    const request = BuilderChatRequestSchema.parse({ message: "Build a site", contactName: "Fixture", contactEmail: "fixture@example.test", legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false } })
    // Exercise the untyped JS/transport bypass without a TypeScript suppression.
    await expect(Reflect.apply(runBuilderTurn, undefined, [payload, request])).rejects.toThrow("verified operation context")
  })
})
