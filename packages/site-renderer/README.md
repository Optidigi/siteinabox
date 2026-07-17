# `@siteinabox/site-renderer`

Shared rendering core for CMS canvas/preview and `apps/renderer`.

Generated public sites use only the pinned `akash3444/shadcn-ui-blocks` Radix
catalog. The canonical generated manifest is in `packages/contracts`; runtime
block, chrome, and system-template registries derive from it. Every page block
must carry an approved `shadcnui-blocks.*` variant and unresolved variants fail
closed. Official Amicare variants remain tenant-exclusive compatibility paths.

Provider provenance, original source hashes, the vendored MIT license, pinned
registry capture, dependency inventory, and machine-readable exclusions live under
`src/providers/shadcnui-blocks`. Recreate them with:

```bash
node scripts/import-shadcnui-blocks.mjs
```

The importer always checks out commit
`46c2e50bb538c9bc7a8927979d38bae178ae4452` and reads
`registry-radix.json`. Provider compatibility primitives are namespaced under
`packages/ui/src/providers/shadcnui-blocks/radix-nova`; they never overwrite
shared/CMS primitives.

`ThemeTokenSpec` stores only approved appearance, color, font, and shape preset
IDs. One canonical preset manifest generates `theme-presets.generated.css`;
renderers select it with data attributes and never generate tenant CSS at
runtime. Preview theme edits patch those attributes without rerendering the
block tree. The three shapes are Round, Soft (the upstream 0.625rem default),
and Sharp. Semantic controls follow the selected shape while structural circles
remain circles. There is no arbitrary CSS map or per-block theme schema.

There is one imported literal component tree. Production views and the parity
surface import that same tree, so parity cannot drift into a second reference
implementation. Monochrome emits the exact pinned shadcn light/dark tokens with
Inter as the provider reference font. A colored tenant theme changes root-scoped Tailwind and semantic variables;
it never rewrites literal classes. Intentional fixed artwork, logo, mask, and
on-media values are exhaustively listed in `token-exceptions.json`; a fixed visual
value outside that manifest fails the catalog tests.

Run `pnpm test` for type, catalog-count, exclusion, slot, token, source-hash,
demo-copy, contact-form, and fail-closed checks. All imported variants have
explicit literal entries and typed adapters. `pnpm visual:provider-parity`
builds and starts the pinned upstream in production mode, then compares all 156 variants at
fixed desktop/mobile light/dark viewports with a 0.01% antialias tolerance.
CI or multi-core local runs may divide the canonical inventory with
`SIAB_PROVIDER_PARITY_SHARD_COUNT` and `SIAB_PROVIDER_PARITY_SHARD_INDEX`;
the modulo-based shards are disjoint and together retain the same 624 cases.
Two behavior-bearing content layouts (`contact-02` and `features-03`) and the
16 settings-backed chrome layouts are explicit audited adapters because they
must bind forms/navigation/settings rather than demo constants. Their complete
alternate render set is asserted by tests. `pnpm --dir apps/renderer
test:provider-browser` hydrates all 156 provider
variants at all four viewports, verifies two deliberately different tenant
themes through computed styles, and checks browser errors, overflow,
accessibility smoke rules, and available interactions.
