import { userFixture, tenantFixture } from "../_helpers/generatedDocs"
import { describe, it, expect } from "vitest"
import { evaluateGate, type GateDecision } from "@/lib/gateDecision"
import type { SiabContext } from "@/lib/context"
import type { Tenant, User } from "@/payload-types"

// Test fixtures: synthetic Tenant + User shapes shaped just enough to exercise
// evaluateGate. We don't need a real Payload boot — the gate is pure logic.
const t1 = tenantFixture({ id: 1 })
const t2 = tenantFixture({ id: 2 })

const ctxSuper: SiabContext = { mode: "super-admin", tenant: null }
const ctxT1: SiabContext = { mode: "tenant", tenant: t1 }
const ctxT2: SiabContext = { mode: "tenant", tenant: t2 }

const userSA = userFixture({ id: 1, role: "super-admin", tenants: [] })
const userOwner1 = userFixture({ id: 2, role: "owner", tenants: [{ tenant: t1 }] })
const userEditor1 = userFixture({ id: 3, role: "editor", tenants: [{ tenant: t1 }] })
const userViewer1 = userFixture({ id: 4, role: "viewer", tenants: [{ tenant: t1 }] })
const userOwner2 = userFixture({ id: 5, role: "owner", tenants: [{ tenant: t2 }] })

type Case = { host: SiabContext; who: User | null; expect: GateDecision }

const cases: Case[] = [
  // Anonymous
  { host: ctxSuper, who: null, expect: { allow: false, reason: "no-user" } },
  { host: ctxT1, who: null, expect: { allow: false, reason: "no-user" } },

  // Super-admin host
  { host: ctxSuper, who: userSA, expect: { allow: true } },
  { host: ctxSuper, who: userOwner1, expect: { allow: false, reason: "wrong-host" } },
  { host: ctxSuper, who: userEditor1, expect: { allow: false, reason: "wrong-host" } },
  { host: ctxSuper, who: userViewer1, expect: { allow: false, reason: "wrong-host" } },

  // Tenant 1 host
  { host: ctxT1, who: userSA, expect: { allow: false, reason: "super-admin-on-tenant-host" } },
  { host: ctxT1, who: userOwner1, expect: { allow: true } },
  { host: ctxT1, who: userEditor1, expect: { allow: true } },
  { host: ctxT1, who: userViewer1, expect: { allow: true } },
  { host: ctxT1, who: userOwner2, expect: { allow: false, reason: "cross-tenant" } },

  // Tenant 2 host (mirror of cross-tenant case)
  { host: ctxT2, who: userOwner1, expect: { allow: false, reason: "cross-tenant" } },
  { host: ctxT2, who: userOwner2, expect: { allow: true } }
]

describe("evaluateGate — host × role × tenant matrix", () => {
  it.each(cases)(
    "host=$host.mode tenant=$host.tenant.id who=$who.role → $expect",
    ({ host, who, expect: outcome }) => {
      const decision = evaluateGate(who, host)
      expect(decision).toEqual(outcome)
    }
  )

  it("covers all four reasons", () => {
    const reasons = cases
      .filter((c) => !c.expect.allow)
      .map((c) => (c.expect as { reason: string }).reason)
    expect(new Set(reasons)).toEqual(
      new Set(["no-user", "wrong-host", "super-admin-on-tenant-host", "cross-tenant"])
    )
  })

  it("normalizes string and populated tenant relationship IDs", () => {
    expect(
      evaluateGate(
        { role: "editor", tenants: [{ tenant: "1" }] },
        ctxT1,
      ),
    ).toEqual({ allow: true })
    expect(
      evaluateGate(
        { role: "viewer", tenants: [{ tenant: { id: "2" } }] },
        ctxT2,
      ),
    ).toEqual({ allow: true })
  })
})
