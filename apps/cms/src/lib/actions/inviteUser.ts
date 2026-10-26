"use server"
import { hasWorkspaceAccountAccess } from "@/lib/workspace/manualAccess"
import { getPayload, type Payload } from "payload"
import { asRecord } from "@/lib/record"
import { headers } from "next/headers"
import config from "@/payload.config"
import crypto from "node:crypto"
import { z } from "zod"
import type { User } from "@/payload-types"
import { auth } from "@/lib/betterAuth"
import { buildCmsAuthHeaders } from "@/lib/socialAuth/hosts"
import { platformCmsOrigin } from "@/lib/hostToTenant"
import { provisionDefaultTenantEmailPreferences } from "@/lib/legal/communicationPreferences"
import { signPrivilegedMagicLinkMetadata } from "@/lib/auth/privilegedMagicLinkMetadata"

// fn-batch-6 follow-up — return shape now distinguishes auth/permission
// failures (still throw — they're system-level) from validation failures
// (return { ok: false, field?, error }) so the UI can surface field-tied
// inline errors. Pre-fix every Payload validation throw bubbled past
// UserInviteForm's try/catch as a generic Error message.
export type InviteUserResult =
  | { ok: true; id: number | string; delivery: "sent" }
  | { ok: false; field?: string; error: string; code?: "validation_failed" | "creation_failed" | "delivery_failed"; id?: number | string; userCreated?: boolean }

// Resolve a Payload user.tenants[].tenant entry (which may be either the
// populated tenant doc or the bare FK id, depending on auth depth) to its id.
function ownerTenantId(user: { tenants?: { tenant: unknown }[] | null } | null) {
  const first = user?.tenants?.[0]?.tenant
  if (first == null) return null
  return typeof first === "object" ? (first as { id: number | string }).id : first
}

type InviteRole = "owner" | "editor" | "viewer"

type InviteTenant = {
  id: number | string
  name?: string | null
  domain?: string | null
  status?: string | null
}

const positiveId = z.union([z.number().int().positive().refine(Number.isSafeInteger),
  z.string().regex(/^[1-9][0-9]*$/).transform(Number).refine(Number.isSafeInteger)])
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1), role: z.enum(["owner", "editor", "viewer"]), tenantId: positiveId }).strict()
const resendSchema = z.object({ userId: positiveId, tenantId: positiveId }).strict()

function matchingMembership(user: User, tenantId: number | string, role?: InviteRole) {
  return user.tenants?.length === 1 && String(ownerTenantId(user)) === String(tenantId) &&
    ["owner", "editor", "viewer"].includes(user.role) && (!role || user.role === role)
}

function tenantAdminUrl(): string {
  return platformCmsOrigin()
}

async function loadInviteTenant(payload: Payload, tenantId: number | string): Promise<{ tenant: InviteTenant; adminUrl: string }> {
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    // Tenant documents are super-admin-only through collection access. This
    // narrow system lookup runs only after the action's caller/tenant gate.
    overrideAccess: true,
  }) as InviteTenant
  const adminUrl = tenantAdminUrl()
  if (tenant.status === "suspended" || tenant.status === "archived") {
    throw new Error("Invitation target tenant is unavailable")
  }
  return { tenant, adminUrl }
}

// Private to this action module: never exported as a remotely callable action.
// Resolve caller and persisted recipient again immediately before signing.
async function sendInviteMagicLink(payload: Payload, input: {
  userId: number | string
  tenantId: number | string
  expectedEmail?: string
  expectedRole?: InviteRole
}) {
  const { user: caller } = await payload.auth({ headers: await headers() })
  if (!caller || !["owner", "super-admin"].includes(caller.role) ||
      (caller.role === "owner" && (caller.tenants?.length !== 1 || String(ownerTenantId(caller)) !== String(input.tenantId)))) {
    throw new Error("Forbidden: invitation authority changed")
  }
  if (caller.role !== "super-admin" && !await hasWorkspaceAccountAccess(payload, String(input.tenantId))) {
    throw new Error("Forbidden: manual workspace access required")
  }
  const recipient = await payload.findByID({ collection: "users", id: input.userId,
    depth: 0, user: caller, overrideAccess: false })
  if (!matchingMembership(recipient, input.tenantId, input.expectedRole) ||
      (caller.role === "owner" && recipient.role === "owner") ||
      (input.expectedEmail && recipient.email !== input.expectedEmail)) {
    throw new Error("Forbidden: invitation recipient authority changed")
  }
  const { tenant, adminUrl } = await loadInviteTenant(payload, input.tenantId)
  const email = recipient.email
  const name = recipient.name?.trim() || email
  const role = recipient.role
  const url = new URL(adminUrl)
  const result = await (auth.api).signInMagicLink({
    body: {
      email,
      name,
      callbackURL: adminUrl,
      errorCallbackURL: `${adminUrl}/login`,
      metadata: signPrivilegedMagicLinkMetadata("user_invite", {
        recipientEmail: email,
        tenantId: String(tenant.id),
        tenantName: tenant.name?.trim() || tenant.domain?.trim() || "Site in a Box",
        recipientName: name,
        role,
        adminUrl,
      }),
    },
    headers: buildCmsAuthHeaders(new Headers({
      host: url.host,
      "x-forwarded-host": url.host,
      "x-forwarded-proto": url.protocol.replace(":", ""),
    })),
  })
  if (result?.status !== true) throw new Error("Invitation delivery was not confirmed")
}

