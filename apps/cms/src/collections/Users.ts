import { timingSafeEqual } from "crypto"
import type { ArrayFieldValidation, CollectionBeforeOperationHook, CollectionBeforeValidateHook, CollectionConfig, FieldAccess } from "payload"
import { Forbidden } from "payload"
import { canManageUsers } from "@/access/canManageUsers"
import { isSuperAdminField } from "@/access/isSuperAdmin"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"
import { changePasswordHandler } from "@/lib/auth/changePassword"
import { rateLimitForgotPasswordByTargetEmail } from "@/hooks/rateLimitForgotPassword"

// Constant-time string compare. Length-mismatch returns false immediately
// (timingSafeEqual itself throws on length mismatch); the per-byte compare
// only runs on equal-length inputs. Used by the bootstrap-token gate so
// brute-force probes can't extract the env-var token byte-by-byte.
const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// Shared check used by both the collection-level access.create gate AND the
// field-level canCreateUserField below. Keeping the two paths in lock-step
// prevents the field gate from stripping `role`/`tenants` on a caller that
// the collection gate is about to admit.
const requestHasValidBootstrapToken = (req: any): boolean => {
  const expected = process.env.BOOTSTRAP_TOKEN
  if (!expected) return false
  const provided = req?.headers?.get?.("x-bootstrap-token")
  if (!provided) return false
  return safeEqual(provided, expected)
}

// Mirror of `ownerTenantId` in src/lib/actions/inviteUser.ts:9-13. Inlined
// here (rather than imported) because that file is "use server" — every
// export must be an async function, so a sync helper can't be re-exported.
// Keep the two copies in sync; both resolve user.tenants[0].tenant (which
// may be a populated doc or a bare FK id depending on auth depth) to its id.
const ownerTenantIdOf = (user: any): unknown => {
  const first = user?.tenants?.[0]?.tenant
  if (first == null) return null
  return typeof first === "object" ? first.id : first
}

// Field-access gate for `role.access.create` AND `tenants.access.create` ONLY.
// Update access on these fields stays `isSuperAdminField` — the relaxation
// here is CREATE-only; the stolen-cookie PATCH vector (audit P0 #2/#3) must
// remain closed and is verified by the AMD-1 test's update-access guard case.
//
// Admits exactly:
//   A) super-admin (any role, any tenants shape)
//   B) anonymous + valid BOOTSTRAP_TOKEN AND data.role === "super-admin"
//      (the field gate must agree with the collection-level bootstrap gate at
//      Users.access.create — both require role=super-admin so a token leak
//      cannot mint editor/viewer/owner; re-arm guard for audit-p1 #6).
//   C) owner whose own tenant matches data.tenants[0].tenant AND
//      data.role ∈ {"editor", "viewer"}. tenants must be exactly length 1
//      (matching `validateTenants`'s non-super-admin invariant). Tenant-id
//      compare uses String(a) === String(b) for the populated-vs-FK shape.
// Everything else (editor, viewer, owner with disallowed role/tenant,
// anonymous without token, anonymous with token but wrong role) → false.
//
// AMD-1 (T2 secondary): closes the functional regression introduced by P0
// commit cb00e47 (which wired isSuperAdminField on role/tenants create) while
// preserving every closed P0/P1 vector.
const canCreateUserField: FieldAccess = ({ req, data }) => {
  // A) super-admin shortcut
  if (req.user?.role === "super-admin") return true

  // B) anonymous bootstrap path — anonymous-only, role-restricted to
  // super-admin to match the collection-level gate. Authed callers with a
  // token cookie must NOT be relaxed (their session already routes them
  // through the normal UI path; relaxing them would re-open P0 #2/#3 for
  // any operator who left BOOTSTRAP_TOKEN set in production).
  if (req.user == null) {
    if (!requestHasValidBootstrapToken(req)) return false
    return data?.role === "super-admin"
  }

  // C) owner-invite path. Tightly bound: role must be editor or viewer,
  // tenants[] must contain exactly one entry that matches the caller's
  // own tenant. Owner cannot mint another owner (no role-promotion within
  // tenant) or a super-admin (re-arm guard for P0 #2/#3); cannot invite
  // into a tenant they don't own (T1 cross-tenant guard).
  if (req.user.role === "owner") {
    if (data?.role !== "editor" && data?.role !== "viewer") return false
    const own = ownerTenantIdOf(req.user)
    if (own == null) return false
    const tenants = (data as any)?.tenants
    if (!Array.isArray(tenants) || tenants.length !== 1) return false
    const target = tenants[0]?.tenant
    if (target == null) return false
    return String(target) === String(own)
  }

  // D) editor / viewer / any other authed role → never permitted on create.
  return false
}

