import { describe, expect, it, vi } from "vitest"
import {
  createOrderAndAcceptanceEvidence,
  createSiteApprovalEvidence,
  verifyCheckoutEvidence,
} from "@/lib/legal/checkoutEvidence"
import { buildCheckoutQuote } from "@/lib/checkout/checkoutQuote"
import type { CheckoutProfile } from "@/payload-types"

import { asGenerationRun, asTenant, cast } from "../_helpers/cast"
import type { Config } from "@/payload-types"
import { createGeneratedPayloadStore } from "../_helpers/generatedPayloadStore"
import { siteSettingsFixture, legalDocumentFixture } from "../_helpers/generatedDocs"

const completeRegistrant = {
  companyName: "Demo B.V.",
  firstName: "Client",
  lastName: "Name",
  email: "client@example.com",
  street: "Markt",
  number: "1",
  suffix: null,
  zipcode: "6041AA",
  city: "Roermond",
  country: "NL",
  state: null,
  phoneCountryCode: "+31",
  phoneAreaCode: "475",
  phoneSubscriberNumber: "123456",
  locale: "nl_NL",
}

const createPayload = async () => {
  type Collection = "site-settings" | "site-review-revisions" | "site-approvals" | "orders" | "agreement-acceptances" | "legal-documents"
  const stores: { [C in Collection]: Config["collections"][C][] } = {
    "site-settings": [siteSettingsFixture({ id: 1, tenant: 10, siteName: "Demo", updatedAt: "2026-07-10T10:00:00.000Z" })],
    "site-review-revisions": [],
    "site-approvals": [],
    orders: [],
    "agreement-acceptances": [],
    "legal-documents": [
      legalDocumentFixture({
        id: 20,
        documentType: "platform-terms",
        locale: "nl",
        documentVersion: "2026-07-07.1",
        acceptanceVersion: "platform-terms-2026-07-07",
        contentHash: "sha256:terms",
        publishedAt: "2026-07-07T00:00:00.000Z",
        effectiveAt: "2026-07-07T00:00:00.000Z",
      }),
      legalDocumentFixture({
        id: 21,
        documentType: "platform-privacy",
        locale: "nl",
        documentVersion: "2026-07-07.1",
        acceptanceVersion: null,
        contentHash: "sha256:privacy",
        publishedAt: "2026-07-07T00:00:00.000Z",
        effectiveAt: "2026-07-07T00:00:00.000Z",
      }),
    ],
  }
  const { payload } = await createGeneratedPayloadStore({ collections: stores, nextId: 100, unique: [{ collection: "orders", fields: ["orderNumber"] }, { collection: "agreement-acceptances", fields: ["evidenceKey"] }] })
  return { payload, stores }
}

