"use server"
import { getPayload } from "payload"
import { headers } from "next/headers"
import config from "@/payload.config"
import crypto from "node:crypto"
import { auth } from "@/lib/betterAuth"

// fn-batch-6 follow-up — return shape now distinguishes auth/permission
// failures (still throw — they're system-level) from validation failures
// (return { ok: false, field?, error }) so the UI can surface field-tied
// inline errors. Pre-fix every Payload validation throw bubbled past
// UserInviteForm's try/catch as a generic Error message.
export type InviteUserResult =
  | { ok: true; id: number | string }
  | { ok: false; field?: string; error: string }

// Resolve a Payload user.tenants[].tenant entry (which may be either the
// populated tenant doc or the bare FK id, depending on auth depth) to its id.
function ownerTenantId(user: { tenants?: { tenant: unknown }[] | null } | null) {
  const first = user?.tenants?.[0]?.tenant
  if (first == null) return null
  return typeof first === "object" ? (first as { id: number | string }).id : first
}

export async function sendInviteMagicLink(input: { email: string; name?: string }) {
  await (auth.api as any).signInMagicLink({
    body: {
      email: input.email,
      name: input.name,
      callbackURL: "/",
      errorCallbackURL: "/login",
      metadata: {
        intent: "user_invite",
      },
    },
    headers: await headers(),
  })
}

export async function inviteUser(input: {
  email: string
  name: string
  role: "owner" | "editor" | "viewer"
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
    const ownTenant = ownerTenantId(caller as any)
    if (ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only invite into own tenant")
    }
  }

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
        tenants: [{ tenant: input.tenantId }],
        password: tempPassword
      } as any
    })
  } catch (err) {
    // fn-batch-6 follow-up — convert Payload validation errors to the
    // structured return shape so the UI can render field-tied inline
    // errors (e.g. duplicate email → set FormMessage on the email
    // field). Auth/permission failures bubble as before; only known-
    // safe validation paths fold into ok:false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any
    const inner = e?.data?.errors?.[0] ?? e?.errors?.[0]?.data?.errors?.[0] ?? e?.errors?.[0]
    if (inner?.path && inner?.message) {
      return { ok: false as const, field: String(inner.path), error: String(inner.message) }
    }
    if (e?.message) {
      return { ok: false as const, error: String(e.message) }
    }
    throw err
  }
  // Normal onboarding is passwordless: create the Payload user, then ask
  // Better Auth to send the same magic-link flow used by CMS login.
  try {
    await sendInviteMagicLink({ email: input.email, name: input.name })
  } catch (err) {
    payload.logger.warn({ err, email: input.email }, "[invite] magic-link send failed")
  }
  return { ok: true as const, id: created.id }
}