// Audit AMENDMENT AMD-3 (T2 secondary) — honest rejection on non-super-admin
// apiKey writes. Pairs with the AMD-2 field-level access (kept untouched as
// defense-in-depth) and the UI gating in src/app/(frontend)/(admin)/api-key/
// page.tsx.
//
// Why beforeOperation: AMD-2's field-level access strips apiKey/enableAPIKey/
// apiKeyIndex from `data` during the field-level beforeValidate cascade. By
// the time `beforeChange` (collection) and `beforeValidate` (collection)
// hooks run, those fields have already been deleted — see the documented
// hook order at node_modules/payload/dist/collections/operations/utilities/
// update.js:13-24 (beforeValidate-Fields → beforeValidate-Collection →
// beforeChange-Collection → beforeChange-Fields). The earliest collection-
// level hook is `beforeOperation`, dispatched at updateByID.js:25-30 via
// buildBeforeOperation.js:6-22 BEFORE any field hook fires; that's the only
// hook that still sees the caller's original `data.apiKey` intent and can
// distinguish a write attempt from a no-op.
//
// Both `update` and `updateByID` operations map to hookOperation `'update'`
// (collections/operations/utilities/types.js:operationToHookOperation), so
// gating on `operation === "update"` covers both. The hook intentionally does
// NOT fire on `'create'` — sub-vector A is closed by AMD-2's field-level
// access (the strip is the right outcome on create; we just want honest
// rejection on update where a UI was previously expecting silent strip to
// succeed).
//
// Sending `apiKey: null` or `enableAPIKey: false` is still a write attempt —
// use `in` checks rather than truthiness, so any non-super-admin caller who
// names one of the three keys gets a 403 regardless of value.
const apiKeyFieldNames = ["apiKey", "enableAPIKey", "apiKeyIndex"] as const
const rejectNonSuperAdminApiKeyWrites: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== "update") return args
  if (req.user?.role === "super-admin") return args
  const data = args?.data
  if (!data || typeof data !== "object") return args
  for (const key of apiKeyFieldNames) {
    if (key in data) throw new Forbidden(req.t)
  }
  return args
}

// Audit-p1 #5 sub-fix 1 layer-2 (T4) — bogus-auth rejection on the public
// forgot-password endpoint. The middleware rate-limit at src/proxy.ts
// bypasses on syntactic auth-signal presence for API-key clients. An attacker
// presenting a bogus
// header would otherwise bypass middleware AND reach the unauthenticated
// forgot-password handler, triggering email floods on attacker-supplied
// addresses. This hook detects: forgotPassword + req.user==null + auth
// signal present → bypass attempt → 403. See src/access/authSignals.ts
// for the polarity-invariant note.
const rejectBogusAuthForgotPassword: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== "forgotPassword") return args
  if (req.user) return args
  if (hasUnvalidatedAuthSignal(req)) throw new Forbidden(req.t)
  return args
}

