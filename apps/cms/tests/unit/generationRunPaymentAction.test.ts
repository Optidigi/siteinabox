import { beforeEach, describe, expect, it, vi } from "vitest"

import { cast } from "../_helpers/cast"
import type { GateResult } from "@/lib/authGate"
import type { User } from "@/payload-types"
import { asPayload, type MockCreateArgs } from "../_helpers/mockPayload"
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/authGate", () => ({
  requireRole: vi.fn(),
}))

import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import { requireRole } from "@/lib/authGate"
import { recordGenerationRunPaymentAction } from "@/lib/actions/generationRunPayment"

describe("generation run payment action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires super-admin access before recording completed payment", async () => {
    const update = vi.fn(async ({ data }: MockCreateArgs) => ({ id: 500, ...data }))
    vi.mocked(requireRole).mockResolvedValue(cast<GateResult>({
      user: cast<User>({ id: 42, role: "super-admin", updatedAt: "", createdAt: "", email: "admin@test.local" }),
      ctx: { mode: "super-admin", tenant: null },
    }))
    vi.mocked(getPayload).mockResolvedValue(asPayload({ update }))

    const form = new FormData()
    form.set("provider", "invoice")
    form.set("externalReference", "ref-100")
    form.set("note", "Paid by bank transfer")

    await recordGenerationRunPaymentAction(500, "completed", form)

    expect(requireRole).toHaveBeenCalledWith(["super-admin"])
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
      id: 500,
      data: {
        payment: expect.objectContaining({
          status: "completed",
          provider: "invoice",
          externalReference: "ref-100",
          actor: 42,
          note: "Paid by bank transfer",
        }),
      },
      overrideAccess: true,
      user: { id: 42 },
    }))
    expect(revalidatePath).toHaveBeenCalledWith("/operations/runs/500")
  })

  it("does not mutate payment when the super-admin gate rejects", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("forbidden"))
    vi.mocked(getPayload).mockResolvedValue(asPayload({ update: vi.fn() }))

    await expect(recordGenerationRunPaymentAction(500, "waived", new FormData())).rejects.toThrow("forbidden")

    expect(getPayload).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
