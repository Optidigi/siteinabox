import "server-only"

import crypto from "node:crypto"
import type { Payload, Where } from "payload"
import type {
  AgreementAcceptance,
  CheckoutProfile,
  Order,
  Page,
  SiteApproval,
  SiteGenerationRun,
  SiteReviewRevision,
  Tenant,
} from "@/payload-types"
import {
  BUSINESS_USE_DECLARATION_TEXT_NL,
  BUSINESS_USE_DECLARATION_VERSION,
} from "@siteinabox/legal-content"
import {
  businessUseDeclarationAcceptanceSchema,
  COMMERCIAL_CATALOG_VERSION,
} from "@siteinabox/contracts/commerce"
import {
  getTldCapabilityForProductionOperation,
  validateTldRegistrantPrerequisites,
} from "@siteinabox/contracts/tld-capabilities"
import type { CheckoutQuote } from "@/lib/checkout/checkoutQuote"
import { normalizeDomainRegistrantDetails } from "@/lib/domains/orderState"
import { getCurrentLegalDocumentRecord } from "@/lib/legal/legalDocuments"
import { findOneDoc } from "@/lib/payloadCollection"
import { legalStatements } from "@/lib/legal/statements"
import { relationshipId } from "@/lib/relationshipId"

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const sha256 = (value: unknown): string =>
  crypto.createHash("sha256").update(stableStringify(value)).digest("hex")

const initialOrderClaim = (runId: string | number) => ({
  kind: "initial_subscription",
  generationRunId: String(runId),
})

const nonvolatileQuoteEvidence = (quote: CheckoutQuote): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(quote).filter(
      ([key]) =>
        key !== "quoteIssuedAt" &&
        key !== "quoteExpiresAt" &&
        key !== "migrationInputEnvelope",
    ),
  )

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const pageEvidence = (page: Page) => ({
  id: page.id,
  slug: page.slug,
  title: page.title,
  status: page.status,
  blocks: page.blocks,
  seo: page.seo,
  updatedAt: page.updatedAt,
})