// Audit-p1 #7 sub-fix A (T5) — lock the naive credential PATCH paths.
//
// Prior state: any authed user could PATCH /api/users/<self> with EITHER
// {password:"X"} OR {email:"attacker@evil"} and the server accepted the
// change. With a stolen session cookie:
//   • password vector — directly rotates the victim's password and the
//     attacker logs in subsequently (audit's primary repro).
//   • email vector — rewrites the email to attacker-controlled, then
//     anonymous /api/users/forgot-password mails the reset link to the
//     attacker, who completes the reset (audit's "Same gate for email
//     change" requirement; sibling-vector identified in adversarial
//     review of fix batch 7 Pass 1).
//
// canManageUsers gates self-only for non-owner roles but does not gate
// the credential fields specifically. Payload's auto-injected `email`
// field (`node_modules/payload/dist/auth/baseFields/email.js:2-23`) ships
// with NO `access` property — the same default-allow shape that produced
// the original P0 #2/#3 (role/tenants) and AMD-2 (apiKey) findings.
//
// Mechanism: throw Forbidden when ALL of the following are true:
//   - operation === "update" (covers `update` and `updateByID`; both map
//     to hookOperation 'update' per `node_modules/payload/dist/collections/
//     operations/utilities/types.js:operationToHookOperation`)
//   - req.user?.role !== "super-admin" (super-admin retains the admin-reset
//     path used for "lost password without email access" recovery and the
//     parallel admin-fix-typoed-email recovery)
//   - context?.allowSelfPasswordChange !== true (the change-password
//     endpoint sets this flag AFTER verifying currentPassword; that's the
//     only sanctioned bypass — see src/lib/auth/changePassword.ts. The
//     endpoint only writes `data.password`, so the flag is currently
//     password-specific by usage even though the hook's scope covers email
//     too. If a future endpoint mints verified email rotations, it can
//     reuse the same flag with the same context-merge invariant.)
//   - either 'password' OR 'email' is a key in args.data (regardless of
//     value — sending the key at all is the user's intent to write;
//     matches the AMD-3 'in'-check pattern, including empty-string, null,
//     and any other type-confusion attempts).
//
// Sits at index 2 in `Users.hooks.beforeOperation` AFTER the existing two
// (rejectNonSuperAdminApiKeyWrites, rejectBogusAuthForgotPassword). All
// three short-circuit on operations they don't care about, so order does
// not affect correctness — APPENDING preserves the AMD-3 / P1 #5 contracts
// and lets future audits add new hooks without re-arming any closed vector.
//
// The `context` parameter passed to the hook by `buildBeforeOperation` is
// `args.req.context` (per buildBeforeOperation.js:14), so when the change-
// password endpoint calls `payload.update({context:{allowSelfPasswordChange:
// true}})`, that flag lands in req.context via createLocalReq.js:7-19.
//
// CREATE-side coverage: this hook short-circuits on operation !== "update",
// so it does NOT fire on create. Email/password on create are governed by
// `canCreateUserField` (AMD-1) — the only admit paths are super-admin,
// owner-invite (only for editor/viewer-into-own-tenant; AMD-1 does not
// validate that the inviter knows the email's mailbox, so an inviter who
// types a typo'd email mints an account at the wrong address — but that's
// a feature concern, not a takeover concern, since the new account is
// brand-new with no prior credentials to hijack), and bootstrap. None
// of those reach the credential-write hook.
const credentialFieldNames = ["password", "email"] as const
const rejectNonSuperAdminCredentialWrites: CollectionBeforeOperationHook = ({ args, context, operation, req }) => {
  if (operation !== "update") return args
  if (req.user?.role === "super-admin") return args
  if ((context as { allowSelfPasswordChange?: boolean })?.allowSelfPasswordChange === true) return args
  const data = args?.data
  if (!data || typeof data !== "object") return args
  for (const key of credentialFieldNames) {
    if (key in data) throw new Forbidden(req.t)
  }
  return args
}