export async function inviteUser(input: {
  email: string
  name: string
  role: InviteRole
  tenantId: number | string
}): Promise<InviteUserResult> {
  const payload = await getPayload({ config })

  // Audit P0 #1: server actions are anonymous RPC primitives by default
  // (no built-in auth, action ID derivable from the bundled page). Resolve
  // the caller from the request cookies and gate explicitly.
  const { user: caller } = await payload.auth({ headers: await headers() })
  if (!caller) throw new Error("Forbidden: authentication required")
  if (caller.role !== "super-admin" && caller.role !== "owner") {
    throw new Error("Forbidden: only super-admin or owner may invite users")
  }
  if (!input || !["owner", "editor", "viewer"].includes(input.role) || (caller.role === "owner" && input.role === "owner")) {
    throw new Error("Forbidden: invitation role is not permitted")
  }
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: "validation_failed", error: "Invalid invitation details." }
  input = parsed.data
  if (caller.role === "owner") {
    const ownTenant = ownerTenantId(caller)
    if (caller.tenants?.length !== 1 || ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only invite into own tenant")
    }
  }

  if (caller.role !== "super-admin" && !await hasWorkspaceAccountAccess(payload, String(input.tenantId))) {
    throw new Error("Forbidden: manual workspace access required")
  }
  await loadInviteTenant(payload, input.tenantId)

  const findExisting = async () => (await payload.find({ collection: "users", user: caller, overrideAccess: false,
    where: { email: { equals: input.email } }, depth: 0, limit: 1 })).docs[0]
  let existing = await findExisting()
  if (existing && !matchingMembership(existing, input.tenantId, input.role)) {
    return { ok: false, code: "validation_failed", field: "email", error: "Email is unavailable for this invitation." }
  }
  const tempPassword = crypto.randomBytes(16).toString("hex")
  // Local API defaults to bypassing access. Enforce both collection and field
  // rules explicitly for this user-triggered operation.
  let created: { id: number | string }
  let newlyCreated = false
  try {
    created = existing ?? await payload.create({
      collection: "users",
      user: caller,
      overrideAccess: false,
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        tenants: [{ tenant: Number(input.tenantId) }],
        password: tempPassword
      }
    })
    newlyCreated = !existing
  } catch (err) {
    // A concurrent create may win the unique-email constraint. Reuse only the
    // same authorized membership; never update identity, credentials or role.
    if (asRecord(err)?.status === 403) throw err
    existing = await findExisting()
    if (!existing || !matchingMembership(existing, input.tenantId, input.role)) {
      if (asRecord(err)?.status === 400) {
        return { ok: false, code: "validation_failed", field: "email", error: "Invitation could not be created. Check the email and membership." }
      }
      payload.logger.warn("[invite] user creation failed")
      return { ok: false, code: "creation_failed", error: "Invitation could not be created. Please try again." }
    }
    created = existing
  }
  try {
    if (newlyCreated) await provisionDefaultTenantEmailPreferences({
      payload,
      tenantId: input.tenantId,
      userId: created.id,
      email: input.email,
      role: input.role,
    })
  } catch (err) {
    payload.logger.warn({ userId: created.id }, "[invite] default email preference provisioning failed")
  }
  // Normal onboarding is passwordless: create the Payload user, then ask
  // Better Auth to send the same magic-link flow used by CMS login.
  try {
    await sendInviteMagicLink(payload, { userId: created.id, tenantId: input.tenantId, expectedEmail: input.email, expectedRole: input.role })
  } catch (err) {
    payload.logger.warn({ userId: created.id }, "[invite] magic-link delivery not confirmed")
    return {
      ok: false as const,
      code: "delivery_failed",
      id: created.id,
      userCreated: true,
      error: "User exists, but invitation delivery could not be confirmed.",
    }
  }
  return { ok: true as const, id: created.id, delivery: "sent" }
}

export async function resendUserInvitation(input: {
  userId: number | string
  tenantId: number | string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload = await getPayload({ config })
  const { user: caller } = await payload.auth({ headers: await headers() })
  if (!caller) throw new Error("Forbidden: authentication required")
  if (caller.role !== "super-admin" && caller.role !== "owner") {
    throw new Error("Forbidden: only super-admin or owner may resend invitations")
  }
  if (caller.role === "owner") {
    const ownTenant = ownerTenantId(caller)
    if (caller.tenants?.length !== 1 || ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only resend invitations in their own tenant")
    }
  }

  const parsed = resendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid invitation details." }
  input = parsed.data
  if (caller.role !== "super-admin" && !await hasWorkspaceAccountAccess(payload, String(input.tenantId))) {
    throw new Error("Forbidden: manual workspace access required")
  }
  await loadInviteTenant(payload, input.tenantId)
  const invited = await payload.findByID({
    collection: "users",
    id: input.userId,
    depth: 0,
    user: caller,
    overrideAccess: false,
  })
  const invitedTenant = ownerTenantId(invited)
  if (invited.role === "super-admin" || invitedTenant == null || String(invitedTenant) !== String(input.tenantId)) {
    throw new Error("Forbidden: invitation recipient does not belong to this tenant")
  }
  if (!["owner", "editor", "viewer"].includes(invited.role) || !invited.email) {
    return { ok: false, error: "Invitation recipient is invalid." }
  }

  try {
    await sendInviteMagicLink(payload, { userId: invited.id, tenantId: input.tenantId,
      expectedEmail: invited.email, expectedRole: invited.role })
    return { ok: true }
  } catch (err) {
    payload.logger.warn({ userId: invited.id }, "[invite] resend magic-link delivery not confirmed")
    return { ok: false, error: "Invitation delivery failed." }
  }
}
