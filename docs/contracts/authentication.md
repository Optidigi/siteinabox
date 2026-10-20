# Authentication contract

Better Auth magic links are the primary CMS login path, with optional
Google, Microsoft, and Apple provider buttons. Better Auth brokers provider
identity; Payload `users` remain the authorization source for CMS role, tenant
membership, and sessions.

Payload password login is intentionally still present as a ghosted fallback for
bootstrap, break-glass, reset-password, and API-key/service-user workflows. It
is host-gated by the proxy: `POST /api/users/login` is accepted only on
`admin.siteinabox.nl`. Retired `admin.{customer-domain}` hosts 404. Do not
document or surface password login as the normal tenant-user auth path.

## Required Environment

Set these in each environment that should expose provider buttons:

```bash
BETTER_AUTH_SECRET=
BETTER_AUTH_PREVIEW_SECRET=
BETTER_AUTH_ALLOWED_HOSTS=
BETTER_AUTH_API_KEY=
BETTER_AUTH_API_URL=
BETTER_AUTH_KV_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
SIAB_MICROSOFT_OAUTH_CALLBACK_HOSTS=

APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
SIAB_APPLE_OAUTH_CALLBACK_HOSTS=
```

`BETTER_AUTH_SECRET` may fall back to `PAYLOAD_SECRET`, but a separate
high-entropy secret is preferred. `BETTER_AUTH_PREVIEW_SECRET` is optional and
scopes the separate customer-preview Better Auth instance; when omitted it falls
back to `BETTER_AUTH_SECRET` or `PAYLOAD_SECRET`. Production CMS auth accepts
only `admin.siteinabox.nl`; use
`BETTER_AUTH_ALLOWED_HOSTS` only for additional CMS auth hosts that must accept
auth traffic. Social OAuth is stricter: each provider button and endpoint is
enabled only on an exact hostname in that provider's
`SIAB_<PROVIDER>_OAUTH_CALLBACK_HOSTS` list. Add a hostname only after the
provider application contains
`https://<host>/api/auth/callback/<provider>`; wildcards are not evidence.
Better Auth is configured with its dynamic `baseURL` option for the platform
admin host so provider redirects are built from the incoming admin host; SIAB's
Payload-backed host gate still runs before Better Auth handles the request.
In production, localhost/internal container hosts are not accepted as Better
Auth base hosts. Set `SITE_URL=https://admin.siteinabox.nl`; optionally set
`BETTER_AUTH_URL` only when the canonical auth origin must differ from
`SITE_URL`. This fallback is the platform admin origin when no request host is
available. CMS auth routes and server actions normalize `host`,
`x-forwarded-host`, and `x-forwarded-proto` before handing the request to
Better Auth, so Better Auth's native magic-link URL generation sees the public
admin origin (`admin.siteinabox.nl`) and
does not derive links from the container bind host.
Customer preview auth is a separate Better Auth instance on
`/api/preview-auth`. In production it accepts `admin.siteinabox.nl` and uses
`https://admin.siteinabox.nl` as
its fallback origin. Preview auth routes preserve the public request host so
cookies stay on that host. Localhost preview auth is development-only.

Public login on `admin.siteinabox.nl/login` is unified: register stays preview
auth; login first tries an eligible Payload CMS user (super-admin or tenant
owner/editor/viewer on `admin.siteinabox.nl`), otherwise a preview/builder
magic link. Tenant CMS users keep unprefixed CMS URLs after login.

`BETTER_AUTH_API_KEY` is optional and enables the Better Auth Infrastructure
`dash()` plugin for dashboard/audit visibility. Use the key from the existing
SIAB project in the Better Auth dashboard. `BETTER_AUTH_API_URL` and
`BETTER_AUTH_KV_URL` are optional overrides; leave them blank for Better Auth's
default hosted endpoints. SIAB does not currently enable Better Auth
Infrastructure transactional email, SMS, or Sentinel.