// Audit-p1 #7 sub-fix B (T5) — invalidate all sessions on password change.
//
// Pairs with `useSessions: true` on Users.auth (below). Payload's session-
// based JWT verification at `node_modules/payload/dist/auth/strategies/
// jwt.js:73-81` rejects any JWT whose `sid` claim is not in the user's
// `sessions[]` array (or whose claim is missing entirely). Setting
// `data.sessions = []` during a password-rotation pipeline therefore
// invalidates every pre-rotation token for that user.
//
// Two password-rotation signatures fire this hook:
//
//   1. Regular update path (`payload.update({data:{password:"X"}})`):
//      the plaintext password rides through `data` until Payload's pre-
//      change pipeline hashes it into salt/hash. At beforeValidate time,
//      `data.password` is the plaintext attribute — present iff this is
//      a password-rotation update.
//      Caller surface: super-admin admin-reset PATCH /api/users/:id with
//      {password:"X"}, AND the new change-password endpoint's internal
//      payload.update call.
//
//   2. resetPassword operation
//      (`node_modules/payload/dist/auth/operations/resetPassword.js:55-79`):
//      the operation manually assigns `user.salt = newSalt; user.hash =
//      newHash` and then invokes beforeValidate hooks with `data: user`
//      (the same object, which is the FULL stored user row). Plaintext
//      is not in `data` — but a NEW `hash` value is.
//
//      IMPORTANT — why we compare against originalDoc.hash, not just check
//      typeof d.hash === "string":
//      Payload passes the FULL MERGED document to a beforeValidate hook on
//      update — not just the delta. An auth-enabled collection's user row
//      always has `hash` and `salt` columns, so `typeof d.hash === "string"`
//      is TRUE for every update to any user, not just password resets. The
//      old dual-signal guard (hash+salt both present) had the same flaw.
//      The authoritative discriminator is whether the hash VALUE has changed:
//      a non-credential update carries the existing stored hash → no change;
//      the resetPassword path writes a freshly derived hash → different value.
//      We detect this via `d.hash !== originalDoc?.hash`.
//
//      resetPassword passes `data: user` BY REFERENCE and ignores the
//      hook's return value — so the in-place mutation is what propagates
//      to the subsequent `db.updateOne({data: user})` call. We mutate AND
//      return so both pipelines see sessions=[].
//
//      Fail-secure: if `originalDoc` is absent (shouldn't happen on update,
//      but be defensive), `d.hash !== undefined` evaluates true → sessions
//      cleared. That is the safe direction.
//
// Out of scope: this hook does NOT fire on operation === "create" — a
// brand-new user has no prior sessions to invalidate (the sessions[]
// will be empty by default).
//
// Out of scope: this hook does NOT fire on `data.password` for the
// `login` operation. Login passes credentials but does not include
// `password` in the data being persisted; only resetPassword and update
// pass through beforeValidate with password material.
const clearSessionsOnPasswordChange: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (operation !== "update") return data
  if (!data || typeof data !== "object") return data
  const d = data as Record<string, unknown>
  const passwordRotation = typeof d.password === "string"
  const resetPasswordRotation =
    typeof d.hash === "string" && d.hash !== (originalDoc as Record<string, unknown> | undefined)?.hash
  if (!passwordRotation && !resetPasswordRotation) return data
  // Mutate in place (covers resetPassword's pass-by-reference path) AND
  // return (covers the regular update pipeline that uses the return value).
  ;(d as Record<string, unknown>).sessions = []
  return data
}

