# UI overwrite boundary

This repo uses upstream shadcn as the primitive baseline, but it does not treat
every local primitive as blindly overwriteable. Shared primitive source now
lives in `packages/ui`; the CMS app keeps compatibility re-export shims.

There are three UI kits. They do not share source:

- Marketing Retro lives only in `apps/landing`. Do not restyle it from dashboard tokens.
- Operator dashboard (CMS, builder, checkout, logins) uses `packages/ui`:
  neutral admin surfaces, a neobrutalism jacket (hard borders, 5px offset
  shadow, `rounded-none`), and SIAB yellow as an **accent only**.
- Tenant canvas lives in `packages/site-renderer` with numbered variants and `ThemeTokenSpec`. It must not import `@siteinabox/ui`.

`packages/ui` is the only visual source of truth for those apps. Recipes live
in `packages/ui/src/lib/retro.ts` (`neoChrome`, `neoTray`, `neoPress`,
`neoPressFlat`, `neoField`, `neoFocus`). CMS composites compose those
primitives. Do not introduce a second glass/pill language (`backdrop-blur`,
`rounded-lg` overlays).

Light mode is a light admin theme (warm cream page, white cards, dark text,
near-black 5px slabs). Dark mode is the same operator kit inverted to lifted
charcoal `#242321`, cream ink `#f7f4ed`, slightly lifted charcoal tiles
(card/popover/sidebar, not `#000`), and white 5px slabs (`--neo-slab`).
2px strokes (`--border`, `--input`, `--sidebar-border`) are a 30/70 mix of
ink into the page so they stay greyer than `--neo-slab` in both modes.
Yellow (`--main`, `#f5e900`, the same SIAB yellow as landing) is for primary
CTAs, checked controls, selected nav, and chart highlight — not page, card,
sidebar, select, table hover, or header chrome. Do not invent a second gold.
Builder does not override this palette.

Chrome slabs (`neoPress`) use `--neo-slab` (near-black in light, white in
dark). Single-line inputs and select triggers sit on that slab so they match
default buttons. `neoField` / `Textarea` stay border-only — chat composers
own their well and must not grow a second drop. Yellow faces
(`default`/`brand`, selected nav) sit on the theme slab. Ink tiles (`Opslaan`, builder **Stuur**, checkout ink) keep the
inverted fill (`bg-foreground text-background`), the greyer `border-border`
hairline, and the same `--neo-slab` drop. Default text buttons and icon buttons share a 40px face (`h-10` /
`size-10`); `sm` / `icon-sm` share 36px (`h-9` / `size-9`). The collapsed
sidebar rail stays 3rem: labels hide, the selected 5px slab stays.

Button press (`neoPress`) matches landing ratios without sharing landing
source: rest 5px, hover 2px translate with a 3px leftover (`shadow-shadow-hover`),
active 5px sit-down and no shadow. Motion includes the CSS `translate` property
(not only `transform`) at `duration-200` with CSS `ease`, so the sit-down does
not snap ahead of the shadow. Ghost/link stay flat.
Packed toolbars use `neoTray` (border only); inner press tiles drop their own
rest offset so slabs do not stack. Static chrome (`neoChrome`, cards, dialogs)
keeps a 5px offset and does not translate. Keyboard focus uses `focus-visible`
only so mouse clicks do not leave a stuck ring. Buttons and toggles defer blur
until after `click` on mouse/pen up (not when they own a popup). Select and
dropdown menus do not auto-refocus the trigger after a pointer close.

Button roles: `default`/`brand` = primary (yellow tile, `--neo-slab` drop);
`ink` = inverted fill with the same drop; `outline`/`secondary` = neo control
tile; `ghost`/`link` = quiet (no tile). Selected sidebar nav keeps the yellow
fill. Header sparkle matches the other outline chrome tiles (theme toggle,
account, site switcher).

Landing keeps `apps/landing/src/components/ui/*`. Payload `/admin` CSS is out of scope.

## Paths

- `packages/ui/src/components/` owns shadcn primitive source.
- `packages/ui/src/styles/shadcn.css` owns the shared token/base CSS.
- `packages/ui/src/lib/` owns `cn` and CSP-safe runtime style helpers used by
  primitives and CMS chrome.
- `src/components/ui/` is upstream-name-only compatibility shims. It may contain
  shadcn primitive filenames such as `button.tsx`, `dialog.tsx`, `input.tsx`,
  and `sidebar.tsx`, but those files should re-export from `@siteinabox/ui`.
- App/editor composites live outside `src/components/ui/`:
  - `src/components/editor/`
  - `src/components/editor/` form, inspector, and mobile editing state
  - `src/components/editor/richText/toolbar/`
  - `src/components/editor/theme/`
  - `src/components/save-ui/`
  - `src/components/common/`
- `src/styles/shadcn.css` imports `@siteinabox/ui/styles/shadcn.css`.
- `src/styles/siab.css` is protected SIAB app/editor CSS.

