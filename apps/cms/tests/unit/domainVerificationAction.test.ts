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
import { updateTenantDomainVerificationAction } from "@/lib/actions/domainVerification"

describe("domain verification action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("requires super-admin access and writes manual verification audit fields", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-26T10:00:00.000Z"))
    const update = vi.fn(async ({ data }: MockCreateArgs) => ({ id: 7, ...data }))
    vi.mocked(requireRole).mockResolvedValue(cast<GateResult>({
      user: cast<User>({ id: 42, role: "super-admin", updatedAt: "", createdAt: "", email: "admin@test.local" }),
      ctx: { mode: "super-admin", tenant: null },
    }))
    vi.mocked(getPayload).mockResolvedValue(asPayload({ update }))
    const form = new FormData()
    form.set("status", "verified")
    form.set("notes", "DNS and proxy route checked")

    await updateTenantDomainVerificationAction(500, 7, form)

    expect(requireRole).toHaveBeenCalledWith(["super-admin"])
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      id: 7,
      data: {
        domainVerification: {
          status: "verified",
          checkedAt: "2026-06-26T10:00:00.000Z",
          checkedBy: 42,
          notes: "DNS and proxy route checked",
        },
      },
      overrideAccess: false,
      user: { id: 42, role: "super-admin" },
    }))
    expect(revalidatePath).toHaveBeenCalledWith("/operations/runs/500")
  })

  it("does not mutate when status is unsupported", async () => {
    vi.mocked(requireRole).mockResolvedValue(cast<GateResult>({
      user: cast<User>({ id: 42, role: "super-admin", updatedAt: "", createdAt: "", email: "admin@test.local" }),
      ctx: { mode: "super-admin", tenant: null },
    }))
    vi.mocked(getPayload).mockResolvedValue(asPayload({ update: vi.fn() }))
    const form = new FormData()
    form.set("status", "dns_automated")

    await expect(updateTenantDomainVerificationAction(500, 7, form)).rejects.toThrow("Unsupported domain verification status.")

    expect(getPayload).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
