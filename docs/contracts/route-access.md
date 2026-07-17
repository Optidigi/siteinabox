# Route access matrix

This matrix records the current expected route/navigation parity. It is not a
replacement for route guards; it documents the expected user-facing behavior so
future sidebar, dashboard, table, and direct-URL changes can be checked against
one place.

This file is intentionally scoped to CMS role/context access. Route ownership
is summarized in `docs/architecture.md`; application source and route tests are
canonical for the exact current surface.

## Result Meanings

- `Allowed`: route renders for the role/context.
- `Forbidden redirect`: route redirects to `/?error=forbidden`.
- `Sites redirect`: route redirects to `/sites`.
- `404`: missing or cross-tenant selected-site target resolves with `notFound()`.
- `Host-gated`: blocked by `requireAuth()` host/tenant checks before route-level logic.
- `Hidden`: no in-app navigation affordance should be visible for that role/context.

## Super-Admin Host

| Route | Super-admin | Owner / Editor / Viewer |
| --- | --- | --- |
| `/` | Allowed | Host-gated |
| `/sites` | Allowed | Host-gated |
| `/sites/new` | Redirects to `/sites` | Host-gated |
| `/sites/[slug]` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/edit` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/onboarding` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/analytics` | Allowed; unknown slug 404; mobile redirects to `/sites/[slug]` | Host-gated |
| `/sites/[slug]/pages` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/pages/new` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/pages/edit/[pageSlug]` | Allowed when page slug belongs to slug tenant; otherwise 404 | Host-gated |
| `/sites/[slug]/pages/[id]` | Allowed when page belongs to slug tenant; otherwise 404 | Host-gated |
| `/sites/[slug]/media` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/forms` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/settings` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/navigation` | Allowed; unknown slug 404 | Host-gated |
| `/sites/[slug]/users` | Allowed; unknown slug 404 | Host-gated |
| `/users` | Allowed | Host-gated |
| `/users/[id]/edit` | Allowed when collection access can read the user; otherwise 404 | Host-gated |
| `/analytics` | Allowed; mobile redirects to `/` | Host-gated |
| `/api-key` | Allowed with `ApiKeyManager` | Host-gated |
| `/profile` | Allowed | Host-gated |
| `/pages`, `/media`, `/forms`, `/settings`, `/navigation` | Sites redirect | Host-gated |

## Tenant Host

| Route | Owner | Editor | Viewer | In-App Navigation |
| --- | --- | --- | --- | --- |
| `/` | Allowed | Allowed | Allowed | Visible to all |
| `/analytics` | Allowed; mobile redirects to `/` | Allowed; mobile redirects to `/` | Allowed; mobile redirects to `/` | Desktop-only sidebar/dashboard link |
| `/pages` | Allowed | Allowed | Allowed | Visible to all |
| `/pages/new` | Allowed | Allowed | Forbidden redirect | New affordance hidden for viewer |
| `/pages/edit/[pageSlug]` | Allowed for own-tenant page; cross-tenant/missing 404 | Allowed for own-tenant page; cross-tenant/missing 404 | Allowed read-only for own-tenant page; cross-tenant/missing 404 | Row link visible to all; edit/delete/sidebar/save affordances hidden for viewer |
| `/pages/[id]` | Allowed for own-tenant page; cross-tenant/missing 404 | Allowed for own-tenant page; cross-tenant/missing 404 | Allowed read-only for own-tenant page; cross-tenant/missing 404 | Row link visible to all; edit/delete/sidebar/save affordances hidden for viewer |
| `/media` | Allowed | Allowed | Allowed read-only | Visible to all; upload/delete hidden for viewer |
| `/forms` | Allowed | Allowed | Allowed | Visible to all |
| `/settings` | Allowed | Forbidden redirect | Forbidden redirect | Visible only to owner |
| `/navigation` | Redirects to `/sites/[tenantSlug]/navigation` | Forbidden redirect | Forbidden redirect | Visible only to owner |
| `/users` | Allowed | Forbidden redirect | Forbidden redirect | Visible only to owner |
| `/users/[id]/edit` | Allowed when collection access can read the user; otherwise 404 | Forbidden redirect | Forbidden redirect | User edit affordance visible only to owner |
| `/profile` | Allowed | Allowed | Allowed | Account menu visible to all |
| `/api-key` | Shows non-super-admin explanatory placeholder | Shows non-super-admin explanatory placeholder | Shows non-super-admin explanatory placeholder | Account menu link hidden for non-super-admin |
| `/sites`, `/sites/new`, `/sites/[slug]`, `/sites/[slug]/edit`, `/sites/[slug]/onboarding`, `/sites/[slug]/analytics`, `/sites/[slug]/pages`, `/sites/[slug]/pages/new`, `/sites/[slug]/pages/edit/[pageSlug]`, `/sites/[slug]/pages/[id]`, `/sites/[slug]/media`, `/sites/[slug]/forms` | Host-gated or forbidden via super-admin route guards | Host-gated or forbidden via super-admin route guards | Host-gated or forbidden via super-admin route guards | Hidden |
| `/sites/[ownSlug]/settings`, `/sites/[ownSlug]/navigation`, `/sites/[ownSlug]/users` | Allowed through selected-tenant boundary | Forbidden redirect | Forbidden redirect | Hidden in sidebar; selected-site pill links back to `/` for tenant-host owner |
| `/sites/[otherSlug]/settings`, `/sites/[otherSlug]/navigation`, `/sites/[otherSlug]/users` | 404 via selected-tenant boundary | Forbidden redirect before tenant boundary | Forbidden redirect before tenant boundary | Hidden |

## Viewer Page Detail

Viewer page detail is a read-only renderer view. It reuses `PageForm` with
role-level `readOnly` chrome: no save, draft recovery, theme bar, sidebar block
forms, add/reorder/duplicate/delete controls, page settings, page delete, or
site-chrome mutation controls.

## Verification Coverage

- Pure host × role × tenant gate matrix:
  `tests/unit/auth-gate-matrix.test.ts`.
- Selected-site tenant boundary:
  `tests/unit/selected-tenant-route-access.test.ts`.
- Source-level route/navigation parity canaries:
  `tests/unit/route-navigation-parity-source.test.ts`.
