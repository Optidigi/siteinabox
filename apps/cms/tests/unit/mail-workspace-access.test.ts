import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ gate: vi.fn(), findByID: vi.fn() }))
vi.mock("@/lib/authGate", () => ({ requireRole: mocks.gate }))
vi.mock("payload", () => ({ getPayload: async () => ({ findByID: mocks.findByID }) }))
vi.mock("@/payload.config", () => ({ default: {} }))
import { requireMailWorkspace } from "@/app/(frontend)/(admin)/email/workspaceAccess"
beforeEach(() => vi.clearAllMocks())
it("ignores no owner binding and rejects a forged cross-workspace target", async () => {
 mocks.gate.mockResolvedValue({ user: { role: "owner" }, ctx: { mode: "tenant", tenant: { id: 56 } } })
 await expect(requireMailWorkspace("57")).rejects.toThrow("Workspace mismatch")
 expect(mocks.findByID).not.toHaveBeenCalled()
 await expect(requireMailWorkspace("56")).resolves.toMatchObject({basePath:"/email",ctx:{tenant:{id:56}}})
})
it("requires authentication and explicit active email workspace for support", async () => {
 const user = { id: 1, role: "super-admin", email: "operator@fixture.test" }
 mocks.gate.mockResolvedValue({ user, ctx: { mode: "super-admin", tenant: null } })
 await expect(requireMailWorkspace()).rejects.toThrow("Choose a customer")
 mocks.findByID.mockResolvedValue({ id: 56, status: "active", enabledServices: ["email"] })
 await expect(requireMailWorkspace("56")).resolves.toMatchObject({ user, basePath: "/accounts/56/email", ctx:{tenant:{id:56}} })
 expect(mocks.findByID).toHaveBeenCalledWith(expect.objectContaining({id:56,user,overrideAccess:false}))
 mocks.findByID.mockResolvedValue({ id: 56, status: "suspended", enabledServices: ["email"] })
 await expect(requireMailWorkspace("56")).rejects.toThrow("unavailable")
 mocks.gate.mockRejectedValue(new Error("unauthenticated"))
 await expect(requireMailWorkspace("56")).rejects.toThrow("unauthenticated")
})
