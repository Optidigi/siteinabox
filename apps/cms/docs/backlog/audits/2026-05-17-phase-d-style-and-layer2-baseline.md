# Phase D5+D6 Audit Baseline — Style Violations + Layer 2 Composites Inventory

**Date:** 2026-05-17
**Run after:** Phase B.3 complete (15 `@siab/*` items extracted), B.4 blocked on OBS-53
**Purpose:** Concrete inventory of the migration work behind FE-46 "siab-payload as a complete `@siab/*` consumer (zero authored CSS in app)"

## TL;DR

**Style baseline is much cleaner than expected.** Most of the migration work is concentrated in two places: `src/styles/globals.css` (400 lines of authored CSS that must move to the registry) and a small set of borderline-but-functional inline `style` props in canvas block renderers. Almost everything else is already token-aware or legitimately dynamic.

- **0** hex-literal violations in component code
- **0** arbitrary Tailwind value violations
- **0** UI internals reach-ins
- **0** standalone `.css` files in `src/` outside `globals.css`
- **0** dead Layer 2 files
- **78** inline `style` prop occurrences — ~50 legitimately dynamic, ~25 borderline token-aware (work for D6), 3 hardcoded but legitimate (canvas zoom, image URL, palette fallback)
- **7 of 9** initially-flagged "PROMOTE" Layer 2 files are ALREADY registry items (installed at `src/components/<name>.tsx` per the existing `registry:check` diff list — not at `src/components/ui/`). The audit subagent missed this distinction.
- **2 actual PROMOTE candidates** to verify: `login-04.tsx`, `onboarding-checklist.tsx`
- **52 Payload-coupled** Layer 2 files (forms, tables, dashboard, media, layout, editor infrastructure) — legitimately stay in app

## D6 — Style violation sweep

### 1. Standalone `.css` files

**1 file, expected:** `src/styles/globals.css` (400 LOC). Contents categorised:

| globals.css section | Lines | Migration target |
|---|---|---|
| Tailwind imports + `@custom-variant dark` | 1-4 | **STAYS** (tooling) |
| `:root` token block | 6-46 | `@siab/theme-base` (D1) |
| `.dark` token overrides | 48-87 | `@siab/theme-base` (D1) |
| `@theme inline` Tailwind v4 mapping | 89-149 | `@siab/theme-base` (D1) |
| Global resets (`*`, `body`) | 151-152 | `@siab/base-styles` (D2) |
| iOS input zoom fix | 154-161 | `@siab/base-styles` (D2) |
| `.rt-content*`, `.rt-placeholder`, `.rt-field` admin form-mode | 163-239 | `@siab/rich-text-toolbar` add a CSS file (D3) |
| `.rt-canvas` token re-bindings | 241-275 | `@siab/canvas-chrome` add a CSS file (D4) |
| `.rt-canvas[data-rt-mode="dark"]` default dark | 277-302 | `@siab/canvas-chrome` (D4) |
| `.rt-canvas` ::selection, .cms-block selection ring, inline-edit affordances, sidebar [data-rt-selected] ring, mobile dashed hints | 304-396 | `@siab/canvas-chrome` (D4) |
| `@keyframes rt-arrival-pulse` + animation | 398-413 | `@siab/canvas-chrome` (D4) |
| Mobile `.rt-canvas[data-rt-view="mobile"]` hints | 415-427 | `@siab/canvas-chrome` (D4) |

After D1-D4 ship + are consumed, `src/styles/globals.css` shrinks to ~5 lines: Tailwind imports, `tw-animate-css` import, `@custom-variant dark`, and a single `@import "@siab/...";` (or installed-file include) that pulls all registry CSS into the build.

### 2. Inline `style` props (78 occurrences)

**Category (a) — Dynamic runtime values (~50, legitimate)**: dynamic position (`left`, `top`, `bottom` from coordinates), dynamic sizes (`width: size`, `height: size`), dynamic CSS custom properties (`"--gap": spacing`), conditional disabled styles. All correctly use inline style because the value is computed per-render.

