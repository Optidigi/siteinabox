import "server-only"

import crypto from "node:crypto"
import type { Payload, Where } from "payload"
import type {
  AgreementAcceptance,
  Order,
  Page,
  SiteApproval,
  SiteGenerationRun,
  SiteReviewRevision,
  Tenant,
} from "@/payload-types"
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

const vatBreakdown = (gross: number, vatRate = 21) => {
  const net = Math.round((gross / (1 + vatRate / 100)) * 100) / 100
  return { net, vat: Math.round((gross - net) * 100) / 100 }
}

export async function createOrderAndAcceptanceEvidence(input: {
  payload: Payload
  run: SiteGenerationRun
  tenant: Tenant
  approval: SiteApproval
  customerEmail: string
  customerName: string
  companyName: string
  billingAddress: Record<string, unknown>
  domainRegistrant: Record<string, unknown>
  domain: string
  totalAmount: string
  currency: string
  packageCode?: string
  requestId: string
  ipAddress?: string | null
  userAgent?: string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  const [terms, privacy] = await Promise.all([
    getCurrentLegalDocumentRecord(input.payload, "platform-terms", "nl", now),
    getCurrentLegalDocumentRecord(input.payload, "platform-privacy", "nl", now),
  ])
  if (!terms.acceptanceVersion) throw new Error("Current platform terms are missing an acceptance version.")

  const totalGross = Number(input.totalAmount)
  if (!Number.isFinite(totalGross) || totalGross <= 0) throw new Error("Checkout total must be a positive amount.")
  const totals = vatBreakdown(totalGross)
  const orderIdentity = {
    runId: input.run.id,
    domain: input.domain,
    totalAmount: input.totalAmount,
    currency: input.currency,
    terms: terms.contentHash,
    privacy: privacy.contentHash,
    approval: input.approval.snapshotHash,
  }
  const orderNumber = `SIAB-${input.run.id}-${sha256(orderIdentity).slice(0, 12).toUpperCase()}`
  let order = await findOneDoc(input.payload, "orders", { orderNumber: { equals: orderNumber } })
  if (!order) {
    order = await input.payload.create({
      collection: "orders",
      data: {
        orderNumber,
        tenant: input.tenant.id,
        generationRun: input.run.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail.trim().toLowerCase(),
        companyName: input.companyName,
        billingAddress: input.billingAddress,
        packageCode: input.packageCode ?? process.env.SIAB_SITE_PACKAGE_CODE ?? "siteinabox-website",
        billingPeriod: "annual",
        renewalTerms: "Eerste jaar vooraf betaald; daarna maandelijkse verlenging met een opzegtermijn van een maand.",
        lineItems: [{
          code: "siteinabox-first-year",
          description: `Site in a Box website inclusief domein voor ${input.domain}`,
          quantity: 1,
          totalGross,
        }],
        currency: input.currency,
        subtotalNet: totals.net,
        vatAmount: totals.vat,
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
  }

  const evidenceKey = `order:${order.id}:terms:${terms.acceptanceVersion}`
  let acceptance = await findOneDoc(input.payload, "agreement-acceptances", { evidenceKey: { equals: evidenceKey } })
  if (!acceptance) {
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
        actorEmail: input.customerEmail.trim().toLowerCase(),
        acceptedAt: now.toISOString(),
        requestId: input.requestId,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
      depth: 0,
      overrideAccess: true,
    })
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
