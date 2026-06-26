# SIAB Site Template

Astro 5 + Tailwind 4 renderer/reference package for current tenant
snapshots. This package remains for existing tenant maintenance only; it is not
the future product architecture for new self-serve sites.

New generated sites must become validated CMS tenant/site/page/theme/SEO data
served by the future generic renderer. Do not copy this package or create new
per-client source folders, workflows, or Docker images for generated sites.

## What's in the box

- **Astro 5.x**, `output: static`, with `@astrojs/sitemap` + `astro-seo`
- **Tailwind 4** via `@tailwindcss/vite` + `@tailwindcss/typography`
- **SEO baseline**: per-page `<title>`/meta/OG/Twitter, sitemap, dynamic `robots.txt`,
  `llms.txt`, `humans.txt`, `/.well-known/security.txt`, JSON-LD `Organization`
  (always) + `LocalBusiness` (if NAP supplied), favicon set, manifest
- **ContactForm** component: mailto fallback by default; renders Web3Forms
  POST form when `PUBLIC_WEB3FORMS_KEY` is set
- **Dockerfile**: multi-stage `node:lts-alpine` → `nginx:alpine`, ~30MB final image
- **nginx.conf**: gzip, asset/HTML cache strategy, security headers (CSP, X-Frame-Options, etc.)
- **Legacy/current tenant image workflow**: push to `main` →
  `ghcr.io/optidigi/siteinabox-site-<slug>:latest` + `:sha-<short>`

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output to dist/
pnpm astro check  # type / schema check
```

## Environment variables

See `.env.example`. `SITE_URL` is the only one the build needs;
`PUBLIC_WEB3FORMS_KEY` and `PUBLIC_CONTACT_EMAIL` are optional.

## Maintenance Scope

Edits to this template should support current tenant snapshots or migration
toward the data-driven architecture. Do not extend this template as the
mechanism for new generated sites.

## Rich-text rendering contract

This template ships the `rt-*` class contract per `apps/cms/docs/runbooks/rt-dom-contract.md`. Block renderers in `src/components/cms/` consume `RtRoot` shapes via `RtNodeRenderer.tsx`. Role tokens (`--font-{title,heading,text}`, `--radius-{sm,md,lg}`) declared in `global.css @theme {}` are tenant/runtime override points.

CMS-backed tenant snapshots wire these renderers to Payload-projected data. In
static-mode they remain inert until tenant data is mounted and read by the
runtime code.

Per-tenant block menu subsetting, themed-node declarations, type styles, and
color tokens live in `siteManifest.example.json` (this template ships a generic
example). Future generation should produce equivalent validated structured data
instead of copying source.

## `siteManifest.blocks[]` — the per-tenant CMS block menu

`siteManifest.blocks[]` is the source of truth for **which block types the CMS shows in the "Add block" menu for this tenant**. The CMS reads it at edit time (`BlockPresetsContext`) and enforces it at save time (`enforceTenantBlockMenu` hook in `apps/cms`).

### Behaviour

- **Field present and non-empty**: the CMS shows only the listed block types. Saves that introduce blocks outside the declared set are rejected with `Page contains block types not in this tenant's manifest`.
- **Field absent (or `blocks` not set)**: the CMS falls back to **all 7 block types visible** — backwards-compatible default for tenants that haven't declared a menu.

### Valid slugs

These are the 7 canonical block slugs registered in `apps/cms/src/blocks/`. Use these verbatim in `blocks[]` — unknown slugs are dropped with a console warning (`[resolveAllowedBlocks] manifest declares unknown block slug: <slug>; skipping`):

| Slug | Block |
|---|---|
| `hero` | Hero — headline, subheadline, image, pills, CTA |
| `featureList` | Feature list (camelCase) — grid of feature cards |
| `testimonials` | Testimonials carousel/grid |
| `faq` | FAQ — accordion |
| `cta` | Standalone CTA block |
| `richText` | Rich-text block (camelCase) — long-form body content |
| `contactSection` | Contact form section (camelCase) |

### Item shape

Each entry is an object:

```json
{ "slug": "hero", "label": "Hero", "defaultAnchor": "top" }
```

- `slug` — required; one of the 7 above
- `label` — optional; UI label override (defaults to the block's registered label)
- `defaultAnchor` — optional; pre-fills the `anchor` field when a new instance is inserted via the canvas (per OBS-58 — feature dormant until the registry-side `useCanvasBlocks(manifest)` passthrough lands)

Duplicates rejected at schema time.

### Authoring guidance

Start from `siteManifest.example.json` (this template's all-7-blocks default). Subset for tenants that only use a slice of the menu — most one-page brochure sites need only `hero` + `featureList` + `richText` + `cta`. Removing FAQ/testimonials/contactSection from `blocks[]` removes them from the admin's "Add block" menu entirely, which keeps the authoring surface focused.

### Integration touchpoints

- **`apps/cms/src/lib/richText/manifest.ts`** — Zod schema; canonical validation source.
- **`apps/cms/src/hooks/enforceTenantBlockMenu.ts`** — save-time gate.
- **`apps/cms/src/components/editor/BlockPresetsContext.tsx`** — UI-side filter for the "Add block" menu.
