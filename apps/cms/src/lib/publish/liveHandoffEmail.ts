import "server-only"

import crypto from "node:crypto"
import type { Payload } from "payload"
import type { SiteGenerationRun, Tenant } from "@/payload-types"
import { auth } from "@/lib/betterAuth"
import { relationshipId } from "@/lib/relationshipId"
import { provisionDefaultTenantEmailPreferences } from "@/lib/legal/communicationPreferences"

type SnapshotDoc = {
  id?: string | number | null
  status?: string | null
  domain?: string | null
  snapshot?: {
    siteUrl?: string | null
    domain?: string | null
    settings?: {
      siteUrl?: string | null
    } | null
  } | null
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const cleaned = value.trim()
  return cleaned ? cleaned : null
}

const cleanEmail = (value: unknown): string | null => {
  const email = cleanText(value)?.toLowerCase()
  if (!email || email.includes("\n") || email.includes("\r")) return null
  return emailPattern.test(email) ? email : null
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

const normalizeHandoffHost = (host: string | null | undefined): string =>
  (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")

function emailFromNormalizedIntake(value: unknown): string | null {
  const normalized = asRecord(value)
  if (!normalized) return null

  const contact = asRecord(normalized.contact)
  return cleanEmail(contact?.email)
    ?? cleanEmail(normalized.contactEmail)
    ?? cleanEmail(asRecord(normalized.finalDetails)?.email)
    ?? cleanEmail(normalized.email)
}

function emailFromRun(run: SiteGenerationRun | null): string | null {
  if (!run) return null

  const direct = emailFromNormalizedIntake(run.normalizedIntake)
  if (direct) return direct

  const generationInput = asRecord(run.generationInput)
  return emailFromNormalizedIntake(generationInput?.normalizedIntake)
}

function customerNameFromRun(run: SiteGenerationRun | null): string | null {
  if (!run) return null
  const normalized = asRecord(run.normalizedIntake)
  const contact = asRecord(normalized?.contact)
  return cleanText(contact?.name)
    ?? cleanText(contact?.contactName)
    ?? cleanText(contact?.fullName)
    ?? cleanText(normalized?.contactName)
    ?? cleanText(normalized?.name)
}

async function emailFromLinkedIntake(payload: Payload, run: SiteGenerationRun): Promise<string | null> {
  const intakeId = relationshipId(run.intakeSubmission)
  if (!intakeId) return null

  try {
    const intake = await payload.findByID({
      collection: "intake-submissions",
      id: intakeId as any,
      depth: 0,
      overrideAccess: true,
    } as any) as any
    return cleanEmail(intake?.contactEmail) ?? emailFromNormalizedIntake(intake?.normalized)
  } catch (error) {
    ;(payload as any).logger?.warn?.("[publish] live handoff intake lookup failed", {
      tenant: relationshipId(run.tenant),
      generationRun: run.id,
      intakeSubmission: intakeId,
      error: error instanceof Error ? error.message : "unknown",
    })
    return null
  }
}

export async function resolveLiveHandoffRecipient(
  payload: Payload,
  run: SiteGenerationRun | null,
): Promise<string | null> {
  if (!run) return null
  return emailFromRun(run) ?? (await emailFromLinkedIntake(payload, run))
}

export function buildLiveSiteUrl(snapshotDoc: SnapshotDoc): string | null {
  const explicit = cleanText(snapshotDoc.snapshot?.siteUrl) ?? cleanText(snapshotDoc.snapshot?.settings?.siteUrl)
  if (explicit) return explicit

  const domain = normalizeHandoffHost(snapshotDoc.snapshot?.domain ?? snapshotDoc.domain)
  return domain ? `https://${domain}` : null
}

export function buildTenantAdminUrl(tenant: Pick<Tenant, "domain">): string | null {
  const domain = normalizeHandoffHost(tenant.domain)
  return domain ? `https://admin.${domain}` : null
}

function authHeadersForAdminUrl(adminUrl: string): Headers {
  const url = new URL(adminUrl)
  return new Headers({
    host: url.host,
    "x-forwarded-host": url.host,
    "x-forwarded-proto": url.protocol.replace(":", "") || "https",
  })
}

async function ensureLiveHandoffCustomerUser(payload: Payload, input: {
  email: string
  name?: string | null
  tenantId: string | number
}): Promise<string | number> {
  const existing = await payload.find({
    collection: "users",
    where: { email: { equals: input.email } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  } as any) as { docs?: any[] }

  const docs = existing.docs ?? []
  if (docs.length > 1) throw new Error("Multiple CMS users match live handoff recipient.")

  const desiredTenants = [{ tenant: input.tenantId }]
  const user = docs[0]
  if (!user) {
    const created = await payload.create({
      collection: "users",
      data: {
        email: input.email,
        ...(input.name ? { name: input.name } : {}),
        role: "owner",
        tenants: desiredTenants,
        password: crypto.randomBytes(16).toString("hex"),
      },
      depth: 0,
      overrideAccess: true,
    } as any) as unknown as { id: string | number }
    return created.id
  }

  if (user.role === "super-admin") {
    throw new Error("Live handoff recipient is a super-admin user, not a tenant user.")
  }

  const existingTenant = relationshipId(user.tenants?.[0]?.tenant)
  if (!existingTenant || String(existingTenant) !== String(input.tenantId)) {
    throw new Error("Live handoff recipient already belongs to another tenant.")
  }

  if (user.role !== "owner" || (input.name && !cleanText(user.name))) {
    const updated = await payload.update({
      collection: "users",
      id: user.id,
      data: {
        role: "owner",
        tenants: desiredTenants,
        ...(input.name && !cleanText(user.name) ? { name: input.name } : {}),
      },
      depth: 0,
      overrideAccess: true,
    } as any) as unknown as { id: string | number }
    return updated.id
  }

  return user.id
}

async function assertInitialTermsAcceptance(payload: Payload, input: {
  email: string
  tenantId: string | number
}) {
  const result = await payload.find({
    collection: "agreement-acceptances" as any,
    where: {
      and: [
        { tenant: { equals: input.tenantId } },
        { actorEmail: { equals: input.email } },
      ],
    },
    sort: "-acceptedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any) as { docs?: Array<{ id?: unknown }> }
  if (!result.docs?.[0]?.id) {
    throw new Error("Initial Site in a Box terms acceptance evidence is missing.")
  }
}

async function sendLiveHandoffMagicLink(input: {
  email: string
  name?: string | null
  siteUrl: string
  adminUrl: string
  tenantId: string | number
}) {
  await (auth.api as any).signInMagicLink({
    body: {
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      callbackURL: input.adminUrl,
      errorCallbackURL: `${input.adminUrl}/login`,
      metadata: {
        intent: "site_live_handoff",
        siteUrl: input.siteUrl,
        adminUrl: input.adminUrl,
        tenantId: String(input.tenantId),
      },
    },
    headers: authHeadersForAdminUrl(input.adminUrl),
  })
}

export async function sendLiveHandoffEmailAfterActivation(
  payload: Payload,
  input: {
    tenant: Pick<Tenant, "id" | "domain">
    run: SiteGenerationRun | null
    snapshotDoc: SnapshotDoc
    rollback?: boolean
  },
): Promise<"sent" | "skipped" | "failed"> {
  if (!input.run || input.rollback || input.snapshotDoc.status !== "drafted") return "skipped"

  const recipient = await resolveLiveHandoffRecipient(payload, input.run)
  if (!recipient) {
    ;(payload as any).logger?.warn?.("[publish] live handoff email skipped", {
      reason: "missing_recipient",
      tenant: input.tenant.id,
      generationRun: input.run.id,
      snapshot: input.snapshotDoc.id,
    })
    return "skipped"
  }

  const customerName = customerNameFromRun(input.run)
  const siteUrl = buildLiveSiteUrl(input.snapshotDoc)
  const adminUrl = buildTenantAdminUrl(input.tenant)
  if (!siteUrl || !adminUrl) {
    ;(payload as any).logger?.warn?.("[publish] live handoff email skipped", {
      reason: "missing_urls",
      tenant: input.tenant.id,
      generationRun: input.run.id,
      snapshot: input.snapshotDoc.id,
    })
    return "skipped"
  }

  try {
    await assertInitialTermsAcceptance(payload, {
      email: recipient,
      tenantId: input.tenant.id,
    })
    const customerUserId = await ensureLiveHandoffCustomerUser(payload, {
      email: recipient,
      name: customerName,
      tenantId: input.tenant.id,
    })
    if ((payload as any).db?.beginTransaction) {
      try {
        await provisionDefaultTenantEmailPreferences({
          payload,
          tenantId: input.tenant.id,
          userId: customerUserId,
          email: recipient,
          role: "owner",
        })
      } catch (error) {
        ;(payload as any).logger?.warn?.("[publish] default email preference provisioning failed", {
          tenant: input.tenant.id,
          user: customerUserId,
          error: error instanceof Error ? error.message : "unknown",
        })
      }
    }
    await sendLiveHandoffMagicLink({
      email: recipient,
      name: customerName,
      siteUrl,
      adminUrl,
      tenantId: input.tenant.id,
    })
    return "sent"
  } catch (error) {
    ;(payload as any).logger?.warn?.("[publish] live handoff email failed after activation", {
      tenant: input.tenant.id,
      generationRun: input.run.id,
      snapshot: input.snapshotDoc.id,
      error: error instanceof Error ? error.message : "unknown",
    })
    return "failed"
  }
}