Email magic links also require the normal app email transport:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_EMAIL_API_TOKEN=
EMAIL_FROM=noreply@siteinabox.nl
```

Use the dedicated mail-scoped `CLOUDFLARE_EMAIL_API_TOKEN`. Never reuse
`CLOUDFLARE_API_TOKEN` (DNS/zone automation) to send mail. Optional SMTP
fallback remains `CLOUDFLARE_EMAIL_SMTP_TOKEN`.

CMS magic-link signup remains closed. A CMS login link is only sent when the
submitted email matches exactly one existing eligible Payload `users` record.
Customer preview magic links are separate: they use `/api/preview-auth/*`,
isolated `preview_auth_*` tables, and the `siab-preview-auth` cookie prefix.
Public builder access starts at `/login`. A first-time register or
login magic link may be sent without a preview grant when the callback is the
builder itself. When a `previewClientSlug` is present, the email must still
have an active `preview-access-grants` row for that slug. Normalized email is
the lead id. A CMS `tenants` row is created only after the first successful
Sitegen apply. Builder chat and facts persist in `builder-sessions` keyed by
email so another device can resume the same thread after a magic link. HMAC
preview cookies are not used. Payload CMS users are created only after paid
live handoff, not at preview register.

Local development may skip preview magic-link mail: `GET /api/builder/dev-session`
exists only when `NODE_ENV=development` and the request Host is loopback. It
sets the same `siab-preview-auth` session cookie a verified magic link would.
It is not available on production. CMS local login
uses a seeded password super-admin (`pnpm --dir apps/cms run seed:local-admin`),
not a preview session.

The session is authorized server-side against the grant before preview data
loads or mutates. Builder chat patches or regenerates a site only when the
session email has an active preview grant for that tenant. A revoked grant
does not fall back to a stored `builder-sessions` slug. Preview `/{clientSlug}`
routes redirect to `/builder`.

## Provider Redirect URLs

Register one callback URL per provider per admin host:

```text
https://<admin-host>/api/auth/callback/google
https://<admin-host>/api/auth/callback/microsoft
https://<admin-host>/api/auth/callback/apple
```

Email magic links verify through Better Auth's local route and then redirect to
the Payload bridge:

```text
https://<admin-host>/api/auth/magic-link/verify
https://<admin-host>/api/siab-auth/complete
```

Customer preview magic links verify on the preview host through the isolated
preview auth route and redirect to the
slug-scoped preview route:

```text
https://admin.siteinabox.nl/api/preview-auth/magic-link/verify
https://admin.siteinabox.nl/builder
https://admin.siteinabox.nl/builder/<clientSlug>
```

Example for the platform CMS:

```text
https://admin.siteinabox.nl/api/auth/callback/google
https://admin.siteinabox.nl/api/auth/callback/microsoft
https://admin.siteinabox.nl/api/auth/callback/apple
```

## Provider Notes

Google: create a Web application OAuth client in Google Cloud Console and copy
the client ID and client secret into `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

Microsoft: create an Entra app registration with a Web platform redirect URI.
Use `MICROSOFT_TENANT_ID=common` for broad Microsoft account support, or a
specific tenant ID to restrict sign-in to one organization.

Apple: configure Sign in with Apple using a Services ID as
`APPLE_CLIENT_ID`. `APPLE_CLIENT_SECRET` is Apple's generated client secret JWT.
If only Team ID, Key ID, Services ID, and `.p8` private key are available, use
those to generate the JWT before deployment.

## Validation Checklist

1. Run `pnpm --dir apps/cms payload migrate` so Better Auth tables exist.
2. Start the app with provider env vars present.
3. Confirm `/login` shows the email-link option and only OAuth providers with
   complete env pairs.
4. Request an email link for an existing invited Payload user and confirm it
   completes through `/api/siab-auth/complete`.
5. Sign in with an existing invited Payload user whose provider email is
   verified and matches exactly.
6. Confirm unknown, unverified, or ambiguous provider accounts fail back to
   `/login`.
7. Confirm a tenant user cannot open another tenant's selected-site routes.
8. Confirm logout clears both Payload and Better Auth sessions.
9. If `BETTER_AUTH_API_KEY` is set, confirm the Better Auth Infrastructure
   dashboard receives sign-in/audit events for successful test logins.

## Tenant invitations

Invitation creation and resend authenticate the current Payload session. Owners
may invite editor/viewer collaborators only into their single tenant;
super-admins may provision tenant owner/editor/viewer accounts. Super-admin
accounts remain tenantless and are not provisioned through the tenant invite
form. User-triggered Local API operations explicitly set `overrideAccess: false`
as well as passing the caller. The Users collection rejects original unsafe
owner-create role/membership input before field access can strip it. Reviewed
system provisioning and the one-time anonymous bootstrap-token path retain their
existing separate authority.

Only `inviteUser` and `resendUserInvitation` are public actions in the invitation
module. The privileged mail signer is private. Immediately before signing it
resolves the caller again, reads the current recipient with enforced access,
checks single-tenant membership and permitted role, and rechecks that the tenant
is available. Recipient identity/role and callback origin come from persisted
membership and the platform origin; caller-supplied callback/metadata fields are
rejected. A recipient or inviter whose authority changed fails safely.

Email is normalized before lookup and create. A duplicate or competing create
can reuse only the same permitted role and tenant membership. Conflicting
membership is not moved or overwritten. Retrying delivery reuses the existing
user ID without rotating passwords, sessions, identity anchors, names or
commercial state. Default notification preferences are provisioned only for a
newly created user. Authorized retry/resend may send another link; durable
account-link budgets are a separate policy.

Provider rejection or an unconfirmed response returns a delivery failure while
preserving the created-user ID for retry. A successful action means the mail
integration acknowledged sending; it is not proof of inbox receipt. The real
Better Auth API response must acknowledge success. Integration verification uses
mail doubles rather than live sends.

Run `pnpm --dir apps/cms test:invitation-actions` after the M02 setup and committed
migrations. This builds the real production CMS, checks its public action
manifest, starts an owned loopback server and submits anonymous forged action
requests. It requires masked production authorization failures and unchanged
user/mail records, then stops the child before owned-storage teardown. It is
actual built-action security evidence, distinct from Local API/session tests and
from real provider delivery. The full build manifest contains an encryption key
and must not be printed or uploaded; only the redacted test result is retained.

## Upgrade and cutover

The authentication dependency group is Better Auth 1.7.11 with Infrastructure
0.4.20. Existing provider buttons, Payload role/tenant authority, password
fallback/recovery, bridge checks, bootstrap restrictions and preview isolation
are retained. No provider registration, new login method or customer identity
redesign is introduced. The local builder helper supplies the new adapter's
required creation-source metadata; its endpoint remains development-loopback
only.

The SDK migration planner finds no required schema changes against committed
CMS and preview migrations, including a populated disposable account fixture.
No `issuer` column is introduced: this upgrade goes directly from 1.6 to a
post-1.7.3 release. Before an authorized rollout, repeat a read-only inventory of
both account namespaces for duplicate `(providerId, accountId)` pairs. Resolve
ambiguities through a separately reviewed mapping; never merge identities by
email or invent provider subjects. The 2026-10-20 production aggregate snapshot
had zero Better Auth accounts/Microsoft links/duplicate keys/orphaned Payload
links; it does not attest future state, Payload session absence, Amicare's
commercial entitlement or a complete production migration rehearsal.

The [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
requires existing Microsoft subjects to move from `sub` to verified `oid`.
If any such links exist at cutover, stop the dependent rollout and prepare a
scoped mapping from verified token claims or trusted Entra export. Pause Microsoft
sign-in/linking during that operation; do not silently recreate or relink rows.
Google/Microsoft account/app/calendar authorization and actual OAuth/mail tests
remain deferred owner/provider gates. Synthetic tests do not prove registration,
inbox receipt or real-provider token verification.

Magic-link verification storage now uses a typed, namespaced token record.
Atomic single consumption remains enforced. Pending links from the old package cannot be assumed
redeemable after the swap. An authorized cutover must drain the configured
five-minute link lifetime and resend through the owning authorized flow when
needed; do not copy old token values or weaken replay/expiry checks. Package
rollback likewise requires handling newly issued links, and any real provider
subject migration needs its own reverse mapping/restore decision. Existing
persisted account/session fixtures and the no-op schema plan do not replace
final-schema restore, live Amicare preservation or rollout approval.

The focused `better-auth-sdk.test.ts` exercises actual configured SDK link
issuance/consumption, replay, expiry, unsafe redirect rejection, session logout
and preview namespace behavior with in-memory persistence and mail/Payload
doubles. `better-auth-upgrade.test.ts` uses the M02-authorized real PostgreSQL
resource for committed migrations, empty/populated planner checks, account/link
preservation, session revocation and the signed local builder cookie. Existing
password/recovery/role/tenant and invitation tests remain required. See the
[verification matrix](../verification-matrix.md) for canonical commands and
[local setup](../runbooks/local-development.md#step-7-authorize-disposable-verification-then-run-tests)
for prerequisites. Hosted consuming-image evidence is distinct from local tests.
