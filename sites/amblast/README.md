# amblast.nl

Static site for **Amblast | Facility Services**, built with Astro 6 and shipped as
an `nginx:alpine` container.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static output to dist/
pnpm preview    # serve dist/ locally
```

## Environment

Copy `.env.example` → `.env` and fill the values that apply.

| Var | Purpose |
| --- | --- |
| `SITE_URL` | Canonical absolute URL (used by sitemap and JSON-LD). |
| `PUBLIC_WEB3FORMS_KEY` | Web3Forms access key for the contact form. |
| `PUBLIC_CONTACT_EMAIL` | Optional `mailto:` fallback if Web3Forms is not configured. |

## Deploy

`Dockerfile` builds the static output and serves it via nginx. The
`.github/workflows/publish.yml` pipeline pushes
`ghcr.io/optidigi/site-amblast:latest` (and `sha-<short>`) on every push to
`main`. `nginx.conf` configures gzip, cache headers, security headers, and
301 redirects from the legacy WordPress slugs.

## Layout

```
src/
  pages/        # one .astro per route (index, over-ons, diensten, portfolio, contact, 404)
  layouts/      # BaseLayout
  components/   # layout (Header, Footer), seo (JSON-LD, meta tags)
  styles/       # global.css + amb-base.css (single bundled stylesheet)
  scripts/      # site.client.ts (vanilla JS for swiper, mobile menu, image-compare)
  content/      # site.ts (NAP + nav + meta)
public/
  uploads/
    hero/           # 6 hero photos × {jpg, avif, webp} × {native, -768 mobile}
    logo/           # AMBlast wordmark
    icons/          # contact / industry icons
    service-cards/  # service-card icon PNGs
    portfolio/      # portfolio before/after photos + over-ons portrait
  webfonts/         # Font Awesome glyphs
  .well-known/      # security.txt
```
