import { describe, expect, it, vi } from "vitest"

import {
  checkoutProfileDraftSchema,
  checkoutProfileView,
  domainRegistrantFromCheckoutProfile,
  saveCheckoutProfileVersion,
} from "@/lib/checkout/checkoutProfile"
import type { CheckoutProfile } from "@/payload-types"

import { asPayload } from "../_helpers/mockPayload"

const registeredDraft = {
  partyType: "registered_business" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  registeredBusinessName: "Analytical Engines B.V.",
  kvkNumber: "12345678",
  intendedCompanyName: "",
  street: "Markt",
  number: "1",
  suffix: "",
  zipcode: "1234 AB",
  city: "Utrecht",
  country: "NL",
  phoneCountryCode: "+31",
  phoneAreaCode: "30",
  phoneSubscriberNumber: "1234567",
}

describe("checkout profile authority", () => {
  it("accepts only the two governed contracting-party classifications", () => {
    expect(checkoutProfileDraftSchema.safeParse(registeredDraft).success).toBe(true)
    expect(checkoutProfileDraftSchema.safeParse({
      ...registeredDraft,
      partyType: "business_in_formation",
      registeredBusinessName: "",
      kvkNumber: "",
      intendedCompanyName: "Analytical Engines",
    }).success).toBe(true)
    expect(checkoutProfileDraftSchema.safeParse({
      ...registeredDraft,
      partyType: "private_consumer",
    }).success).toBe(false)
    expect(checkoutProfileDraftSchema.safeParse({
      ...registeredDraft,
      partyType: "business_in_formation",
      registeredBusinessName: "",
      kvkNumber: "12345678",
    }).success).toBe(false)
  })

  it("appends audited profile versions and never updates an accepted correction target", async () => {
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [{
          id: 41,
          profileKey: "run:9:checkout-profile:1",
          profileVersion: 1,
          generationRun: 9,
          customerName: "Ada Lovelace",
          customerEmail: "owner@example.test",
          customerPhone: "+31 30 1234567",
          partyType: "registered_business",
          contractingPartyName: "Analytical Engines B.V.",
          kvkNumber: "12345678",
          domainRegistrantSource: "contracting_party",
          billingAddress: {
            schemaVersion: 1,
            street: "Markt",
            number: "1",
            suffix: null,
            zipcode: "1234 AB",
            city: "Utrecht",
            country: "NL",
            phoneCountryCode: "+31",
            phoneAreaCode: "30",
            phoneSubscriberNumber: "1234567",
          },
          revisionReason: "initial_capture",
          actorEmail: "owner@example.test",
          sourceRequestId: "req-1",
          createdAt: "2026-07-26T12:00:00.000Z",
        }],
      })
    const create = vi.fn(async ({ data }) => ({ id: 41 + create.mock.calls.length, ...data }))
    const update = vi.fn()
    const payload = asPayload({ find, create, update })

    const initial = await saveCheckoutProfileVersion({
      payload,
      generationRunId: 9,
      tenantId: 7,
      actorEmail: "OWNER@EXAMPLE.TEST",
      expectedProfileVersion: 0,
      draft: registeredDraft,
      requestId: "req-1",
      ipAddress: "192.0.2.10",
      userAgent: "test-agent",
      now: new Date("2026-07-26T12:00:00.000Z"),
    })
    expect(initial).toMatchObject({
      status: "saved",
      profile: {
        profileKey: "run:9:checkout-profile:1",
        profileVersion: 1,
        customerEmail: "owner@example.test",
        revisionReason: "initial_capture",
      },
    })

    const corrected = await saveCheckoutProfileVersion({
      payload,
      generationRunId: 9,
      tenantId: 7,
      actorEmail: "owner@example.test",
      expectedProfileVersion: 1,
      draft: { ...registeredDraft, city: "Amsterdam" },
      requestId: "req-2",
      now: new Date("2026-07-26T12:05:00.000Z"),
    })
    expect(corrected).toMatchObject({
      status: "saved",
      profile: {
        profileKey: "run:9:checkout-profile:2",
        profileVersion: 2,
        supersedesProfileKey: "run:9:checkout-profile:1",
        revisionReason: "customer_correction",
        actorEmail: "owner@example.test",
        sourceRequestId: "req-2",
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("returns the current profile on an optimistic-version conflict", async () => {
    const current = {
      id: 52,
      profileKey: "run:9:checkout-profile:2",
      profileVersion: 2,
      generationRun: 9,
      customerName: "Ada Lovelace",
      customerEmail: "owner@example.test",
      partyType: "registered_business",
      contractingPartyName: "Analytical Engines B.V.",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: {
        schemaVersion: 1,
        street: "Markt",
        number: "1",
        suffix: null,
        zipcode: "1234 AB",
        city: "Amsterdam",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
      createdAt: "2026-07-26T12:05:00.000Z",
    }
    const create = vi.fn()
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [current] })),
      create,
    })

    const result = await saveCheckoutProfileVersion({
      payload,
      generationRunId: 9,
      tenantId: 7,
      actorEmail: "owner@example.test",
      expectedProfileVersion: 1,
      draft: registeredDraft,
      requestId: "req-stale",
    })

    expect(result).toMatchObject({
      status: "conflict",
      currentProfile: { profileVersion: 2, profileKey: "run:9:checkout-profile:2" },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("projects incomplete pre-Phase-3 profiles for visible correction without treating them as registrant-ready", () => {
    const legacyProfile = {
      id: 51,
      profileKey: "run:9:profile:1",
      profileVersion: 1,
      generationRun: 9,
      customerName: "Ada",
      customerEmail: "owner@example.test",
      partyType: "business_in_formation",
      contractingPartyName: "Ada",
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
      billingAddress: { country: "NL" },
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
    } as CheckoutProfile

    expect(checkoutProfileView(legacyProfile)).toMatchObject({
      firstName: "Ada",
      lastName: "",
      street: "",
      country: "NL",
    })
    expect(() => domainRegistrantFromCheckoutProfile(legacyProfile)).toThrow()
  })

  it("derives registrant identity from the persisted profile classification", () => {
    const registered = domainRegistrantFromCheckoutProfile({
      profileKey: "profile-1",
      profileVersion: 1,
      customerName: "Ada Lovelace",
      customerEmail: "owner@example.test",
      partyType: "registered_business",
      contractingPartyName: "Analytical Engines B.V.",
      kvkNumber: "12345678",
      intendedCompanyName: null,
      billingAddress: {
        schemaVersion: 1,
        street: "Markt",
        number: "1",
        suffix: null,
        zipcode: "1234 AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
    })
    expect(registered).toMatchObject({
      companyName: "Analytical Engines B.V.",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "owner@example.test",
    })

    const inFormation = domainRegistrantFromCheckoutProfile({
      ...registeredDraft,
      profileKey: "profile-2",
      profileVersion: 2,
      customerName: "Ada Lovelace",
      customerEmail: "owner@example.test",
      partyType: "business_in_formation",
      contractingPartyName: "Ada Lovelace",
      kvkNumber: null,
      intendedCompanyName: "Analytical Engines",
      billingAddress: {
        schemaVersion: 1,
        street: "Markt",
        number: "1",
        suffix: null,
        zipcode: "1234 AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
    })
    expect(inFormation).toMatchObject({
      companyName: null,
      firstName: "Ada",
      lastName: "Lovelace",
    })
  })
})
