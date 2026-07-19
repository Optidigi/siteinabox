"use server"
import { getPayload, type Payload } from "payload"
import { asRecord } from "@/lib/record"
import { headers } from "next/headers"
import config from "@/payload.config"
import crypto from "node:crypto"
import { auth } from "@/lib/betterAuth"
import { buildCmsAuthHeaders } from "@/lib/socialAuth/hosts"
import { provisionDefaultTenantEmailPreferences } from "@/lib/legal/communicationPreferences"
import { signPrivilegedMagicLinkMetadata } from "@/lib/auth/privilegedMagicLinkMetadata"

// fn-batch-6 follow-up — return shape now distinguishes auth/permission
// failures (still throw — they're system-level) from validation failures
// (return { ok: false, field?, error }) so the UI can surface field-tied
// inline errors. Pre-fix every Payload validation throw bubbled past
// UserInviteForm's try/catch as a generic Error message.
export type InviteUserResult =
  | { ok: true; id: number | string; delivery: "sent" }
  | { ok: false; field?: string; error: string; code?: "validation_failed" | "delivery_failed"; id?: number | string; userCreated?: boolean }

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

function tenantAdminUrl(tenant: InviteTenant): string | null {
  const domain = tenant.domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
  return domain ? `https://admin.${domain}` : null
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
  const adminUrl = tenantAdminUrl(tenant)
  if (!adminUrl || tenant.status === "suspended" || tenant.status === "archived") {
    throw new Error("Invitation target tenant is unavailable")
  }
  return { tenant, adminUrl }
}

export async function sendInviteMagicLink(input: {
  email: string
  name: string
  role: InviteRole
  tenant: InviteTenant
  adminUrl: string
}) {
  const url = new URL(input.adminUrl)
  await (auth.api).signInMagicLink({
    body: {
      email: input.email,
      name: input.name,
      callbackURL: input.adminUrl,
      errorCallbackURL: `${input.adminUrl}/login`,
      metadata: signPrivilegedMagicLinkMetadata("user_invite", {
        recipientEmail: input.email.trim().toLowerCase(),
        tenantId: String(input.tenant.id),
        tenantName: input.tenant.name?.trim() || input.tenant.domain?.trim() || "Site in a Box",
        recipientName: input.name,
        role: input.role,
        adminUrl: input.adminUrl,
      }),
    },
    headers: buildCmsAuthHeaders(new Headers({
      host: url.host,
      "x-forwarded-host": url.host,
      "x-forwarded-proto": url.protocol.replace(":", ""),
    })),
  })
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
  if (caller.role === "owner") {
    const ownTenant = ownerTenantId(caller)
    if (ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only invite into own tenant")
    }
  }

  const { tenant, adminUrl } = await loadInviteTenant(payload, input.tenantId)

  const tempPassword = crypto.randomBytes(16).toString("hex")
  // Pass `user: caller` (NOT overrideAccess: true) so Payload's collection
  // and field-level access rules — including the role/tenants gates added in
  // audit P0 #2/#3 — apply to this create. An owner therefore cannot, for
  // example, mint a super-admin even by editing the input role server-side.
  let created: { id: number | string }
  try {
    created = await payload.create({
      collection: "users",
      user: caller,
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        tenants: [{ tenant: Number(input.tenantId) }],
        password: tempPassword
      }
    })
  } catch (err) {
    // fn-batch-6 follow-up — convert Payload validation errors to the
    // structured return shape so the UI can render field-tied inline
    // errors (e.g. duplicate email → set FormMessage on the email
    // field). Auth/permission failures bubble as before; only known-
    // safe validation paths fold into ok:false.
    const e = asRecord(err)
    const data = asRecord(e?.data)
    const errors = Array.isArray(data?.errors) ? data.errors : []
    const firstError = asRecord(errors[0])
    const nestedData = asRecord(firstError?.data)
    const nestedErrors = Array.isArray(nestedData?.errors) ? nestedData.errors : []
    const innerRecord = asRecord(errors[0]) ?? asRecord(nestedErrors[0])
    if (typeof innerRecord?.path === "string" && typeof innerRecord?.message === "string") {
      return { ok: false as const, code: "validation_failed", field: innerRecord.path, error: innerRecord.message }
    }
    if (typeof e?.message === "string") {
      return { ok: false as const, code: "validation_failed", error: e.message }
    }
    throw err
  }
  try {
    await provisionDefaultTenantEmailPreferences({
      payload,
      tenantId: input.tenantId,
      userId: created.id,
      email: input.email,
      role: input.role,
    })
  } catch (err) {
    payload.logger.warn({ err, userId: created.id }, "[invite] default email preference provisioning failed")
  }
  // Normal onboarding is passwordless: create the Payload user, then ask
  // Better Auth to send the same magic-link flow used by CMS login.
  try {
    await sendInviteMagicLink({ email: input.email, name: input.name, role: input.role, tenant, adminUrl })
  } catch (err) {
    payload.logger.warn({ err, email: input.email }, "[invite] magic-link send failed")
    return {
      ok: false as const,
      code: "delivery_failed",
      id: created.id,
      userCreated: true,
      error: "User created, but invitation delivery failed.",
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
    if (ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only resend invitations in their own tenant")
    }
  }

  const { tenant, adminUrl } = await loadInviteTenant(payload, input.tenantId)
  const invited = await payload.findByID({
    collection: "users",
    id: input.userId,
    depth: 0,
    user: caller,
  })
  const invitedTenant = ownerTenantId(invited)
  if (invited.role === "super-admin" || invitedTenant == null || String(invitedTenant) !== String(input.tenantId)) {
    throw new Error("Forbidden: invitation recipient does not belong to this tenant")
  }
  if (!["owner", "editor", "viewer"].includes(invited.role) || !invited.email) {
    return { ok: false, error: "Invitation recipient is invalid." }
  }

  try {
    await sendInviteMagicLink({
      email: invited.email,
      name: invited.name?.trim() || invited.email,
      role: invited.role,
      tenant,
      adminUrl,
    })
    return { ok: true }
  } catch (err) {
    payload.logger.warn({ err, email: invited.email }, "[invite] resend magic-link failed")
    return { ok: false, error: "Invitation delivery failed." }
  }
}