`pnpm --dir apps/cms lint:ui-boundary` enforces the app path split.
`pnpm --dir apps/cms lint:ui-composition`
adds drift checks for composition style: direct Radix imports stay inside
reviewed primitives, inline style objects are blocked, and new files with
native `<button>` elements fail unless they are deliberately added to the
reviewed exception list in `scripts/check-ui-composition.mjs`.

## Primitive overwrite policy

Use `pnpm dlx shadcn@4.13.1 add @shadcn/<item> --diff` before accepting an
overwrite. Apply accepted primitive changes in `packages/ui/src/components/`
and keep the CMS shim intact. Do not bulk-overwrite primitives.

Last reviewed against `@shadcn` on 2026-06-15:

| Primitive | Decision | Reason |
| --- | --- | --- |
| `button` | Keep local fork | Upstream removes `type="button"` default, pointer cursor, mobile 44px/touch sizes, extra sizes, and local hover contrast. |
| `chart` | Keep local fork | Upstream reintroduces inline style objects for swatches/indicators and removes CSP nonce/style-rule sanitization. It also pulls a transitive `card` radius change. |
| `dialog` | Keep local fork | Upstream removes localized labels, mobile coarse-pointer autofocus guard, max-height/scroll containment, and local footer/content behavior. |
| `sheet` | Keep local fork | Upstream removes localized close label and mobile coarse-pointer autofocus guard. |
| `sidebar` | Keep local fork | Upstream pulls transitive `button`, `sheet`, and `input` changes and risks removing sidebar-local CSP/i18n/mobile behavior. |
| `badge` | Keep local fork | Upstream removes SIAB `success` and `warning` variants. |
| `input` | Keep local fork | Upstream removes mobile 44px tap-target floor. |
| `select` | Keep local fork | Upstream removes mobile default-trigger 44px tap-target floor. |
| `tabs` | Keep local fork | Upstream removes mobile horizontal tablist height that preserves 44px triggers. |
| `breadcrumb` | Keep local fork | Upstream removes localized aria/screen-reader labels. |
| `pagination` | Keep local fork | Upstream removes localized aria/screen-reader labels and also pulls transitive `button` changes. |
| `command` | Keep local fork | Upstream removes localized command dialog defaults and pulls transitive `dialog` changes. |
| `avatar` | Upstream clean | `shadcn add @shadcn/avatar --diff` reports no changes. |
| `textarea` | Upstream clean | `shadcn add @shadcn/textarea --diff` reports no changes. |

Keep these as reviewed local forks unless the listed behavior is intentionally
reimplemented elsewhere:

- `button`: default `type="button"`, pointer cursor, mobile/touch sizes, local
  hover contrast, extra sizes.
- `chart`: CSP nonce/style-rule handling and chart color safety.
- `dialog`: localized labels, scroll/max-height behavior, mobile autofocus
  guard, local footer/content behavior.
- `sheet`: localized close label and mobile autofocus guard.
- `sidebar`: CSP-safe style handling, localized labels, mobile/touch behavior,
  active-state and layout tweaks.
- `badge`: SIAB semantic variants such as `success` and `warning`.
- `input`, `select`, `tabs`: local mobile/touch density policy.
- `breadcrumb`, `pagination`, `command`: localized aria/screen-reader defaults.

Other primitive overwrites are lower risk, but still review the diff and run the
frontend gates.

## Builder agent stage

`/builder` is agent-first until a preview slug exists. The empty landing is a
short headline (`BUILDER_STAGE_HEADLINE`) and composer — no interview billboard
and no stored greeting bubble. A leftover assistant opener is dropped on load.
Desktop centers a logo, headline, and composer with space between title and
field; phone shows the same headline as a visual-only assistant turn in the
thread (not stored) and pins the composer to the
bottom. Landing and thread share a 40rem reading well (`BUILDER_CHAT_WELL_CLASS`);
the header rule, docked composer rule, and thread scrollbar stay on the
full chat column so they meet the viewport edge while the agent is
full-width. After the first send, the prompt stays mounted and docks on desktop
(~320ms); phone already has a docked composer, so only
the landing line fades into the thread. After the first apply, desktop
animates chat to `28rem` and slides the preview in from a `0fr` column;
phone stays on chat until **Bekijk je site** or the header preview control.
`prefers-reduced-motion: reduce` keeps the old hard swap. The builder header
uses the Site in a Box wordmark only — no “SIAB” label, no status line, and no
busy pulse. Assistant turns have no avatar. The desktop prompt box keeps its
2px border on hover and keyboard focus — ink color only, no extra outline or
width change. Do not show an
empty preview pane, auto-swipe the mobile pager on first generate, or copy
Gemini/Lovable pill/glow chrome.

## Gates

After UI boundary or primitive work, run:

```bash
pnpm --dir apps/cms lint:ui-boundary
pnpm --dir apps/cms lint:ui-composition
pnpm --dir apps/cms lint:no-css
pnpm --dir apps/cms check:responsive
pnpm --dir apps/cms typecheck
```

Run focused unit or integration coverage for the touched surface.
