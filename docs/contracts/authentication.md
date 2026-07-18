# Authentication contract

Better Auth magic links are the primary CMS login path, with optional
Google, Microsoft, and Apple provider buttons. Better Auth brokers provider
identity; Payload `users` remain the authorization source for CMS role, tenant
membership, and sessions.

Payload password login is intentionally still present as a ghosted fallback for
bootstrap, break-glass, reset-password, and API-key/service-user workflows. It
is host-gated by the proxy: `POST /api/users/login` is accepted only on the
SIAB super-admin host and returns 403 on tenant admin hosts. Do not document or
surface password login as the normal tenant-user auth path.

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

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common

APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

`BETTER_AUTH_SECRET` may fall back to `PAYLOAD_SECRET`, but a separate
high-entropy secret is preferred. `BETTER_AUTH_PREVIEW_SECRET` is optional and
scopes the separate customer-preview Better Auth instance; when omitted it falls
back to `BETTER_AUTH_SECRET` or `PAYLOAD_SECRET`. Normal tenant admin hosts are
accepted dynamically from Payload `tenants.domain`; use
`BETTER_AUTH_ALLOWED_HOSTS` only for additional CMS auth hosts that must accept
provider callbacks.
Better Auth is configured with its dynamic `baseURL` option for `admin.*`
hosts so provider redirects are built from the incoming admin host; SIAB's
Payload-backed host gate still runs before Better Auth handles the request.
In production, localhost/internal container hosts are not accepted as Better
Auth base hosts. Set `SITE_URL=https://admin.siteinabox.nl`; optionally set
`BETTER_AUTH_URL` only when the canonical auth origin must differ from
`SITE_URL`. This fallback is the platform admin origin when no request host is
available. CMS auth routes and server actions normalize `host`,
`x-forwarded-host`, and `x-forwarded-proto` before handing the request to
Better Auth, so Better Auth's native magic-link URL generation sees the public
admin origin (`admin.siteinabox.nl` or a verified `admin.<tenant-domain>`) and
does not derive links from the container bind host.
Customer preview auth is a separate Better Auth instance on
`https://preview.siteinabox.nl/api/preview-auth`. In production it accepts only
the public preview host and uses `https://preview.siteinabox.nl` as its
fallback origin. Preview auth routes and preview server actions normalize
their Better Auth headers to that public host. Localhost preview auth is
development-only.

`BETTER_AUTH_API_KEY` is optional and enables the Better Auth Infrastructure
`dash()` plugin for dashboard/audit visibility. Use the key from the existing
SIAB project in the Better Auth dashboard. `BETTER_AUTH_API_URL` and
`BETTER_AUTH_KV_URL` are optional overrides; leave them blank for Better Auth's
default hosted endpoints. SIAB does not currently enable Better Auth
Infrastructure transactional email, SMS, or Sentinel.

Email magic links also require the normal app email transport:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
EMAIL_FROM=noreply@siteinabox.nl
```

CMS magic-link signup remains closed. A CMS login link is only sent when the
submitted email matches exactly one existing eligible Payload `users` record.
Customer preview magic links are separate: they use `/api/preview-auth/*`,
isolated `preview_auth_*` tables, and the `siab-preview-auth` cookie prefix. A
link is sent only when the email has an active `preview-access-grants` row for
the requested client slug, and the session is authorized server-side against
that grant before preview data loads or mutates.

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
https://preview.siteinabox.nl/api/preview-auth/magic-link/verify
https://preview.siteinabox.nl/<clientSlug>
```

Example for Amicare:

```text
https://admin.ami-care.nl/api/auth/callback/google
https://admin.ami-care.nl/api/auth/callback/microsoft
https://admin.ami-care.nl/api/auth/callback/apple
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
7. Confirm a tenant user cannot complete login on a different tenant admin host.
8. Confirm logout clears both Payload and Better Auth sessions.
9. If `BETTER_AUTH_API_KEY` is set, confirm the Better Auth Infrastructure
   dashboard receives sign-in/audit events for successful test logins.
