# Authentication contract

Customer sign-in uses verified email magic links. Both Better Auth instances
reject password, social sign-in, account linking and password recovery at the
server boundary. Payload customer password login, reset, forgot-password and
native refresh also reject through collection hooks, including Local API and
GraphQL operations. A customer role is any role other than `super-admin`.

Restricted super-admin password login and recovery remain available for bootstrap
and operator recovery. The password form is reached through the explicit
`intent=operator` login entry. API-key/service authentication retains its separate
Payload strategy. Appointment calendar OAuth retains its separate authorization
flow; calendar credentials do not enable customer social sign-in.

## Hosts and cookies

CMS auth uses `admin.siteinabox.nl`. Retired `admin.{customer-domain}` hosts
return 404. `BETTER_AUTH_ALLOWED_HOSTS` configures additional explicit CMS hosts;
production accepts neither container hosts nor loopback development hosts.
Set `SITE_URL=https://admin.siteinabox.nl`; `BETTER_AUTH_URL` is an optional
canonical-origin override. Routes and server actions normalize public host and
forwarded protocol before Better Auth receives a request.

Preview auth uses `/api/preview-auth`, isolated `preview_auth_*` tables and the
`siab-preview-auth` cookie prefix. It uses the platform admin host in production
and accepts loopback only in development. CMS and preview sessions remain
separate authorities. Auth cookies are host-bound, HttpOnly and Secure outside
development. Writable routes and server actions emit Better Auth's returned
Set-Cookie headers, including renewal and deletion.

## Magic links and authorization

Public `/login` provides one email flow. Registration uses preview auth. Login
first selects exactly one eligible existing Payload CMS user; other customers
use preview auth. CMS magic-link signup stays closed. Verification proceeds
through `/api/auth/magic-link/verify` and `/api/siab-auth/complete`. Preview
verification proceeds through `/api/preview-auth/magic-link/verify` to `/builder`
or `/builder/<clientSlug>`.

Builder registration may create a verified preview identity without a preview
grant. Access to a specific preview still requires that email's active grant.
Grant revocation cannot fall back to a stored builder-session slug. Preview
identity alone cannot create a customer CMS session or membership.

Local preview development has a loopback-only `/api/builder/dev-session` route.
Local CMS bootstrap uses a seeded super-admin. Neither development entry grants
production customer authority.

Ordinary CMS and preview magic-link mail shares a durable recipient budget:
ten attempts per UTC day, a sixty-second recipient cooldown and five hundred
global attempts per UTC day. A short transaction claims both budgets under the
shared global fence, then reads a committed receipt before mail transport.
Failed or unknown transport outcomes retain their consumed attempt. Recipient
keys hash normalized email; shared IP addresses do not determine mail eligibility.
Verified signed operational invite/live notices and trusted preview site-ready
notices retain their owning operational delivery flows.

## Session renewal and revocation

Better Auth sessions have a 60-day lifetime and renew during active use. The
customer menu calls the writable `/api/siab-auth/renew` boundary; that boundary
returns renewed Better Auth cookies and a Payload JWT whose expiry follows the
current Better Auth session. It reuses the existing Payload sid. Routine renewal
requires the live verified session rather than another email login.

Each Better Auth CMS session has one durable `customer-session-bindings` row
and one Payload sid. Issuance is serialized with the shared quota global fence.
An interrupted claim, tombstone or missing old sid cannot mint a replacement.
Before returning a cookie, the issuer reads the committed binding, exact sid and
current authority. Every customer Payload JWT request rechecks the current
Better Auth session, verified email/link, account epoch and current tenant gate.

The onInit installer replaces exactly the terminal native `local-jwt` callback
with the native JWT authenticator plus this gate. It rejects unknown strategy
topologies at startup. An earlier strategy that returns null or throws is
insufficient because Payload proceeds to the native JWT fallback. Earlier
API-key strategies retain their independent behavior.

Device logout durably tombstones the exact binding. Global logout advances the
separate `customer-auth-accounts` epoch and revokes all bindings. Pre-existing
Better Auth sessions cannot issue again after that epoch, even if an SDK full
user write restores old Payload sessions. Role/membership/password changes also
advance the fence. Archived tenants fail the current request gate. Native Local
SDK logout does not expose its allSessions argument to the hook, so ambiguous
Local logout conservatively revokes globally; the explicit REST route preserves
per-device behavior. Revocation checks durable receipts rather than treating
two best-effort session deletions as proof.

## Paid handoff phase

The `/paid-handoff` capability is disabled by the runtime release gate until
PR05 and release approval. Its enabled test seam still requires the current
verified preview session and authoritative internal order, payment-attempt,
checkout-profile and tenant documents. It validates order/attempt linkage,
provider identity, paid state, currency and amount, accepted frozen email,
tenant eligibility and unique email membership under the shared global fence.
Browser returns and caller-supplied paid flags provide no authority.

A durable order-plus-preview-session claim records the chosen attempt and
membership. Active replay reuses the same Better Auth session and Payload sid;
interrupted issuance requires explicit verified recovery. Handoff does not
infer service activation or replace the activation-mail outbox. Actual payment
wiring and release enablement belong to PR05.

## Environment

Use distinct high-entropy `BETTER_AUTH_SECRET` and
`BETTER_AUTH_PREVIEW_SECRET` values; their configured fallbacks ultimately use
`PAYLOAD_SECRET`. Magic-link delivery uses the normal mail transport:
`CLOUDFLARE_ACCOUNT_ID`, dedicated mail-scoped `CLOUDFLARE_EMAIL_API_TOKEN` and
`EMAIL_FROM`. Optional SMTP fallback uses `CLOUDFLARE_EMAIL_SMTP_TOKEN`. DNS/zone
credentials are not mail credentials.

Optional `BETTER_AUTH_API_KEY` enables the existing Infrastructure dashboard
plugin. `BETTER_AUTH_API_URL` and `BETTER_AUTH_KV_URL` are endpoint overrides.
Infrastructure transactional email, SMS and Sentinel are not enabled.

## Validation status and completion

Source inspection and SDK/unit tests cover password/social denial, native JWT
fallback behavior, binding/epoch gates, cookie plumbing and frozen paid facts.
Real PostgreSQL checks have passed ten identity scenarios and six enabled
handoff scenarios, including concurrent issuance, epoch rejection and the SDK
adapter boundary between the separate auth instances. Four mail-budget PostgreSQL
regressions also pass, including concurrent recipients and swallowed-commit
denial. Browser checks remain pending; passing fixtures are not release approval.

Complete validation requires the isolated PostgreSQL suites to exercise Local,
REST and GraphQL entry points, restricted-admin recovery, repeated/concurrent
issuance, per-device/global revocation, stale SDK writes, authority changes and
enabled handoff replay/interruption. Browser checks must verify received secure
cookies, renewal beyond the original Payload expiry, cross-device logout and
customer/operator login routing. Preserve actual commands and results in the
PR evidence before changing acceptance status.
