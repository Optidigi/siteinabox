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

  it("creates a confirmed structured-name version when a legacy projection is submitted unchanged", async () => {
    const legacy = {
      id: 53,
      profileKey: "run:9:checkout-profile:2",
      profileVersion: 2,
      generationRun: 9,
      tenant: 7,
      customerName: "Maria de la Cruz",
      firstName: null,
      lastName: null,
      customerEmail: "owner@example.test",
      customerPhone: "+31 30 1234567",
      partyType: "business_in_formation",
      contractingPartyName: "Maria de la Cruz",
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
      intendedCompanyName: "Cruz Studio",
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
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
    } as CheckoutProfile
    const create = vi.fn(async ({ data }) => ({ id: 54, ...data }))
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [legacy] })),
      create,
    })
    const visibleDraft = checkoutProfileView(legacy)

    const result = await saveCheckoutProfileVersion({
      payload,
      generationRunId: 9,
      tenantId: 7,
      actorEmail: "owner@example.test",
      expectedProfileVersion: 2,
      draft: {
        partyType: visibleDraft.partyType,
        firstName: visibleDraft.firstName,
        lastName: visibleDraft.lastName,
        registeredBusinessName: visibleDraft.registeredBusinessName,
        kvkNumber: visibleDraft.kvkNumber,
        intendedCompanyName: visibleDraft.intendedCompanyName,
        street: visibleDraft.street,
        number: visibleDraft.number,
        suffix: visibleDraft.suffix,
        zipcode: visibleDraft.zipcode,
        city: visibleDraft.city,
        country: visibleDraft.country,
        phoneCountryCode: visibleDraft.phoneCountryCode,
        phoneAreaCode: visibleDraft.phoneAreaCode,
        phoneSubscriberNumber: visibleDraft.phoneSubscriberNumber,
      },
      requestId: "req-confirm-name",
      now: new Date("2026-07-28T12:00:00.000Z"),
    })

    expect(result).toMatchObject({
      status: "saved",
      created: true,
      profile: {
        profileVersion: 3,
        firstName: "Maria de la",
        lastName: "Cruz",
      },
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "checkout-profiles",
      data: expect.objectContaining({
        firstName: "Maria de la",
        lastName: "Cruz",
        supersedesProfileKey: legacy.profileKey,
      }),
    }))
    expect(domainRegistrantFromCheckoutProfile(
      (await create.mock.results[0]?.value) as CheckoutProfile,
    )).toMatchObject({
      firstName: "Maria de la",
      lastName: "Cruz",
    })
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

  it("fails closed for a complete legacy compound name until structured names are confirmed", () => {
    const legacyProfile = {
      id: 52,
      profileKey: "run:9:profile:2",
      profileVersion: 2,
      generationRun: 9,
      customerName: "Maria de la Cruz",
      customerEmail: "owner@example.test",
      partyType: "business_in_formation",
      contractingPartyName: "Maria de la Cruz",
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
      intendedCompanyName: "Cruz Studio",
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
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
    } as CheckoutProfile

    expect(() => domainRegistrantFromCheckoutProfile(legacyProfile)).toThrow(
      "confirmed structured first and last names",
    )
  })

  it("derives registrant identity from the persisted profile classification", () => {
    const registered = domainRegistrantFromCheckoutProfile({
      profileKey: "profile-1",
      profileVersion: 1,
      customerName: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
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
      firstName: "Ada",
      lastName: "Lovelace",
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

  it.each(["registered_business", "business_in_formation"] as const)(
    "preserves structured compound names for %s registrants",
    (partyType) => {
      const registrant = domainRegistrantFromCheckoutProfile({
        profileKey: `profile-${partyType}`,
        profileVersion: 3,
        customerName: "Maria de la Cruz",
        firstName: "Maria",
        lastName: "de la Cruz",
        customerEmail: "maria@example.test",
        partyType,
        contractingPartyName: partyType === "registered_business"
          ? "Cruz Studio B.V."
          : "Maria de la Cruz",
        kvkNumber: partyType === "registered_business" ? "12345678" : null,
        intendedCompanyName: partyType === "business_in_formation"
          ? "Cruz Studio"
          : null,
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

      expect(registrant).toMatchObject({
        firstName: "Maria",
        lastName: "de la Cruz",
      })
    },
  )
})
