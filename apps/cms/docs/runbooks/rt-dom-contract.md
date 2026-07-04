# Rich text DOM emission contract

This file specifies the DOM shape both the CMS editor (Lexical) and the downstream Astro renderer must emit for each RtNode type. Class names are stable; tenant stylesheets target them.

| RtNode | Emitted DOM |
|---|---|
| paragraph              | `<p class="rt-p">` |
| heading (level 2/3/4)  | `<hN class="rt-h rt-h-N">` |
| list (ordered=false)   | `<ul class="rt-ul">` |
| list (ordered=true)    | `<ol class="rt-ol">` |
| listItem               | `<li class="rt-li">` |
| blockquote             | `<blockquote class="rt-quote">` |
| divider                | `<hr class="rt-hr">` |
| link                   | `<a class="rt-link" href rel target>` |
| text with bold mark    | wrap in `<strong class="rt-b">` |
| text with italic mark  | `<em class="rt-i">` |
| text with underline    | `<u class="rt-u">` |
| text with code         | `<code class="rt-code">` |
| text with strikethrough| `<s class="rt-s">` |
| text with style=X      | wrap in `<span class="rt-type-X">` |
| text with color=Y      | wrap in `<span class="rt-color-Y">` |
| text with font=Z       | wrap in `<span class="rt-font-Z">` |
| themed (id=Z)          | `<div class="rt-themed rt-themed-Z" data-rt-id="Z">…</div>` |

Each tenant's site CSS styles these class names. The CMS does not own the visual presentation — only the class contract.

A fixture corpus of RtNode trees lives at `docs/runbooks/rt-fixtures.json`. The
shared renderer's CI should run its renderer against each fixture and assert the
emitted DOM matches this contract.

## Canvas block DOM contract

Canvas block renderers emit a `<section class="cms-block cms-block--<slug> ...">`
whose inner DOM mirrors the rendered-site components in `packages/site-renderer`.
Tenant CSS and source-backed variant classes target these class names. When a
rendered-site component's DOM changes, its editable canvas path must be updated
in lockstep.

Canonical reference implementations:

- Public/preview renderer: `packages/site-renderer/src/blocks/*`.
- Source-backed class maps: `packages/site-renderer/src/blocks/native-classes.ts`.
- Editable CMS dispatch: `src/components/editor/canvas/CanvasBlockRenderer.tsx`.
- Editable source-backed canvas blocks: `src/components/editor/canvas/blocks/GenerationBlocks.tsx`.
- Renderer-native editable wrappers: `src/components/editor/canvas/RendererCanvasBlockRenderer.tsx`.
- Official Ami-care tenant edit slots: `src/components/editor/canvas/AmicareCanvasBlockRenderer.tsx`.

Active generated page-block slugs are hero, featureList, richText, cta,
contactSection, faq, testimonials, pricing, stats, logoCloud, gallery, team,
and blogCards. Each block must preserve:

- `cms-block cms-block--<slug>` on the outer section;
- `data-source-variant="<designVariant>"` where variant identity is available;
- renderer-owned `cms-block--source-*` classes only on DOM that follows the
  native `cms-block__*` contract;
- `cms-block__*` inner structural classes for source-backed generated blocks;
- global theme token consumption through class rules, not inline per-block
  style overrides.

Canvas-only affordances such as `data-block-index`, `data-active`, gutters,
selection overlays, drag handles, and editor messages are not emitted by
public/preview renderer output. Tenant CSS must not depend on them.

Notes:
- CTA contact/quote behavior is a renderer concern derived from structured CTA
  data and approved design variants, not analytics metadata.
- Canonical reference implementations live in `packages/site-renderer`. The
  canvas renderers mirror them and add only editing affordances.
- Generation-eligible blocks must expose the same structured content through
  sidebar fields and canvas editing. A renderer-only or sidebar-only block must
  stay out of generation until both editing surfaces and parity tests exist.
- Visual variants for generation are selected by the approved block
  `designVariant` field. Generic self-serve generation currently has no active
  provider-backed variants; the next active family must be exact-source
  Tailwind Plus only. Analytics metadata is not a visual-selection API.
  Inactive provider families, SIAB-owned generic visual variants, and temporary
  Ami-care tenant-compatibility variants are not generation inputs.

## § Theme tokens consumed by block renderers

The canvas renderers (`src/components/editor/canvas/blocks/`) AND the live-site renderers in `packages/site-renderer` MUST consume these CSS custom properties so the ThemeBar's settings flow to both surfaces in lockstep.

### Font role tokens

| Token | Where to use |
|---|---|
| `var(--font-title)` | `<h1>` / hero title |
| `var(--font-heading)` | `<h2>` / `<h3>` / any RtSlot rendered as a heading |
| `var(--font-text)` | body `<p>` / `<span>` / any RtSlot rendered as paragraph text |

### Radius tokens

| Token | Where to use |
|---|---|
| `var(--radius-sm)` | small chips / pills |
| `var(--radius-md)` | buttons, inputs, default surfaces |
| `var(--radius-lg)` | cards, large rounded panels, image containers |

`--radius-sm` and `--radius-lg` are derived by `toCssVars` from the user's chosen `theme.radius` value (`sm = max(radius - 0.25rem, 0)`, `lg = radius + 0.5rem`).

### Border style

| Token | Where to use |
|---|---|
| `var(--border-style)` | optional — borders that should adopt the user's chosen style (`solid` / `dashed` / `none`) |

### Dark mode overlay

When `theme.mode === "dark"`, `data-rt-mode="dark"` is set on the editor
canvas root by `CanvasSurface` and on public/preview renderer roots by
`packages/site-renderer` (`SitePageRenderer` / tenant renderers). All
`--color-*` vars MUST be defined in BOTH:

- a base block: `.rt-canvas { --color-accent: …; --color-bg: …; … }` for the canvas, or `html { --color-accent: …; … }` for the live site.
- a dark overlay block: `.rt-canvas[data-rt-mode="dark"] { … }` for the canvas, or `html[data-rt-mode="dark"] { … }` for the live site.

The base block holds the LIGHT palette; the overlay block holds the DARK palette. `toCssVars` emits both blocks when `theme.darkPalette` is set.

### Implementation rule

Each renderer (canvas + live-site) MUST emit its styling through class rules that
resolve to these vars — **never hard-code colour / font / radius values**. If a
renderer hard-codes a value, the ThemeBar cannot drive it and the user can't see
the change.

Do not add arbitrary block-level visual tokens, per-block class names, provider
token override fields, or one-off color/font/radius controls. Fonts, colors,
shape, radius, border style, and mode are global theme-toolbar settings. Block
schemas may choose approved design variants, but all visual tuning must resolve
through global theme tokens and renderer-owned class rules.

For Tailwind classes like `rounded-md`, KEEP them as fallback for the case where
`theme.radius` is unset, but layer token-driven class rules on top
(`rounded-[var(--radius-md)]`, `[font-family:var(--font-text)]`, etc.) so the
user's choice wins without React inline `style=""` attributes. This keeps the
canvas compatible with a future nonce-only CSP `style-src`.
