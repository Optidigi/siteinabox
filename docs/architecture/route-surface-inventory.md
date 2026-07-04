# Route Surface Inventory

Status snapshot: 2026-07-04.

This inventory records source-defined routes and the current production route
contract. It complements the CMS role-specific
`apps/cms/docs/backlog/features/route-access-matrix.md`.

## Production Host Contract

Cloudflare DNS for `siteinabox.nl` is proxied to the VPS. `www.siteinabox.nl`
is a proxied CNAME to `siteinabox.nl`, so `www` behavior is determined by
Traefik routing, not by a separate origin.

Expected public routing:

| Host/path | Target |
| --- | --- |
| `siteinabox.nl/` | `apps/landing` |
| `siteinabox.nl/contact` | `apps/landing` |
| `siteinabox.nl/beheer` | `apps/landing` |
| `siteinabox.nl/intake` and `/intake/*` | `apps/intake` |
| `www.siteinabox.nl/` | `apps/landing` |
| `www.siteinabox.nl/contact` | `apps/landing` |
| `www.siteinabox.nl/beheer` | `apps/landing` |
| `www.siteinabox.nl/intake` and `/intake/*` | `apps/intake` |
| `admin.siteinabox.nl/*` | `apps/cms` |
| `preview.siteinabox.nl/*` | `apps/cms` preview surface |
| `ami-care.nl/*` | `apps/renderer` |

The landing router must have higher priority than the renderer catch-all. The
intake router must have higher priority than landing so `/intake` stays on the
intake app for both apex and `www`.

## Source Routes

### `apps/landing/src/pages`

| Route | Source | Status |
| --- | --- | --- |
| `/` | `index.astro` | Public marketing home. |
| `/contact` | `contact.astro` | Public contact form; posts to CMS `POST /api/contact`. |
| `/beheer` | `beheer.astro` | Public admin-login helper. |
| `/__preview` | `__preview.astro` | HMAC-gated static preview compatibility route. Kept because landing preview code and tests still reference it. |
| `/robots.txt` | `robots.txt.ts` | Public robots response. |
| `/404` | `404.astro` | Static 404 page. |

### `apps/intake/src/pages`

| Route | Source | Status |
| --- | --- | --- |
| `/intake` | `index.astro` | Public intake wizard when mounted behind the Traefik `/intake` prefix. Posts structured intake JSON to CMS `POST /api/intake`. |

### `apps/cms/src/app`

| Route group | Routes |
| --- | --- |
| Auth UI | `/login`, `/forgot-password`, `/reset-password/[token]`. |
| Tenant admin | `/`, `/analytics`, `/api-key`, `/forms`, `/media`, `/navigation`, `/pages`, `/pages/new`, `/pages/edit/[pageSlug]`, `/pages/[id]`, `/profile`, `/settings`, `/users`, `/users/[id]/edit`. |
| Super-admin site admin | `/sites`, `/sites/new`, `/sites/[slug]`, `/sites/[slug]/edit`, `/sites/[slug]/analytics`, `/sites/[slug]/forms`, `/sites/[slug]/media`, `/sites/[slug]/navigation`, `/sites/[slug]/onboarding`, `/sites/[slug]/pages`, `/sites/[slug]/pages/new`, `/sites/[slug]/pages/edit/[pageSlug]`, `/sites/[slug]/pages/[id]`, `/sites/[slug]/settings`, `/sites/[slug]/users`. |
| Generation operations | `/generation-runs`, `/generation-runs/[id]`, `/generation-runs/submissions/[id]`. |
| Customer preview | `preview.siteinabox.nl/[clientSlug]`, `/[clientSlug]/pages/[pageSlug]`, `/[clientSlug]/review`, `/[clientSlug]/checkout`, plus checkout prewarm/suggestions route handlers. |
| Legacy signed preview | `/preview/[token]`, disabled in production unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`. |
| Editor frame | `/editor-frame/pages/[id]`. |
| Renderer frames | `/renderer-frame/preview/[clientSlug]/[[...pageSlug]]`; legacy `/renderer-frame/preview-token/[token]/[[...pageSlug]]` is also production-disabled unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`. |
| Payload admin/API | `/admin`, `/api/[...slug]`, `/api/graphql`, `/api/graphql-playground`, `/api/health`, `/api/users/request-data`. |
| Platform service APIs | `/api/contact`, `/api/intake`, `/api/intake/kvk/search`, `/api/intake/kvk/profile`, `/api/payments/mollie/webhook`, `/api/preview-tokens`, `/api/publish`, `/api/renderer/snapshot`, `/api/renderer/media/[tenantId]/[...path]`, `/api/tenant-assets/[tenantId]/[...path]`, `/api/tenant-media/[tenantId]/[filename]`, `/api/tenant-theme`. |
| Auth APIs | `/api/auth/[...all]`, `/api/preview-auth/[...all]`, `/api/siab-auth/complete`. |
| Media compatibility | `/siab-media/[tenantId]/[...path]`. |

### `apps/renderer/src/pages`

| Route | Source | Status |
| --- | --- | --- |
| `/healthz` | `healthz.ts` | Container/edge healthcheck. |
| `/api/forms` | `api/forms.ts` | Renderer-owned generated-site form ingress; forwards to CMS after host snapshot resolution. |
| `/siab-media/[tenantId]/[...path]` | `siab-media/[tenantId]/[...path].ts` | Public snapshot media route guarded by active host snapshot. |
| `/_renderer/editor` | `_renderer/editor.astro` | Intentional renderer smoke/dev iframe route documented in `apps/renderer/README.md`; not the CMS editor frame. |
| `/404` | `404.astro` | Renderer 404 page. |
| `/[...path]` | `[...path].astro` | Public snapshot renderer for tenant domains. |

## Legacy Route Decisions

Kept:

- Landing `/__preview`: HMAC-gated and still has local preview code/tests.
- CMS `/preview/[token]`, `/api/preview-tokens`, and
  `/renderer-frame/preview-token/[token]/...`: legacy compatibility only,
  fail closed in production unless `ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE=1`, and
  still covered by CMS tests.
- Renderer `/_renderer/editor`: intentional smoke/dev surface, documented in
  `apps/renderer/README.md`.

Removed:

- None in this pass. No candidate had enough source support for safe removal
  without changing tested compatibility behavior.