// Domain invariant: super-admins have no tenants; all other roles have
// exactly one. Multiple users may share the same tenant (clients can add
// team members), but a single user is always scoped to one tenant.
const validateTenants: ArrayFieldValidation = (value, { siblingData }: any) => {
  const role = siblingData?.role
  const len = Array.isArray(value) ? value.length : 0
  if (role === "super-admin") {
    if (len !== 0) return "super-admin users must not have tenants"
    return true
  }
  if (len !== 1) return "exactly one tenant is required for non-super-admin users"
  return true
}

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    useAPIKey: true,
    // Audit-p1 #7 sub-fix B (T5) — Payload's built-in session-based JWT
    // invalidation. With this flag set, login signs JWTs with a per-session
    // `sid` claim AND adds an entry to user.sessions[]; verification at
    // `node_modules/payload/dist/auth/strategies/jwt.js:73-81` rejects any
    // JWT whose sid is not in the array. Pairs with the
    // `clearSessionsOnPasswordChange` beforeValidate hook above (which
    // empties sessions[] on every password rotation) so a stolen pre-
    // rotation cookie cannot survive a password change.
    //
    // Note on Payload defaults: `auth.useSessions` defaults to `true` per
    // `node_modules/payload/dist/collections/config/defaults.js:128, 142`,
    // so this flag is documentation-as-code rather than a behaviour change.
    // The pre-fix codebase was implicitly using sessions; what was missing
    // was the `clearSessionsOnPasswordChange` hook to actually rotate them
    // on credential change. Stating the flag explicitly here makes the
    // session-rotation contract auditable from this file alone — a future
    // change that sets `useSessions: false` would visibly break sub-fix B.
    //
    // Migration: NO new migration required — the `users_sessions` table
    // is already provisioned by the initial schema migration
    // (`src/migrations/20260505_172626_initial_schema.ts:22-28, 290, 327-328`).
    // The table existed in earlier snapshots and was kept across previous
    // schema changes; the schema and runtime config have always been in
    // alignment. Verified by `grep users_sessions src/migrations/*.json`.
    useSessions: true,
    forgotPassword: {
      generateEmailHTML: async (args) => {
        const token = (args as any)?.token as string | undefined
        const user = (args as any)?.user as any
        const req = (args as any)?.req

        let host = `admin.${process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN || "siteinabox.nl"}`
        const firstTenant = user?.tenants?.[0]?.tenant
        if (user && user.role !== "super-admin" && firstTenant) {
          const tenantId = typeof firstTenant === "object" && firstTenant ? firstTenant.id : firstTenant
          try {
            const tenant = await req.payload.findByID({
              collection: "tenants",
              id: tenantId,
              overrideAccess: true
            })
            if (tenant?.domain) host = `admin.${tenant.domain}`
          } catch {
            // Fall back to super-admin host if the tenant can't be resolved
          }
        }

        const proto = process.env.NODE_ENV === "production" ? "https" : "http"
        const port = process.env.NODE_ENV === "production" ? "" : `:${process.env.PORT || 3001}`
        const resetUrl = `${proto}://${host}${port}/reset-password/${token ?? ""}`
        return resetPasswordTemplate({ resetUrl }).html
      },
      generateEmailSubject: () => "Reset your siab-payload password"
    }
  },
  hooks: {
    // beforeOperation runs at the earliest collection-level point, BEFORE
    // any field-level access strip. Three hooks compose; all short-circuit
    // on operations they don't care about, so order does not affect
    // correctness — APPENDING preserves prior contracts:
    //   [0] AMD-3 — honest 403 (instead of AMD-2's silent strip) when a
    //       non-super-admin names apiKey / enableAPIKey / apiKeyIndex on
    //       update.
    //   [1] audit-p1 #5 layer-2 — 403 on forgot-password when the caller
    //       presented auth signals but the strategies didn't validate
    //       to a user (closes the middleware rate-limit bypass discovered
    //       in adversarial review of fix batch 6 Pass 1).
    //   [2] audit-p1 #7 sub-fix A — 403 when a non-super-admin update
    //       names `password` OR `email` and the change-password endpoint's
    //       bypass flag is absent (forces self-rotations through the
    //       verified endpoint; preserves the admin-reset path for super-
    //       admin; closes the sibling email-pivot vector identified in
    //       adversarial review).
    beforeOperation: [
      rejectNonSuperAdminApiKeyWrites,
      rejectBogusAuthForgotPassword,
      rejectNonSuperAdminCredentialWrites,
      rateLimitForgotPasswordByTargetEmail,
    ],
    // beforeValidate (collection) fires on update for both the regular
    // update pipeline AND the resetPassword path
    // (`node_modules/payload/dist/auth/operations/resetPassword.js:70-79`
    // explicitly invokes collection beforeValidate hooks before its
    // db.updateOne). The hook empties sessions[] when it sees a password-
    // rotation signature, invalidating every pre-rotation JWT for the user
    // (audit-p1 #7 sub-fix B).
    beforeValidate: [clearSessionsOnPasswordChange],
    // FN-2026-0049 — `sessions` is auto-injected by Payload when
    // `useSessions: true`. Field-level overrides via the standard `fields`
    // declaration don't reliably attach (the auto-inject happens AFTER
    // mergeBaseFields runs; the field-override pattern that works for
    // apiKey/apiKeyIndex doesn't catch sessions here). Cleanest reliable
    // fix: an afterRead hook that strips `sessions` from any external
    // response. Internal session validation runs against the DB row
    // directly (Payload's jwt strategy reads `user.sessions` from a
    // findByID(overrideAccess:true) result, not via the REST/GraphQL
    // surface), so stripping from the public response shape doesn't
    // break login or session rotation.
    afterRead: [
      ({ doc, req }) => {
        // `req.payloadAPI` is "REST" / "GraphQL" / "local" — Payload sets
        // this on every request handled by its operation pipeline. Local-
        // API callers (the JWT strategy's session lookup, our own
        // server-component queries, etc.) get "local" and must keep the
        // sessions array intact for sid verification. External REST/
        // GraphQL callers get the array stripped from the response shape.
        const api = (req as { payloadAPI?: string } | undefined)?.payloadAPI
        if (api === "local") return doc
        if (doc && typeof doc === "object" && "sessions" in doc) {
          delete (doc as Record<string, unknown>).sessions
        }
        return doc
      }
    ]
  },
  endpoints: [
    // Audit-p1 #7 sub-fix A (T5) — verified self-service password change.
    // Mounts at POST /api/users/change-password (Payload prefixes
    // collection endpoints with /api/<slug>; see
    // `node_modules/payload/dist/collections/endpoints/index.js`).
    //
    // Authoritative path of trust:
    //   1. Caller authenticated (req.user populated by Payload's auth
    //      strategies before the handler runs).
    //   2. CurrentPassword verified server-side via payload.login.
    //   3. Password update with overrideAccess + a `context` flag the
    //      lock-down hook recognizes — neither the field-level access
    //      nor the hook can block this verified path.
    //   4. Sessions cleared by the beforeValidate hook (sub-fix B).
    //   5. Fresh login session issued; new cookie set on response.
    {
      path: "/change-password",
      method: "post",
      handler: changePasswordHandler
    }
  ],
  access: {
    // create: super-admin / owner can create. Bootstrap exception (audit-p1
    // finding #6, T2): the previous count-only gate silently re-opened
    // unauthenticated POST /api/users whenever the users table was empty
    // (DB restore from blank, accidental purge, fresh re-deploy missing
    // seed). The hardened gate now requires ALL of:
    //   1. `BOOTSTRAP_TOKEN` env var set on the server
    //   2. `x-bootstrap-token` request header matches it (timing-safe compare)
    //   3. incoming `data.role === "super-admin"` (no other role may bootstrap)
    //   4. users table is still empty
    // Operator workflow: deploy with BOOTSTRAP_TOKEN set, run the seed curl
    // ONCE, then unset BOOTSTRAP_TOKEN and redeploy. Documented in
    // .env.example and docs/runbooks/deploy.md.
    create: async ({ req, data }) => {
      if (req.user?.role === "super-admin") return true

      // OBS-9 belt-and-braces tenant-scoping check for owner-create-user.
      // canCreateUserField (field-level) already validates the (role, tenants)
      // shape for owner creates: it requires `tenants` to be a length-1 array
      // matching the owner's own tenant id. But that chain is a single point
      // of failure — if a future refactor weakens `canCreateUserField` (or
      // strips it from any field), the only remaining defense is
      // `validateTenants` catching an empty tenants array AFTER the field-
      // level strip. This collection-level gate independently rejects when
      // any provided tenant doesn't match the owner's, mirroring OBS-67's
      // canWrite tenant-membership pattern.
      //
      // We defer to validateTenants when `tenants` is missing/empty — that's
      // the canonical "tenant is required" error class and not the
      // cross-tenant-injection concern OBS-9 covers.
      if (req.user?.role === "owner") {
        const tenants = (data as { tenants?: Array<{ tenant?: unknown }> } | null | undefined)?.tenants
        if (!Array.isArray(tenants) || tenants.length === 0) return true
        const own = ownerTenantIdOf(req.user)
        if (own == null) return false
        for (const row of tenants) {
          const raw = row?.tenant
          if (raw == null) return false
          const id = typeof raw === "object" ? (raw as { id?: unknown }).id : raw
          if (String(id) !== String(own)) return false
        }
        return true
      }

      // Bootstrap path (anonymous; audit-p1 #6) — unchanged.
      if (!requestHasValidBootstrapToken(req)) return false
      if (data?.role !== "super-admin") return false
      const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true })
      return totalDocs === 0
    },
    read: canManageUsers,
    update: canManageUsers,
    delete: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner"
  },
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role"] },
  fields: [
    { name: "name", type: "text" },
    { name: "role", type: "select", required: true, defaultValue: "editor",
      // Field-level access. Update is super-admin-only — closes Findings
      // #2/#3 (PATCH /api/users/<self> with role:"super-admin"). Create
      // is gated by `canCreateUserField`, which admits: super-admin (any),
      // anonymous + bootstrap-token + role=super-admin (audit-p1 #6 seed),
      // and owner inviting editor/viewer into own tenant (AMD-1 owner
      // invite path). Editor / viewer / owner attempting any other shape
      // are blocked, closing the P0 #2/#3 family on POST as well.
      access: { create: canCreateUserField, update: isSuperAdminField },
      options: [
        { label: "Super-admin", value: "super-admin" },
        { label: "Owner", value: "owner" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" }
      ] },
    // Plugin-native many-to-many shape. We declare it manually (rather than
    // relying on the plugin's `includeDefaultField: true` injection) so we
    // can attach a custom validate enforcing the per-role tenant invariant.
    // The plugin's access wrappers and base filter look up users by
    // `tenants.tenant`, so the field name + row shape must match the plugin
    // defaults exactly.
    {
      name: "tenants",
      type: "array",
      validate: validateTenants,
      saveToJWT: true,
      // Field-level access paired with `role`: setting `tenants:[]` while
      // flipping `role:"super-admin"` is the precise self-promotion shape
      // `validateTenants` accepts. Update remains super-admin-only; create
      // uses `canCreateUserField` which mirrors the role gate so neither
      // half of the payload can be assembled in isolation.
      access: { create: canCreateUserField, update: isSuperAdminField },
      admin: { description: "empty for super-admin; exactly one entry otherwise" },
      fields: [
        {
          name: "tenant",
          type: "relationship",
          relationTo: "tenants",
          required: true,
          index: true,
          saveToJWT: true
        }
      ]
    },
    // Audit AMENDMENT AMD-2 (T2 primary, T5 secondary) — Payload's
    // auto-injected `apiKey` / `enableAPIKey` / `apiKeyIndex` fields ship
    // with NO `access` property (see node_modules/payload/dist/auth/baseFields/apiKey.js).
    // Per Payload's default-allow-when-unspecified, any caller who passes
    // the collection-level access can mass-assign these fields, producing:
    //   A) owner mints attacker-known apiKey on a new editor (bypass invite-flow)
    //   B) editor/viewer self-set apiKey for persistence past password rotation
    //   C) owner sets apiKey on any tenant member → audit-trail forgery
    //      (owner can authenticate as victim; updatedBy reflects victim id)
    //
    // Mechanism: field-override via name-match. Payload's mergeBaseFields
    // (node_modules/payload/dist/fields/mergeBaseFields.js:7-31) finds the
    // base field by `name`, splices it from the merged list, and pushes
    // deepMergeWithReactComponents(baseField, matchCopy). Default deepmerge
    // semantics (utilities/deepMerge.js:37-41) have matchCopy (this collection's
    // explicit field) winning on conflicts while preserving baseField's
    // unique properties — so declaring only {name, type, access} here yields
    // a merged field that retains the baseField's encrypt/decrypt hooks,
    // admin Field:false, label, and (for apiKeyIndex) the HMAC beforeValidate
    // hook, while picking up our isSuperAdminField gate.
    //
    // Defense-in-depth: locking apiKey alone is transitively sufficient
    // (the apiKeyIndex hook only runs HMAC when data.apiKey is present,
    // which it won't be after the field-strip cascade). We lock all three
    // anyway so a future Payload revision that wires the hook differently
    // can't silently re-arm this vector.
    //
    // Self-rotation note: this locks editor/viewer/owner from rotating
    // their own apiKey via PATCH /api/users/<self>. AMD-3 stacks an honest
    // 403 on top via the `beforeOperation` hook above (so the PATCH no
    // longer returns 200-with-silent-strip), and the `/api-key` page now
    // gates non-super-admin renders to a placeholder.
    //
    // Two-layer coverage map (Payload v3.84.1):
    //   - `overrideAccess: false` (external API calls): BOTH the hook and
    //     this field-level access run. Hook throws early; strip would also
    //     fire if the hook were ever removed.
    //   - `overrideAccess: true` (internal Local-API / trusted-boundary
    //     writes): the field-level strip is skipped per
    //     `node_modules/payload/dist/fields/hooks/beforeValidate/promise.js:217`
    //     (`result = overrideAccess ? true : ...`), but the hook still
    //     fires unconditionally — `buildBeforeOperation.js:6-22` does not
    //     check overrideAccess. So the hook is the broader-coverage layer;
    //     this field-level access is the narrower fallback that survives
    //     if the hook is ever removed without also removing this gate.
    //
    // Do not relax this for self-rotation pressure; that re-arms AMD-2
    // sub-vector B (persistent backdoor across credential rotation).
    { name: "enableAPIKey", type: "checkbox", access: { create: isSuperAdminField, update: isSuperAdminField } },
    // FN-2026-0029 (BLOCKER) — `apiKey` and `apiKeyIndex` had no field-level
    // `read` access, so the auto-injected base field's encrypt/decrypt hooks
    // ran on every external read and the plaintext UUID was returned in
    // /api/users/me, /api/users/:id, and /api/users responses. Any session
    // cookie could re-read the key indefinitely from any browser DevTools
    // network tab — making the ApiKeyManager's "write-once" / "won't be
    // shown again" copy false.
    //
    // Fix: `read: () => false` on both fields. External callers (REST,
    // GraphQL) get the field stripped. Internal Local-API calls with
    // `overrideAccess: true` (Payload's authentication strategy itself,
    // when matching incoming Authorization: users API-Key headers against
    // apiKeyIndex) bypass field-level access and continue to work.
    { name: "apiKey",       type: "text",     access: { create: isSuperAdminField, update: isSuperAdminField, read: () => false } },
    { name: "apiKeyIndex",  type: "text",     access: { create: isSuperAdminField, update: isSuperAdminField, read: () => false } },
    {
      name: "editorMode",
      type: "select",
      required: false,
      options: [
        { label: "Canvas (continuous-document)", value: "canvas" },
        { label: "Sidebar (Shopify-style)", value: "sidebar" },
      ],
      admin: {
        description: "Preferred page editor mode. Falls back to manifest.defaultMode → \"canvas\".",
      },
    },
    {
      name: "language",
      type: "select",
      required: false,
      defaultValue: "en",
      options: [
        { label: "English", value: "en" },
        { label: "Nederlands", value: "nl" },
      ],
      admin: {
        description: "Preferred admin UI language.",
      },
    },
  ]
}