export async function createSiteApprovalEvidence(input: {
  payload: Payload
  run: SiteGenerationRun
  tenant: Tenant
  pages: Page[]
  domain: string
  actorEmail: string
  requestId: string
  now?: Date
}) {
  const settingsResult = await input.payload.find({
    collection: "site-settings",
    where: { tenant: { equals: input.tenant.id } },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  const snapshot = {
    schemaVersion: 1,
    tenantId: input.tenant.id,
    generationRunId: input.run.id,
    domain: input.domain,
    specHash: input.run.specHash ?? null,
    pages: input.pages.map(pageEvidence).sort((left, right) => String(left.slug).localeCompare(String(right.slug))),
    settings: settingsResult.docs[0] ?? null,
    theme: input.tenant.theme ?? null,
    siteManifest: input.tenant.siteManifest ?? null,
  }
  const snapshotHash = sha256(snapshot)
  const revisionKey = `run:${input.run.id}:review:${snapshotHash}`
  let revision = await findOneDoc(input.payload, "site-review-revisions", { revisionKey: { equals: revisionKey } })
  if (!revision) {
    revision = await input.payload.create({
      collection: "site-review-revisions",
      data: {
        revisionKey,
        tenant: input.tenant.id,
        generationRun: input.run.id,
        domain: input.domain,
        snapshotHash,
        snapshot,
        createdAt: (input.now ?? new Date()).toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    })
  }

  const normalizedEmail = input.actorEmail.trim().toLowerCase()
  const evidenceKey = `approval:${input.run.id}:${snapshotHash}:${sha256(normalizedEmail).slice(0, 16)}`
  let approval = await findOneDoc(input.payload, "site-approvals", { evidenceKey: { equals: evidenceKey } })
  if (!approval) {
    approval = await input.payload.create({
      collection: "site-approvals",
      data: {
        evidenceKey,
        tenant: input.tenant.id,
        reviewRevision: revision.id,
        domain: input.domain,
        snapshotHash,
        statementVersion: legalStatements.previewApproval.version,
        statementText: legalStatements.previewApproval.text,
        actorEmail: normalizedEmail,
        approvedAt: (input.now ?? new Date()).toISOString(),
        requestId: input.requestId,
      },
      depth: 0,
      overrideAccess: true,
    })
  }

  return { revision, approval, snapshotHash }
}

export async function createOrderAndAcceptanceEvidence(input: {
  payload: Payload
  run: SiteGenerationRun
  tenant: Tenant
  approval: SiteApproval
  checkoutProfile: CheckoutProfile
  quote: CheckoutQuote
  domainRegistrant: Record<string, unknown>
  domain: string
  requestId: string
  ipAddress?: string | null
  userAgent?: string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  if (
    input.quote.selectedDomain !== input.domain ||
    input.quote.profileVersion !== input.checkoutProfile.profileVersion ||
    Date.parse(input.quote.quoteExpiresAt) <= now.getTime()
  ) {
    throw new Error("Accepted checkout quote does not match the domain, profile, or acceptance time.")
  }
  const [terms, privacy] = await Promise.all([
    getCurrentLegalDocumentRecord(input.payload, "platform-terms", "nl", now),
    getCurrentLegalDocumentRecord(input.payload, "platform-privacy", "nl", now),
  ])
  if (!terms.acceptanceVersion) throw new Error("Current platform terms are missing an acceptance version.")

  businessUseDeclarationAcceptanceSchema.parse({
    declarationVersion: BUSINESS_USE_DECLARATION_VERSION,
    accepted: true,
  })
  const totalGross = input.quote.grossAmountMinor / 100
  const subtotalNet = input.quote.netAmountMinor / 100
  const vatAmount = input.quote.vatAmountMinor / 100
  const acceptedAt = now.toISOString()
  const tld = input.domain.split(".").at(-1)?.toLowerCase() ?? ""
  const operation = input.quote.domainMode === "existing_domain"
    ? "incoming_transfer"
    : "registration"
  const tldCapability = getTldCapabilityForProductionOperation(tld, operation, now)
  if (!tldCapability) {
    throw new Error(`TLD .${tld} is not enabled for accepted-order evidence.`)
  }
  const expectedTransferRenewalEffect = input.quote.domainMode === "existing_domain"
    ? tldCapability.transfer.renewalEffect
    : null
  if (input.quote.transferRenewalEffect !== expectedTransferRenewalEffect) {
    throw new Error(
      `Checkout transfer-renewal evidence does not match the governed .${tld} capability.`,
    )
  }
  const normalizedRegistrant = normalizeDomainRegistrantDetails(input.domainRegistrant)
  if (!normalizedRegistrant) {
    throw new Error("Accepted checkout requires complete registrant evidence.")
  }
  const registrantPrerequisites = validateTldRegistrantPrerequisites(
    tldCapability,
    normalizedRegistrant,
  )
  if (!registrantPrerequisites.valid) {
    throw new Error(
      `Registrant evidence does not satisfy .${tld} requirements: ` +
      registrantPrerequisites.reason,
    )
  }
  const initialAuthority = {
    schemaVersion: 1,
    generationRunId: String(input.run.id),
    tenantId: String(input.tenant.id),
    domain: input.domain,
    checkoutProfileKey: input.checkoutProfile.profileKey,
    checkoutProfileVersion: input.checkoutProfile.profileVersion,
    quote: nonvolatileQuoteEvidence(input.quote),
    registrant: input.domainRegistrant,
    approval: {
      snapshotHash: input.approval.snapshotHash,
      statementVersion: input.approval.statementVersion,
      statementText: input.approval.statementText,
      actorEmail: input.approval.actorEmail,
    },
    terms: {
      documentVersion: terms.documentVersion,
      acceptanceVersion: terms.acceptanceVersion,
      contentHash: terms.contentHash,
    },
    privacy: {
      documentVersion: privacy.documentVersion,
      contentHash: privacy.contentHash,
    },
    businessUseDeclaration: {
      version: BUSINESS_USE_DECLARATION_VERSION,
      text: BUSINESS_USE_DECLARATION_TEXT_NL,
    },
    tldCapability: {
      tld: tldCapability.tld,
      capabilityVersion: tldCapability.capabilityVersion,
      effectiveFrom: tldCapability.effectiveFrom,
      transferRenewalEffect: expectedTransferRenewalEffect,
    },
  }
  const initialAuthorityHash = sha256(initialAuthority)
  const orderNumber =
    `SIAB-${input.run.id}-${sha256(initialOrderClaim(input.run.id)).slice(0, 12).toUpperCase()}`
  let order = await findOneDoc(input.payload, "orders", { orderNumber: { equals: orderNumber } })
  if (!order) {
    if (input.quote.catalogVersion !== COMMERCIAL_CATALOG_VERSION) {
      throw new Error("New accepted orders require the current commercial catalog.")
    }
    if (
      input.quote.migrationServiceFeeNetMinor !== 0 ||
      input.quote.lineItems.some(
        (item) => item.code === "migration-assisted-standard-per-domain",
      )
    ) {
      throw new Error("New accepted orders cannot contain assisted migration charges.")
    }
    if (
      input.quote.domainMode === "new_registration" &&
      (
        input.quote.migrationClassification !== null ||
        input.quote.migrationSourceMechanism !== null ||
        input.quote.migrationSourceZoneHash !== null ||
        input.quote.migrationInputEnvelope !== null ||
        input.quote.migrationSecretKey !== null
      )
    ) {
      throw new Error("New-domain orders cannot contain migration evidence.")
    }
    if (
      input.quote.domainMode === "existing_domain" &&
      (
        input.quote.migrationClassification !== "automatic" ||
        !input.quote.migrationSourceMechanism ||
        input.quote.migrationSourceMechanism ===
          "customer_authorized_provider_export_v1" ||
        !input.quote.migrationSourceZoneHash ||
        !input.quote.migrationSecretKey
      )
    ) {
      throw new Error("New existing-domain orders require an automatic migration.")
    }
    try {
      order = await input.payload.create({
        collection: "orders",
        data: {
        orderNumber,
        tenant: input.tenant.id,
        generationRun: input.run.id,
        state: "accepted",
        orderKind: "initial_subscription",
        checkoutProfileKey: input.checkoutProfile.profileKey,
        catalogVersion: input.quote.catalogVersion,
        quoteEvidence: {
          schemaVersion: input.quote.schemaVersion,
          initialAuthorityHash,
          catalogVersion: input.quote.catalogVersion,
          quoteIssuedAt: input.quote.quoteIssuedAt,
          quoteExpiresAt: input.quote.quoteExpiresAt,
          providerQuotedAt: input.quote.providerQuotedAt,
          draftVersion: input.quote.draftVersion,
          profileVersion: input.quote.profileVersion,
          selectedDomain: input.quote.selectedDomain,
          domainMode: input.quote.domainMode,
          checkoutProfileKey: input.checkoutProfile.profileKey,
          checkoutProfileVersion: input.checkoutProfile.profileVersion,
          domain: input.domain,
          planPriceNetMinor: input.quote.planPriceNetMinor,
          domainIncludedAllowanceNetMinor: input.quote.domainIncludedAllowanceNetMinor,
          providerOperationPriceNetMinor: input.quote.providerOperationPriceNetMinor,
          domainSurchargeNetMinor: input.quote.domainSurchargeNetMinor,
          migrationServiceFeeNetMinor: input.quote.migrationServiceFeeNetMinor,
          subtotalNetMinor: input.quote.netAmountMinor,
          vatRateBasisPoints: input.quote.vatRateBasisPoints,
          vatAmountMinor: input.quote.vatAmountMinor,
          grossPayableNowMinor: input.quote.grossAmountMinor,
          futureSubscriptionNetMinor: input.quote.futureSubscriptionNetMinor,
          futureSubscriptionVatMinor: input.quote.futureSubscriptionVatMinor,
          futureSubscriptionGrossMinor: input.quote.futureSubscriptionGrossMinor,
          transferRenewalEffect: input.quote.transferRenewalEffect,
          domainRenewalExplanation: input.quote.domainRenewalExplanation,
          tldCapability: {
            tld: tldCapability.tld,
            capabilityVersion: tldCapability.capabilityVersion,
            effectiveFrom: tldCapability.effectiveFrom,
            transferRenewalEffect: input.quote.transferRenewalEffect,
          },
          businessUseDeclaration: {
            version: BUSINESS_USE_DECLARATION_VERSION,
            text: BUSINESS_USE_DECLARATION_TEXT_NL,
            accepted: true,
          },
          ...(input.quote.migrationClassification
            ? {
                migration: {
                  classification: input.quote.migrationClassification,
                  sourceMechanism: input.quote.migrationSourceMechanism,
                  sourceZoneHash: input.quote.migrationSourceZoneHash,
                  checkoutSecretKey: input.quote.migrationSecretKey,
                  expectedOperatorTechnicalAction:
                    input.quote.migrationClassification === "assisted_standard",
                  netAmountMinor: input.quote.migrationClassification === "assisted_standard"
                    ? input.quote.lineItems.find(
                        (item) =>
                          item.code === "migration-assisted-standard-per-domain",
                      )?.netAmountMinor ?? 0
                    : 0,
                },
              }
            : {}),
        },
        netLineItems: input.quote.lineItems,
        vatRateBasisPoints: 2_100,
        subtotalNetMinor: input.quote.netAmountMinor,
        vatAmountMinor: input.quote.vatAmountMinor,
        totalGrossMinor: input.quote.grossAmountMinor,
        contractingPartyProfileVersion: input.checkoutProfile.profileVersion,
        termsVersion: terms.acceptanceVersion,
        privacyVersion: privacy.documentVersion,
        businessUseDeclarationVersion: BUSINESS_USE_DECLARATION_VERSION,
        acceptedAt,
        acceptanceIpAddress: input.ipAddress ?? undefined,
        acceptanceUserAgent: input.userAgent ?? undefined,
        customerName: input.checkoutProfile.customerName,
        customerEmail: input.checkoutProfile.customerEmail.trim().toLowerCase(),
        companyName: input.checkoutProfile.partyType === "registered_business"
          ? input.checkoutProfile.contractingPartyName
          : input.checkoutProfile.intendedCompanyName || input.checkoutProfile.customerName,
        billingAddress: input.checkoutProfile.billingAddress,
        packageCode: input.quote.packageCode,
        billingPeriod: input.quote.billingPeriod,
        renewalTerms: input.quote.billingPeriod === "annual"
          ? "Jaarabonnement met verlengingsintentie; opzegging annuleert alleen nog niet betaalde of vastgelegde toekomstige cycli."
          : "Maandabonnement met verlengingsintentie; opzegging annuleert alleen nog niet betaalde of vastgelegde toekomstige cycli.",
        lineItems: input.quote.lineItems,
        currency: input.quote.currency,
        subtotalNet,
        vatAmount,
        totalGross,
        domain: input.domain,
        domainRegistrant: input.domainRegistrant,
        legalDocuments: [terms.id, privacy.id],
        paymentStatus: "pending",
        paymentProvider: "mollie",
        createdAt: now.toISOString(),
      },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      const raced = await findOneDoc(input.payload, "orders", {
        orderNumber: { equals: orderNumber },
      })
      if (!raced) throw error
      order = raced
    }
  }
  const frozenAuthorityHash = recordValue(order.quoteEvidence)?.initialAuthorityHash
  if (frozenAuthorityHash !== initialAuthorityHash) {
    throw new Error(
      "This checkout already has a different immutable initial-order authority.",
    )
  }

  const evidenceKey = `order:${order.id}:terms:${terms.acceptanceVersion}`
  let acceptance = await findOneDoc(input.payload, "agreement-acceptances", { evidenceKey: { equals: evidenceKey } })
  if (!acceptance) {
    try {
      acceptance = await input.payload.create({
        collection: "agreement-acceptances",
        data: {
        evidenceKey,
        tenant: input.tenant.id,
        order: order.id,
        document: terms.id,
        documentVersion: terms.documentVersion,
        acceptanceVersion: terms.acceptanceVersion,
        contentHash: terms.contentHash,
        statementVersion: legalStatements.termsAcceptance.version,
        statementText: legalStatements.termsAcceptance.text,
        actorEmail: input.checkoutProfile.customerEmail.trim().toLowerCase(),
        acceptedAt,
        requestId: input.requestId,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      const raced = await findOneDoc(input.payload, "agreement-acceptances", {
        evidenceKey: { equals: evidenceKey },
      })
      if (!raced) throw error
      acceptance = raced
    }
  }

  return { order, acceptance, terms, privacy }
}

export async function verifyCheckoutEvidence(payload: Payload, input: {
  runId: string | number
  orderId: string | number
  customerEmail: string
}) {
  const order = await payload.findByID({
    collection: "orders",
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  })
  if (relationshipId(order.generationRun) !== String(input.runId)) {
    throw new Error("Checkout order does not belong to this generation run.")
  }
  if (String(order.customerEmail).toLowerCase() !== input.customerEmail.trim().toLowerCase()) {
    throw new Error("Checkout order does not belong to this customer.")
  }
  const acceptance = await findOneDoc(payload, "agreement-acceptances", { order: { equals: order.id } } satisfies Where)
  if (!acceptance) throw new Error("Mollie checkout requires recorded terms acceptance.")
  return { order: order as Order, acceptance: acceptance as AgreementAcceptance }
}