describe("checkout legal evidence", () => {
  it("freezes review, approval, order, documents, and terms acceptance idempotently", async () => {
    const { payload, stores } = await createPayload()
    const run = asGenerationRun({ id: 30, specHash: "spec", updatedAt: "2026-07-10T10:00:00.000Z" })
    const tenant = asTenant({ id: 10, name: "Demo", theme: { primary: "#000" }, siteManifest: { version: 1 } })
    const pages = cast<Parameters<typeof createSiteApprovalEvidence>[0]["pages"]>([
      { id: 40, slug: "index", title: "Home", status: "published", blocks: [{ blockType: "hero" }] },
    ])

    const approval = await createSiteApprovalEvidence({
      payload, run, tenant, pages, domain: "demo.nl", actorEmail: "Client@Example.com", requestId: "req-1",
    })
    const first = await createOrderAndAcceptanceEvidence({
      payload,
      run,
      tenant,
      approval: approval.approval,
      checkoutProfile: cast<CheckoutProfile>({
        id: 50,
        profileKey: "run:30:checkout-profile:1",
        profileVersion: 1,
        generationRun: 30,
        customerName: "Client Name",
        customerEmail: "Client@Example.com",
        partyType: "registered_business",
        contractingPartyName: "Demo B.V.",
        kvkNumber: "12345678",
        domainRegistrantSource: "contracting_party",
        billingAddress: { city: "Roermond" },
        createdAt: "2026-07-10T11:00:00.000Z",
      }),
      quote: buildCheckoutQuote({
        billingPeriod: "annual",
        providerOperationPriceNetMinor: 1_000,
        selectedDomain: "demo.nl",
        providerQuotedAt: "2026-07-27T11:55:00.000Z",
        profileVersion: 1,
        draftVersion: "draft-30",
        now: new Date("2026-07-27T11:56:00.000Z"),
      }),
      domainRegistrant: completeRegistrant,
      domain: "demo.nl",
      requestId: "req-1",
      now: new Date("2026-07-27T12:00:00.000Z"),
    })
    const second = await createOrderAndAcceptanceEvidence({
      payload,
      run,
      tenant,
      approval: approval.approval,
      checkoutProfile: cast<CheckoutProfile>({
        id: 50,
        profileKey: "run:30:checkout-profile:1",
        profileVersion: 1,
        generationRun: 30,
        customerName: "Client Name",
        customerEmail: "client@example.com",
        partyType: "registered_business",
        contractingPartyName: "Demo B.V.",
        kvkNumber: "12345678",
        domainRegistrantSource: "contracting_party",
        billingAddress: { city: "Roermond" },
        createdAt: "2026-07-10T11:00:00.000Z",
      }),
      quote: buildCheckoutQuote({
        billingPeriod: "annual",
        providerOperationPriceNetMinor: 1_000,
        selectedDomain: "demo.nl",
        providerQuotedAt: "2026-07-27T11:55:00.000Z",
        profileVersion: 1,
        draftVersion: "draft-30",
        now: new Date("2026-07-27T11:56:01.000Z"),
      }),
      domainRegistrant: completeRegistrant,
      domain: "demo.nl",
      requestId: "req-2",
      now: new Date("2026-07-27T12:00:00.000Z"),
    })

    expect(stores["site-review-revisions"]).toHaveLength(1)
    expect(stores["site-approvals"]).toHaveLength(1)
    expect(stores.orders).toHaveLength(1)
    expect(stores["agreement-acceptances"]).toHaveLength(1)
    expect(first.order.id).toBe(second.order.id)
    expect(first.order.legalDocuments).toEqual([20, 21])
    expect(first.order).toMatchObject({
      state: "accepted",
      checkoutProfileKey: "run:30:checkout-profile:1",
      catalogVersion: "2026-07-29.1",
      subtotalNetMinor: 19_000,
      vatAmountMinor: 3_990,
      totalGrossMinor: 22_990,
      contractingPartyProfileVersion: 1,
      businessUseDeclarationVersion: "business-use-declaration-2026-07-26.1",
      totalGross: 229.9,
      quoteEvidence: {
        schemaVersion: 4,
        initialAuthorityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        selectedDomain: "demo.nl",
        transferRenewalEffect: null,
        planPriceNetMinor: 19_000,
        subtotalNetMinor: 19_000,
        vatAmountMinor: 3_990,
        grossPayableNowMinor: 22_990,
        futureSubscriptionGrossMinor: 22_990,
        tldCapability: {
          tld: "nl",
          capabilityVersion: "tld-nl-2026-07-26.1",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          transferRenewalEffect: null,
        },
      },
    })
    expect(first.acceptance).toMatchObject({
      documentVersion: "2026-07-07.1",
      acceptanceVersion: "platform-terms-2026-07-07",
      contentHash: "sha256:terms",
      statementVersion: "platform-terms-acceptance-2026-07-07.1",
    })
    await expect(verifyCheckoutEvidence(payload, {
      runId: 30,
      orderId: first.order.id,
      customerEmail: "client@example.com",
    })).resolves.toMatchObject({ order: { domain: "demo.nl" } })
  })

  it("rejects reuse when immutable approval, registrant, or commercial evidence changes", async () => {
    const { payload, stores } = await createPayload()
    const run = asGenerationRun({ id: 31, specHash: "spec", updatedAt: "draft-31" })
    const tenant = asTenant({ id: 10, name: "Demo" })
    const approval = await createSiteApprovalEvidence({
      payload,
      run,
      tenant,
      pages: [],
      domain: "demo.nl",
      actorEmail: "client@example.com",
      requestId: "req-approval",
    })
    const checkoutProfile = cast<CheckoutProfile>({
      id: 51,
      profileKey: "run:31:checkout-profile:1",
      profileVersion: 1,
      generationRun: 31,
      customerName: "Maria de la Cruz",
      firstName: "Maria",
      lastName: "de la Cruz",
      customerEmail: "client@example.com",
      partyType: "business_in_formation",
      contractingPartyName: "Maria de la Cruz",
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
      intendedCompanyName: "Cruz Studio",
      billingAddress: { city: "Utrecht" },
      createdAt: "2026-07-28T12:00:00.000Z",
    })
    const quote = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
      selectedDomain: "demo.nl",
      providerQuotedAt: "2026-07-28T11:55:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-31",
      now: new Date("2026-07-28T11:56:00.000Z"),
    })
    const common = {
      payload,
      run,
      tenant,
      approval: approval.approval,
      checkoutProfile,
      quote,
      domainRegistrant: {
        ...completeRegistrant,
        firstName: "Maria",
        lastName: "de la Cruz",
      },
      domain: "demo.nl",
      now: new Date("2026-07-28T12:00:00.000Z"),
    }
    await createOrderAndAcceptanceEvidence({
      ...common,
      requestId: "req-first",
    })

    await expect(createOrderAndAcceptanceEvidence({
      ...common,
      domainRegistrant: { ...common.domainRegistrant, email: "other@example.com" },
      requestId: "req-registrant-changed",
    })).rejects.toThrow("different immutable initial-order authority")
    await expect(createOrderAndAcceptanceEvidence({
      ...common,
      approval: cast({ ...approval.approval, snapshotHash: "changed-snapshot" }),
      requestId: "req-approval-changed",
    })).rejects.toThrow("different immutable initial-order authority")
    await expect(createOrderAndAcceptanceEvidence({
      ...common,
      quote: {
        ...quote,
        lineItems: quote.lineItems.map((item, index) =>
          index === 0 ? { ...item, description: `${item.description} changed` } : item),
      },
      requestId: "req-line-item-changed",
    })).rejects.toThrow("different immutable initial-order authority")

    expect(stores.orders).toHaveLength(1)
    expect(stores["agreement-acceptances"]).toHaveLength(1)
  })

  it("rejects a forged assisted charge before creating current-catalog evidence", async () => {
    const { payload, stores } = await createPayload()
    const run = asGenerationRun({ id: 32, specHash: "spec", updatedAt: "draft-32" })
    const tenant = asTenant({ id: 10, name: "Demo" })
    const approval = await createSiteApprovalEvidence({
      payload,
      run,
      tenant,
      pages: [],
      domain: "demo.nl",
      actorEmail: "client@example.com",
      requestId: "req-approval",
    })
    const profile = cast<CheckoutProfile>({
      id: 52,
      profileKey: "run:32:checkout-profile:1",
      profileVersion: 1,
      generationRun: 32,
      customerName: "Client Name",
      customerEmail: "client@example.com",
      partyType: "registered_business",
      contractingPartyName: "Demo B.V.",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: { city: "Utrecht" },
      createdAt: "2026-07-29T10:00:00.000Z",
    })
    const quote = buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
      selectedDomain: "demo.nl",
      providerQuotedAt: "2026-07-29T12:55:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-32",
      now: new Date("2026-07-29T12:56:00.000Z"),
    })

    await expect(createOrderAndAcceptanceEvidence({
      payload,
      run,
      tenant,
      approval: approval.approval,
      checkoutProfile: profile,
      quote: {
        ...quote,
        migrationClassification: "assisted_standard",
        migrationServiceFeeNetMinor: 4_900,
        lineItems: [
          ...quote.lineItems,
          {
            code: "migration-assisted-standard-per-domain",
            description: "Retired",
            quantity: 1,
            netAmountMinor: 4_900,
          },
        ],
      },
      domainRegistrant: completeRegistrant,
      domain: "demo.nl",
      requestId: "req-forged",
      now: new Date("2026-07-29T13:00:00.000Z"),
    })).rejects.toThrow("assisted migration charges")
    expect(stores.orders).toHaveLength(0)
  })
})
