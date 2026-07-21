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

A fixture corpus of RtNode trees lives at
`docs/contracts/rich-text-fixtures.json`. The
shared renderer's CI should run its renderer against each fixture and assert the
emitted DOM matches this contract.

## Generated block DOM contract

Generated blocks are rendered only by `packages/site-renderer`. Public output,
customer preview, and the CMS editor frame consume the same provider view and
structured rich-text renderer. The CMS does not maintain an editable mirror of
provider DOM; editing happens in the parent inspector. Block selection uses
stable `data-block-index` attributes. Field deep-link in the editor frame adds
editor-only `data-siab-field` markers via `editSlots` (never on public output).

Canonical references:

- provider dispatch: `packages/site-renderer/src/providers/shadcnui-blocks/block-views.generated.tsx`;
- client active-variant loading: `packages/site-renderer/src/ClientSitePageRenderer.tsx`;
- provider rich text: `packages/site-renderer/src/rich-text`.

Provider DOM/classes may change only through a pinned re-import. Editor-only
selection attributes must not affect layout, public output, or tenant CSS.

## § Theme tokens consumed by block renderers

The single renderer in `packages/site-renderer` consumes these CSS custom
properties. CMS editor and preview frames use that same renderer, so there is
no second token implementation to keep in sync.

### Font role tokens

| Token | Where to use |
|---|---|
| `var(--font-title)` | `<h1>` / hero title |
| `var(--font-heading)` | `<h2>` / `<h3>` / structured rich text headings |
| `var(--font-text)` | body `<p>` / `<span>` / structured rich text paragraphs |

### Radius tokens

| Token | Where to use |
|---|---|
| `var(--radius-sm)` | small chips / pills |
| `var(--radius-md)` | buttons, inputs, default surfaces |
| `var(--radius-lg)` | cards, large rounded panels, image containers |

Radius variables come from the generated static preset stylesheet selected by
`data-theme-shape` (`soft`, `sharp`, or `rounded`). CMS and generation never
store raw radius values.

### Dark mode overlay

When the resolved renderer theme mode is dark, `data-rt-mode="dark"` is set on
the shared `ThemeCanvas`. The configured `light` / `dark` / `system` preference
is retained separately as `data-siab-theme-mode`; system mode follows
`prefers-color-scheme`. Public pages also stamp the resolved value on
`html[data-siab-color-mode]` before paint and may use the visitor's safe
`siab-color-mode` override. SIAB semantic color variables are emitted once in
the generated static preset stylesheet. `data-theme-color`, `data-theme-font`,
and `data-theme-shape` select the approved preset; `data-rt-mode` selects its
paired light/dark values. CMS/generation do not store raw palettes or emit
runtime CSS.

Generated-site CSS wires Tailwind's native `dark:` variant to
`[data-rt-mode="dark"]`. Provider source that includes `dark:` utilities may use
that native path and should compute from Tailwind's default palette values.
Monochrome retains exact upstream palette values (pure white / near-black
canvas). Colored presets keep a soft brand **canvas wash** on
`--background` / `--color-bg` (`oklch(0.980 0.025 <hue>)` light,
`oklch(0.150 0.030 <hue>)` dark) so the page reads tinted without competing
with content; elevated panels use a slightly higher-L / lower-C `--card`.
Recessed panels (`--muted` / `--secondary`) sit below the wash by at least
~monochrome’s ΔL (`oklch(0.945 0.018 <hue>)` light) so `bg-muted` cards stay
visible. Colored presets also scope neutral and decorative palette families to
the tenant color; status palettes remain independent. Provider sources that do
not include `dark:` utilities may be themed only through renderer-owned bridge
rules for explicit semantic roles: ambient surfaces, ambient ink, accent
affordances, borders, shape, and reviewed tokenized decoration.
`bg-gray-900` remains a source-owned dark panel unless an explicit bridge says
otherwise.

### Implementation rule

Each renderer (canvas + live-site) MUST emit its styling through class rules that
resolve to these vars — **never hard-code colour / font / radius values**. If a
renderer hard-codes a value, the editor theme toolbar cannot drive it and the
user can't see the change.

Do not add arbitrary block-level visual tokens, per-block class names, provider
token override fields, or one-off color/font/radius/spacing controls. Fonts,
colors, shape, and mode are global
theme-schema settings. Block schemas may choose approved design variants, but
all visual tuning must resolve through global theme tokens and renderer-owned
class or provider bridge rules.

For Tailwind classes like `rounded-md`, KEEP them as fallback for the case where
shape tokens are unavailable, but layer token-driven class rules on top
(`rounded-[var(--radius-md)]`, `[font-family:var(--font-text)]`, etc.) so the
user's choice wins without React inline `style=""` attributes. This keeps the
canvas compatible with a future nonce-only CSP `style-src`.