**Category (b) — Static token-aware (~25, borderline — work for D6 migration wave)**: mostly `fontFamily: "var(--font-*)"` and `borderRadius: "var(--radius-*)"` in canvas block renderers (Hero, CTA, FAQ, FeatureList, ContactSection, RichText, Testimonials) + `InlineCtaButton`. These reference design tokens correctly, but inline `style` is the wrong place — they should be CSS classes shipped by the relevant registry item (e.g., `.rt-cta-button` class as part of `@siab/canvas-inline-cta-button`, or block-specific classes shipped by each block's registry item if those get extracted).

**Category (c) — Hardcoded but legitimate (3)**:
- `canvas-mode.tsx:312` — `width: CANVAS_DESIGN_WIDTH, zoom` (editor viewport sizing constant)
- `InlineImage.tsx:113` — `backgroundImage: 'url(${url})'` (dynamic image)
- `palette-picker.tsx:189` — `background: swatchFor(row.palette)` (computed from runtime palette data)
- `color-chip.tsx:95,112` — `backgroundColor: defaultColor || "transparent"` (computed)

### 3. Arbitrary Tailwind values

**0 violations.** All `[...]` brackets in className are valid Tailwind v4 patterns:
- Data-attribute selectors: `[&_em]`, `[data-state=open]`, `[variant=floating]`
- Environment variables: `[env(safe-area-inset-bottom)]`
- CSS calc/functions: `[calc(100vw-2rem)]`, `[min(calc(100vh-2rem),calc(100dvh-2rem))]`
- Computed values from constants (z-index, aspect ratio): `[9999]`, `[4/5]`

Minor: animation-delay arbitrary values (`[animation-delay:Xms]`) in Hero/Testimonials block entrance animations (6 occurrences). Could migrate to a Tailwind v4 animation plugin or stay as-is — low impact.

### 4. Hex literals

**0 component-level violations.** All ~41 occurrences are in:
- `src/lib/theme/presets.ts` — design system palette preset DATA (intentional, not authored CSS)
- `src/lib/theme/toCssVars.ts` — DEFAULT_DARK fallback palette (intentional)
- `globals.css` — `var(--color-bg, #fff)` CSS fallback chains (intentional, spec-safe)
- Email templates (`src/lib/email/templates/*.ts`) — inline HTML email styling (not component CSS)
- Zod schema validation strings (text, not styling)

### 5. Direct color functions

**0 component-level violations.** All 3 occurrences in `globals.css` (`color-mix(in oklab, ...)`) are intentional runtime-aware editor affordances. 1 in `toCssVars.ts` is the DEFAULT_DARK rgba fallback. All move with their parent code in D1-D4.

### 6. UI internals reach-ins

**0 violations.** All imports of `@/components/ui/*` use top-level paths.

## D5 — Layer 2 composites inventory (68 files)

### Already-registry-items at `src/components/<name>.tsx` (NOT `ui/`) — 7

These are part of the original 33 `@siab/*` items per the existing `registry:check` script's diff list. The audit subagent flagged them as PROMOTE without realising they're already promoted:

- `confirm-dialog.tsx` ← `@siab/confirm-dialog`
- `typed-confirm-dialog.tsx` ← `@siab/typed-confirm-dialog`
- `data-table.tsx` ← `@siab/data-table`
- `empty-state.tsx` ← `@siab/empty-state`
- `page-header.tsx` ← `@siab/page-header`
- `theme-provider.tsx` ← `@siab/theme-provider`
- `theme-toggle.tsx` ← `@siab/theme-toggle`

**No work needed** for these. They're correctly installed at the non-`ui/` path per the registry items' `target` directive.

### Real PROMOTE candidates (D5a) — 2 to verify

- `src/components/login-04.tsx` (37 LOC) — two-column auth shell. Audit verdict: pure UI composition, zero Payload coupling.
- `src/components/onboarding-checklist.tsx` (118 LOC) — generic multi-step checklist with localStorage persistence. Audit verdict: pure UI + hooks, no Payload coupling.

**Verify before promoting**: check if either already exists in the design-systems registry (maybe missed in the audit). If not, candidates for new `@siab/login-04` + `@siab/onboarding-checklist` registry items.

### RETAIN (legitimately Payload-coupled or app-wiring) — 52

Forms (13): `LoginForm`, `PageForm` (681 LOC — heaviest), `TenantForm`, `TenantEditForm`, `UserEditForm`, `UserInviteForm`, `CreateUserForm`, `SettingsForm`, `ProfileForm`, `ResetPasswordForm`, `ForgotPasswordForm`, `ApiKeyManager`, `FormSubmissionSheet` — all Payload Document mutation endpoints.

Tables (4): `PagesTable`, `TenantsTable`, `UsersTable`, `FormsTable` — Payload Collection consumers via DataTable.

Dashboard (3): `ActivityFeed`, `EditsChart`, `StatCards` — app-specific data + routing.

Media (4): `MediaPicker`, `MediaGrid`, `MediaUploader`, `MediaUsageDialog` — Payload Media collection-coupled.

Layout (4): `AppSidebar`, `SiteHeader`, `UserMenu`, `TenantPill` — role-aware menus, tenant routing.

Editor ecosystem (~24): `PageForm` context, `FieldRenderer`, `LexicalField`, `BlockPresetsContext`, `useNavigationGuard`, `useCanvasBlocks`, `elementPath`, `canvasView`, `CanvasSelectionContext`, `MobileEditorContext`, rich-text Lexical plugins (`PastePlugin`, `RtClassSyncPlugin`, `InlineConstraintPlugin`), canvas block renderers (Hero, CTA, FAQ, FeatureList, ContactSection, RichText, Testimonials — 7 files), inline primitives (RtSlot, InlineImage, InlineCtaButton, InlineIcon, ClickToEditField, RtStaticView — 6 files), and `blockElements`.

**Open question for D5b (separate evaluation, not pre-decided here):** The 7 canvas block renderers + 6 inline primitives encode site-specific block schemas via the rich-text manifest contract. Per the FE-46 zero-CSS vision they're "frontend that should ship from the registry." Per the actual data flow they're tightly coupled to per-tenant block schemas. Decide later whether they promote to shared UI/source (with the schema also coming from the same contract) or stay in the CMS as the app's binding layer between Payload schema + shared primitives. **This is multi-package work** and should be revisited only after the platform architecture reset has an approved direction.

### DELETE / NEEDS_REVIEW — 0

All 68 Layer 2 files have active consumers. No dead code.

## Migration wave strategy

**Blocked on OBS-53 (VPS publish) — write specs now, execute post-publish:**
- D1 — extract design tokens → `@siab/theme-base`
- D2 — extract base layer → `@siab/base-styles`
- D3 — extract `.rt-content*` form-mode rich-text styles → `@siab/rich-text-toolbar` add CSS file
- D4 — extract `.rt-canvas*` editor affordance CSS + `@keyframes rt-arrival-pulse` → `@siab/canvas-chrome` add CSS file
- D5a — promote `login-04` + `onboarding-checklist` (after verifying they're not already in design-systems)

**Independent of OBS-53 (can execute today):**
- D6 — migrate ~25 borderline inline `style` props in canvas block renderers + InlineCtaButton to CSS classes. Probably has to wait for the relevant registry item to ship CSS (D4 or block-renderer extraction).
- D7 — lint gate: forbid inline `style` props with token values, forbid standalone `.css` in `src/` outside `globals.css`, forbid arbitrary Tailwind values in `className`. ESLint custom rules or stylelint config.

**Out of scope until separately decided:**
- D5b — canvas block renderers + inline primitives migration (multi-package, depends on the approved platform architecture)

## Recommended order

1. **D7 lint gate (today)** — codify the rules. Even with current 0-violation state, the gate prevents regression. Cheap, immediate.
2. **D5a verify + promote (today, partial)** — check if `login-04` / `onboarding-checklist` already exist. If not, brainstorm + write spec for both (execution blocked on publish).
3. **D1 spec (today)** — `@siab/theme-base` design. Execution blocked.
4. **D2/D3/D4 specs (today/soon)** — base-styles, rich-text-toolbar CSS extension, canvas-chrome CSS extension. Execution blocked.
5. **Operator action: VPS publish** — unblocks B.4 + D1-D5a execution.
6. **D1-D5a execution wave** (one cutover per phase).
7. **D6 migration wave** (after the relevant registry items ship CSS).
8. **D5b multi-repo evaluation** (separate program).
