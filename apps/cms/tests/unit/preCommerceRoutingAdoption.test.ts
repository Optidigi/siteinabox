import type { Tenant } from "@/payload-types"
import { tenantFixture } from "../_helpers/generatedDocs"
import { hookCollection, hookRequest } from "../_helpers/hookFixtures"
import { describe, expect, it } from "vitest"
import {
  protectPreCommerceRoutingAdoption,
} from "@/collections/Tenants"
import { hookArgsFor } from "../_helpers/hookFixtures"

const adopted: NonNullable<Tenant["preCommerceRoutingAdoption"]> = {
  state: "adopted",
  adoptedDomain: "ami-care.nl",
  evidenceVersion: "pre-commerce-routing-v1",
  adoptedAt: "2026-07-30T09:59:23.000Z",
  revokedAt: null,
  reason: "Verified historical routing adoption.",
}

const callHook = (
  data: Partial<Tenant>,
  input: {
    operation?: "create" | "update"
    system?: boolean
    originalDoc?: Partial<Tenant>
  } = {},
) : unknown => protectPreCommerceRoutingAdoption(hookArgsFor(
  protectPreCommerceRoutingAdoption,
  {
    data,
    operation: input.operation ?? "update",
    originalDoc: tenantFixture(input.originalDoc ?? {
      domain: "ami-care.nl",
      preCommerceRoutingAdoption: { state: "not_adopted" },
    }),
    collection: hookCollection("tenants"),
    context: {},
    req: hookRequest({
      context: input.system
        ? { preCommerceRoutingAdoptionMutation: true }
        : {},
    }),
  },
))

describe("pre-commerce routing adoption ownership", () => {
  it("allows only a pristine default during ordinary tenant creation", () => {
    expect(callHook({
      preCommerceRoutingAdoption: { state: "not_adopted" },
    }, { operation: "create" })).toMatchObject({
      preCommerceRoutingAdoption: { state: "not_adopted" },
    })
    expect(() => { callHook({
      preCommerceRoutingAdoption: adopted,
    }, { operation: "create" }) }).toThrow(
      "A tenant cannot be created with routing adoption.",
    )
  })

  it("rejects ordinary updates to routing-only authority", () => {
    expect(() => { callHook({
      preCommerceRoutingAdoption: adopted,
    }) }).toThrow("Pre-commerce routing adoption is system-owned.")
    expect(callHook({
      preCommerceRoutingAdoption: { state: "not_adopted" },
    })).toMatchObject({
      preCommerceRoutingAdoption: { state: "not_adopted" },
    })
  })

  it("allows unrelated updates to preserve existing routing evidence", () => {
    expect(callHook({
      name: "Amicare-Zorg vernieuwd",
      preCommerceRoutingAdoption: adopted,
    }, {
      originalDoc: {
        domain: "ami-care.nl",
        preCommerceRoutingAdoption: adopted,
      },
    })).toMatchObject({
      name: "Amicare-Zorg vernieuwd",
      preCommerceRoutingAdoption: adopted,
    })
  })

  it("requires complete versioned evidence for system adoption", () => {
    expect(callHook({
      preCommerceRoutingAdoption: adopted,
    }, { system: true })).toMatchObject({
      preCommerceRoutingAdoption: adopted,
    })
    expect(() => { callHook({
      preCommerceRoutingAdoption: {
        ...adopted,
        evidenceVersion: "unknown-version",
      },
    }, { system: true }) }).toThrow(
      "Pre-commerce routing adoption evidence is incomplete.",
    )
  })

  it("binds adoption evidence to the normalized tenant domain", () => {
    expect(() => { callHook({
      domain: "other.example",
      preCommerceRoutingAdoption: adopted,
    }, { system: true }) }).toThrow(
      "Pre-commerce routing adoption evidence is incomplete.",
    )
  })

  it("requires monotonic transitions and immutable adopted evidence", () => {
    const originalDoc = {
      domain: "ami-care.nl",
      preCommerceRoutingAdoption: adopted,
    }
    const revoked: NonNullable<Tenant["preCommerceRoutingAdoption"]> = {
      ...adopted,
      state: "revoked",
      revokedAt: "2026-07-30T10:00:00.000Z",
    }
    expect(callHook({
      preCommerceRoutingAdoption: revoked,
    }, { system: true, originalDoc })).toMatchObject({
      preCommerceRoutingAdoption: revoked,
    })
    expect(() => { callHook({
      preCommerceRoutingAdoption: {
        ...adopted,
        adoptedAt: "2026-07-30T11:00:00.000Z",
      },
    }, { system: true, originalDoc }) }).toThrow(
      "Pre-commerce routing adoption evidence is immutable.",
    )
    expect(() => { callHook({
      preCommerceRoutingAdoption: adopted,
    }, {
      system: true,
      originalDoc: {
        domain: "ami-care.nl",
        preCommerceRoutingAdoption: revoked,
      },
    }) }).toThrow("Pre-commerce routing adoption is monotonic.")
    expect(() => { callHook({
      preCommerceRoutingAdoption: { state: "not_adopted" },
    }, {
      system: true,
      originalDoc: {
        domain: "ami-care.nl",
        preCommerceRoutingAdoption: adopted,
      },
    }) }).toThrow("Pre-commerce routing adoption is monotonic.")
  })

  it("never carries adopted or revoked evidence to another tenant domain", () => {
    expect(() => { callHook({
      domain: "other.example",
    }, {
      originalDoc: {
        domain: "ami-care.nl",
        preCommerceRoutingAdoption: adopted,
      },
    }) }).toThrow(
      "A tenant with routing adoption cannot change its domain.",
    )
    expect(() => { callHook({
      domain: "other.example",
    }, {
      originalDoc: {
        domain: "ami-care.nl",
        preCommerceRoutingAdoption: {
          ...adopted,
          state: "revoked",
          revokedAt: "2026-07-30T10:00:00.000Z",
        },
      },
    }) }).toThrow(
      "A tenant with routing adoption cannot change its domain.",
    )
  })

  it("requires a revocation timestamp and rejects evidence on not-adopted state", () => {
    expect(() => { callHook({
      preCommerceRoutingAdoption: {
        ...adopted,
        state: "revoked",
      },
    }, { system: true }) }).toThrow(
      "A revoked routing record requires a revocation date.",
    )
    expect(() => { callHook({
      preCommerceRoutingAdoption: {
        state: "not_adopted",
        evidenceVersion: "pre-commerce-routing-v1",
      },
    }, { system: true }) }).toThrow(
      "An unadopted tenant cannot carry routing evidence.",
    )
  })
})
