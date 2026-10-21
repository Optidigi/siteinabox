import { describe, expect, it, vi } from "vitest"
import { fixtureSpec } from "../_helpers/siteGenerationFixture"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { asPayload } from "../_helpers/mockPayload"
const guard = vi.hoisted(() => ({ revoked: false, revokeDuringPlan: false, active: false, req: { transactionID: "synthetic-authority-transaction" } }))
vi.mock("@/lib/auth/customerWorkspace", () => ({
  assertCustomerAccess: vi.fn(async () => { if (guard.revoked) throw new Error("E_CUSTOMER_SESSION_REQUIRED") }),
  withCustomerWorkspace: async (_payload: unknown, _authority: unknown, action: (bound: null, req: typeof guard.req) => Promise<unknown>) => {
    guard.active = true
    try { return await action(null, guard.req) } finally { guard.active = false }
  },
}))
vi.mock("@/lib/builder/planTurn", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/builder/planTurn")>()
  return { ...actual, planBuilderTurn: async (input: { previous: unknown }) => {
    if (guard.revokeDuringPlan) guard.revoked = true
    return { facts: input.previous, decision: "maintain", reply: "Synthetic theme update", maintainerKind: "setTheme" }
  } }
})
import { runExistingSiteTurn } from "@/lib/agent/siteEditorAgent"
import { applyMaintainerTurn } from "@/lib/agent/runMaintainerTurn"
import { applySiteGenerationSpec } from "@/lib/site-generation/applySiteGenerationSpec"

describe("customer generation authority", () => {
  it("keeps every content read and write inside the serialized authority transaction", async () => {
    const collections = new Set<string>()
    const check = (args: { collection: string; req?: unknown }) => {
      expect(guard.active, args.collection + " escaped the authority lock").toBe(true)
      expect(args.req, args.collection + " lost the authority transaction").toBe(guard.req)
      collections.add(args.collection)
    }
    const payload = asPayload({
      find: async (args: { collection: string; req?: unknown }) => { check(args); return { docs: [] } },
      create: async (args: { collection: string; req?: unknown; data: Record<string, unknown> }) => { check(args); return { ...args.data, id: 1 } },
      update: async (args: { collection: string; req?: unknown; data: Record<string, unknown>; id: string | number }) => { check(args); return { ...args.data, id: args.id } },
    })
    const result = await applySiteGenerationSpec(payload, fixtureSpec(), {
      customerAuthority: { accountId: 1, previewSessionId: "synthetic-session" }, retireUnspecifiedPages: true,
    })
    expect(result.ok).toBe(true)
    expect([...collections].sort()).toEqual(["pages", "site-settings", "tenants"])
    expect(guard.active).toBe(false)
  })
})


it("retains customer authority in deterministic and planned maintainer theme writes", async () => {
  const authority = { accountId: 1, previewSessionId: "synthetic-session" }
  const facts = heuristicExtractBuilderFacts("Ik ben kapper in Tilburg.", null)
  const payload = asPayload({ find: vi.fn(async () => ({ docs: [] })), findByID: vi.fn(), update: vi.fn() })
  try {
    guard.revoked = true
    await expect(applyMaintainerTurn({ payload, tenantId: 1, facts, message: "Maak het thema groen en donker.",
      customerAuthority: authority })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
    expect(payload.update).not.toHaveBeenCalled()
    guard.revoked = false; guard.revokeDuringPlan = true
    await expect(runExistingSiteTurn({ ctx: { payload, tenantId: 1, customerAuthority: authority },
      facts, message: "Maak het thema groen en donker.", pageSlug: "index", recentMessages: [], useMastra: false,
    })).rejects.toThrow("E_CUSTOMER_SESSION_REQUIRED")
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
  } finally { guard.revoked = false; guard.revokeDuringPlan = false }
})
