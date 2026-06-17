# Social Auth Runbook

OBS-101 adds passwordless CMS login through Better Auth with email magic links,
Google, Microsoft, and Apple. Better Auth brokers provider identity; Payload
`users` remain the authorization source for CMS role, tenant membership, and
sessions.

## Required Environment

Set these in each environment that should expose provider buttons:

```bash
BETTER_AUTH_SECRET=
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
high-entropy secret is preferred. Normal tenant admin hosts are accepted
dynamically from Payload `tenants.domain`; use `BETTER_AUTH_ALLOWED_HOSTS` only
for non-tenant or preview admin hosts that must accept provider callbacks.
Better Auth is configured with its dynamic `baseURL` option for `admin.*`
hosts so provider redirects are built from the incoming admin host; SIAB's
Payload-backed host gate still runs before Better Auth handles the request.

`BETTER_AUTH_API_KEY` is optional and enables the Better Auth Infrastructure
`dash()` plugin for dashboard/audit visibility. Use the key from the existing
SIAB project in the Better Auth dashboard. `BETTER_AUTH_API_URL` and
`BETTER_AUTH_KV_URL` are optional overrides; leave them blank for Better Auth's
default hosted endpoints. SIAB does not currently enable Better Auth
Infrastructure transactional email, SMS, or Sentinel.

Once the paid Better Auth Infrastructure plan is active, magic-link mail should
move from the current app mailer to Better Auth Infra's native `magic-link`
template. Treat Dutch/custom email copy as a paid-dashboard template setup item:
the product assumption is that templates can be localized/customized there, but
implementation should validate the dashboard controls before removing the
current fallback mailer.

Email magic links also require the normal app email transport:

```bash
RESEND_API_KEY=
EMAIL_FROM=noreply@siteinabox.nl
```

Magic-link signup remains closed. A link is only sent when the submitted email
matches exactly one existing eligible Payload `users` record; Better Auth user
creation on link verification is additionally guarded by the same Payload-user
resolver.

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

1. Run `pnpm payload migrate` so Better Auth tables exist.
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
