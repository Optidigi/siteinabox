import crypto from "node:crypto"
import { getPayload, type CollectionSlug } from "payload"
import { getCurrentLegalDocument } from "@siteinabox/legal-content"
import config from "@/payload.config"
import type { LegalDocument, Tenant, User } from "@/payload-types"

const TENANT_SLUG = "legal-visual"
const TENANT_DOMAIN = "legal-visual.localhost"
const OWNER_EMAIL = "owner@legal-visual.test"
const EDITOR_EMAIL = "editor@legal-visual.test"
const OWNER_PASSWORD = "LegalVisualOwner!2026"
const EDITOR_PASSWORD = "LegalVisualEditor!2026"
const REQUIREMENT_KEY = "visual-fixture:mandatory-reaccept:owner"

if (process.env.NODE_ENV === "production") throw new Error("Legal visual fixtures are disabled in production.")
const databaseUrl = new URL(process.env.DATABASE_URI ?? "")
if (databaseUrl.pathname.replace(/^\//, "") !== "payload_test") {
  throw new Error(`Refusing to seed non-test database: ${databaseUrl.pathname || "unknown"}`)
}

const payload = await getPayload({ config })

const findOne = async <T>(collection: CollectionSlug, where: Record<string, unknown>, depth = 0) => {
  const result = await payload.find({ collection, where, limit: 1, depth, overrideAccess: true })
  return result.docs[0] as T | undefined
}

let tenant = await findOne<Tenant>("tenants", { slug: { equals: TENANT_SLUG } })
if (!tenant) {
  tenant = await payload.create({
    collection: "tenants",
    data: { name: "Legal Visual Test", slug: TENANT_SLUG, domain: TENANT_DOMAIN, status: "active" },
    depth: 0,
    overrideAccess: true,
  })
} else {
  tenant = await payload.update({
    collection: "tenants",
    id: tenant.id,
    data: { name: "Legal Visual Test", domain: TENANT_DOMAIN, status: "active" },
    depth: 0,
    overrideAccess: true,
  })
}

const upsertUser = async (email: string, password: string, role: "owner" | "editor", name: string) => {
  const existing = await findOne<User>("users", { email: { equals: email } })
  const data = { email, password, name, role, tenants: [{ tenant: tenant!.id }] }
  if (!existing) {
    return payload.create({ collection: "users", data, depth: 0, overrideAccess: true })
  }
  return payload.update({
    collection: "users",
    id: existing.id,
    data,
    context: { allowSelfPasswordChange: true },
    depth: 0,
    overrideAccess: true,
  })
}

const owner = await upsertUser(OWNER_EMAIL, OWNER_PASSWORD, "owner", "Legal Visual Owner")
await upsertUser(EDITOR_EMAIL, EDITOR_PASSWORD, "editor", "Legal Visual Editor")

const settings = await findOne("site-settings", { tenant: { equals: tenant.id } })
if (!settings) {
  await payload.create({
    collection: "site-settings",
    data: {
      tenant: tenant.id,
      siteName: "Legal Visual Test",
      siteUrl: `https://${TENANT_DOMAIN}`,
      contactEmail: OWNER_EMAIL,
    },
    depth: 0,
    overrideAccess: true,
  })
}

const release = getCurrentLegalDocument("platform-terms", "nl", new Date())
let terms = await findOne<LegalDocument>("legal-documents", { releaseKey: { equals: `${release.documentType}:${release.locale}:${release.documentVersion}` } })
if (!terms) {
  terms = await payload.create({
    collection: "legal-documents",
    data: {
      releaseKey: `${release.documentType}:${release.locale}:${release.documentVersion}`,
      documentType: release.documentType,
      locale: release.locale,
      documentVersion: release.documentVersion,
      acceptanceVersion: release.acceptanceVersion,
      content: release.markdown,
      contentHash: release.contentHash,
      sourceCommit: "local-legal-visual-fixture",
      publishedAt: release.publishedAt,
      effectiveAt: release.effectiveAt,
      changeCategory: release.change.category,
      changeSummary: release.change.summary,
      changeRationale: release.change.rationale,
      customerAction: release.change.customerAction,
      consentAction: release.change.consentAction,
      audience: release.change.audience,
    },
    depth: 0,
    overrideAccess: true,
  })
}
if (!terms?.acceptanceVersion) throw new Error("Current terms document is unavailable for the visual fixture.")

const historyKey = `visual-fixture:history:${tenant.id}:${terms.acceptanceVersion}`
if (!await findOne("agreement-acceptances", { evidenceKey: { equals: historyKey } })) {
  await payload.create({
    collection: "agreement-acceptances",
    data: {
      evidenceKey: historyKey,
      tenant: tenant.id,
      document: terms.id,
      documentVersion: terms.documentVersion,
      acceptanceVersion: terms.acceptanceVersion,
      contentHash: terms.contentHash,
      statementVersion: "visual-fixture-history-1",
      statementText: "Visuele test van eerdere acceptatie.",
      actorUser: owner.id,
      actorEmail: OWNER_EMAIL,
      acceptedAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      requestId: crypto.randomUUID(),
    },
    depth: 0,
    overrideAccess: true,
  })
}

const requirementData = {
  tenant: tenant.id,
  subjectEmail: OWNER_EMAIL,
  document: terms.id,
  action: "mandatory_reaccept" as const,
  status: "pending" as const,
  enforceAt: new Date(Date.now() - 86_400_000).toISOString(),
  notifiedAt: null,
  satisfiedAt: null,
  acceptance: null,
  lastError: null,
}
const requirement = await findOne("legal-requirements", { requirementKey: { equals: REQUIREMENT_KEY } })
if (requirement) {
  await payload.update({ collection: "legal-requirements", id: requirement.id, data: requirementData, depth: 0, overrideAccess: true })
} else {
  await payload.create({
    collection: "legal-requirements",
    data: { requirementKey: REQUIREMENT_KEY, ...requirementData },
    depth: 0,
    overrideAccess: true,
  })
}

payload.logger.info(`[legal-visual-fixture] ready tenant=${TENANT_DOMAIN} owner=${OWNER_EMAIL} editor=${EDITOR_EMAIL}`)
await payload.db.destroy?.()
