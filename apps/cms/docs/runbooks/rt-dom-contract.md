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

A fixture corpus of RtNode trees lives at `docs/runbooks/rt-fixtures.json`. The Astro template's CI should run its renderer against each fixture and assert the emitted DOM matches this contract.

## Canvas block DOM contract

Canvas block renderers (`src/components/editor/canvas/blocks/*.tsx`) emit a `<section class="cms-block cms-block--<slug> …">` whose inner DOM mirrors the rendered-site components in `sites/ami-care/src/components/cms/*.tsx` and the reusable baseline in `packages/site-template/src/components/cms/*.tsx`. Tenant CSS targets these class names — they are the stable contract between the canvas editor and the live site. When a rendered-site component's DOM changes, its canvas renderer must be updated in lockstep.

| Block | Outer section classes | Key inner structural classes |
|---|---|---|
| **hero** | `cms-block cms-block--hero relative flex min-h-[90vh] flex-col items-center overflow-hidden …` | Content col: `w-full space-y-7 @min-[48rem]/site-frame:w-1/2` · Image col: `relative mt-14 w-full @min-[48rem]/site-frame:mt-0 @min-[48rem]/site-frame:w-1/2` |
| **featurelist** | `cms-block cms-block--featurelist relative bg-card/50 …` | Inner max-width wrapper: `mx-auto max-w-7xl` · Feature grid: `grid grid-cols-1 gap-8 @min-[48rem]/site-frame:grid-cols-3` · Card: `overflow-hidden rounded-[2rem] border border-rule bg-card shadow-lg` |
| **cta** (contact variant) | `cms-block cms-block--cta cms-block--cta-contact border-t border-rule …` | Content centred: `mx-auto max-w-3xl space-y-8 text-center` |
| **cta** (quote variant) | `cms-block cms-block--cta cms-block--cta-quote relative isolate overflow-hidden bg-secondary/40 …` | Content centred: `mx-auto max-w-3xl text-center` |
| **richtext** | `cms-block cms-block--richtext …` | Prose wrapper: `prose mx-auto max-w-prose … prose-headings:font-serif …` |
| **contact** | `cms-block cms-block--contact …` | Inner: `container mx-auto max-w-2xl` · Form preview: `pointer-events-none` wrapper |
| **faq** | `cms-block cms-block--faq …` | Inner: `container mx-auto max-w-3xl` · Item list: `<dl class="space-y-4">` · Each item: `<details class="group rounded-2xl border border-rule bg-card p-4">` |
| **testimonials** | `cms-block cms-block--testimonials bg-secondary/40 …` | Inner: `container mx-auto` · Card grid: `grid gap-6 @min-[48rem]/site-frame:grid-cols-2 @min-[64rem]/site-frame:grid-cols-3` · Card: `<figure class="flex flex-col rounded-[2rem] border border-rule bg-card p-6">` |

Notes:
- The CTA block dispatches on `primary.href` at render time: `mailto:`/`tel:` prefixes produce the contact variant; anything else produces the quote variant. Both share the `cms-block--cta` base class; the variant class (`cms-block--cta-contact` / `cms-block--cta-quote`) lets tenant CSS target each flavour separately.
- The `data-block-index` and `data-active` attributes are canvas-only affordances — they are not emitted by the rendered-site components and tenant CSS must not rely on them.
- Canonical reference implementations: `sites/ami-care/src/components/cms/*.tsx` and `packages/site-template/src/components/cms/*.tsx`. The canvas renderers mirror them.

## § Theme tokens consumed by block renderers

The canvas renderers (`src/components/editor/canvas/blocks/`) AND the live-site renderers (in `sites/ami-care` and `packages/site-template`) MUST consume these CSS custom properties so the ThemeBar's settings flow to both surfaces in lockstep.

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

When `theme.mode === "dark"`, `data-rt-mode="dark"` is set on the canvas root by `CanvasMode` (and on the live-site root by the renderer once R5 ships). All `--color-*` vars MUST be defined in BOTH:

- a base block: `.rt-canvas { --color-accent: …; --color-bg: …; … }` for the canvas, or `html { --color-accent: …; … }` for the live site.
- a dark overlay block: `.rt-canvas[data-rt-mode="dark"] { … }` for the canvas, or `html[data-rt-mode="dark"] { … }` for the live site.

The base block holds the LIGHT palette; the overlay block holds the DARK palette. `toCssVars` emits both blocks when `theme.darkPalette` is set.

### Implementation rule

Each renderer (canvas + live-site) MUST emit its styling through class rules that
resolve to these vars — **never hard-code colour / font / radius values**. If a
renderer hard-codes a value, the ThemeBar cannot drive it and the user can't see
the change.

For Tailwind classes like `rounded-md`, KEEP them as fallback for the case where
`theme.radius` is unset, but layer token-driven class rules on top
(`rounded-[var(--radius-md)]`, `[font-family:var(--font-text)]`, etc.) so the
user's choice wins without React inline `style=""` attributes. This keeps the
canvas compatible with a future nonce-only CSP `style-src`.
