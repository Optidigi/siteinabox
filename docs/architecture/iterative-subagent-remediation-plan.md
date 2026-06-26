# Iterative Subagent Remediation Plan

This plan turns the branch review findings into an iterative implementation
sequence. It uses one focused subagent per phase. Phases run in order, never in
parallel, so each phase can consume the previous phase's results before changing
code.

## Operating Model

- The coordinator opens exactly one phase at a time and gives the phase agent
  the current branch state, the prior review report, and this document.
- Each phase agent completes three subphases: research, implement, and review.
- The phase agent may only edit files inside the phase scope.
- The phase agent must not add broad refactors, tenant-specific generated code,
  new `sites/*` folders, tenant-specific workflows, or tenant-specific images.
- The phase agent must produce a handoff note with changed files, commands run,
  remaining risks, and any blocked items.
- The coordinator reviews each handoff before starting the next phase.
- If a phase discovers that its planned implementation would change the product
  architecture, the phase stops after research and asks for operator approval.

## Global Completion Gates

Every implementation phase should keep these commands green unless the phase
explicitly documents a pre-existing blocker:

```bash
pnpm packages:typecheck
pnpm cms:typecheck
pnpm cms:test
pnpm renderer:typecheck
pnpm renderer:build
pnpm site:build
pnpm tenant:amicare:build
pnpm tenant:amblast:build
```

CMS phases that touch TypeScript or JavaScript under `apps/cms` must also run:

```bash
pnpm --dir apps/cms --ignore-workspace payload:contract
pnpm --dir apps/cms --ignore-workspace lint:ui-boundary
pnpm --dir apps/cms --ignore-workspace lint:ui-composition
pnpm --dir apps/cms --ignore-workspace lint:no-css
pnpm --dir apps/cms --ignore-workspace check:responsive
```

## Phase 1: Baseline Stabilization Agent

Goal: make the current branch testable and staging-gate clean before product
hardening starts.

### Research

- Re-run the full required command matrix and identify exact failing commands.
- Determine whether `pnpm site:build` fails from branch code, lockfile/tooling,
  Node version, or a pre-existing dependency mismatch.
- Review CI/workspace scripts and identify missing branch-relevant gates.
- Confirm the local Node version expected by CMS and document any mismatch.

### Implement

- Apply only minimal fixes needed to make the baseline command matrix pass.
- Add or adjust workspace/CI gates only where they reflect already-required
  checks.
- Do not change generation, publishing, preview, or rendering behavior in this
  phase unless a failing test cannot run without a tiny compatibility fix.

### Review

- Re-run the full baseline command matrix.
- Report whether the branch is staging-gate clean.
- Produce a command table with pass/fail, exact failure text, and likely cause.

## Phase 2: Block Catalog Agent

Goal: define a real renderer block catalog so generated sites are built from
approved data-backed blocks, not generated source code.

### Research

- Inventory current canonical block support in `packages/contracts`,
  `packages/site-renderer`, CMS projection, and tenant fixtures.
- List required missing marketing-site blocks and variants for the first
  production catalog.
- Review free Tailwind Plus blocks and other license-compatible Tailwind block
  sources as design references. Record source URL, license/usage status, and
  whether each block is free, paid, or unavailable.
- Map candidate blocks to SIAB-owned block contracts, CMS editor fields,
  renderer components, theme tokens, and fixtures.

### Implement

- Add catalog metadata for approved blocks and variants in the shared contract
  layer or a clearly owned renderer catalog module.
- Implement only selected V1 blocks or variants that have verified licensing and
  a clear data contract.
- Keep AI output limited to `SiteGenerationSpec` block data. Do not let AI
  output Tailwind, React, Astro, HTML, CSS, or arbitrary component source.
- Add fixtures and renderer tests for every catalog entry.

### Review

- Verify each catalog entry has: contract type, runtime validation target,
  CMS-editable fields, renderer output, theme behavior, and fixture coverage.
- Confirm no proprietary paid block code was copied into the repo.
- Confirm no generated tenant source files or new `sites/*` folders were added.

## Phase 3: Contracts And Runtime Validation Agent

Goal: make data contracts enforceable at runtime across generation, import,
publish, and renderer snapshot loading.

### Research

- Audit all current TypeScript-only contracts in `packages/contracts`.
- Identify every place that accepts untrusted or persisted generation data:
  intake, AI provider output, importer, snapshots, CMS renderer endpoint, and
  public renderer.
- Compare current custom validators with the intended block catalog and
  `PublishedSiteSnapshot` shape.

### Implement

- Add runtime schemas for intake, normalized intake, `SiteGenerationSpec`,
  block payloads, theme tokens, validation/apply results, and
  `PublishedSiteSnapshot`.
- Make unsupported block slugs and missing required block fields fail before
  CMS mutation.
- Make the OpenAI provider request strict enough that model output is shaped as
  contract data, then validate again server-side before applying.
- Validate snapshots before they are stored and before the renderer consumes
  them.

### Review

- Add negative tests for unsupported block slugs, missing block fields, invalid
  rich text, invalid theme tokens, invalid snapshot payloads, and malformed AI
  output.
- Confirm invalid generation output cannot mutate CMS state.
- Confirm contracts still do not import from `apps/*`.

## Phase 4: Intake, Generation, And Importer Agent

Goal: harden intake, generation-run tracking, and idempotent CMS draft import.

### Research

- Trace `POST /api/intake` from request body through normalization, generation,
  validation, import, and run status updates.
- Identify idempotency behavior for repeated submissions, repeated specs,
  changed specs, removed pages, and failed generations.
- Audit root page slug conventions across intake, importer, preview, and
  renderer.

### Implement

- Align the root page convention across the system.
- Strengthen public intake validation and remove public test-only controls such
  as fixture selection unless explicitly gated for development/test.
- Preserve idempotency for tenant, site settings, pages, theme, SEO, and
  manifest updates.
- Define safe behavior for generated pages removed from a later spec.

### Review

- Test repeated intake/generation/import with same and changed specs.
- Test invalid generation output and failed provider calls.
- Confirm import creates draft CMS data only and never publishes live output.
- Confirm import never creates source files.

## Phase 5: Publish, Activation, And Live Safety Agent

Goal: make snapshots immutable, activation-gated, rollback-capable, and isolated
from draft CMS state.

### Research

- Trace `POST /api/publish`, `publishSiteSnapshot`,
  `activatePublishedSnapshot`, rollback behavior, and
  `resolvePublishedSnapshotByHost`.
- Identify how draft pages, unpublished pages, inactive tenants, domain aliases,
  payment state, manual activation, and domain verification affect live output.
- Audit `PublishedSiteSnapshots` access and mutation paths.

### Implement

- Prevent accidental inclusion of draft/unpublished pages in live snapshots.
- Enforce or strongly protect snapshot immutability after creation.
- Make rollback state explicit, including `rolled_back` or equivalent audit
  metadata if that status remains in the schema.
- Enforce the approved activation policy for approval, payment, manual override,
  tenant status, and domain verification.

### Review

- Test publish without activation, activation without approval/payment,
  activation with manual override, payment-complete activation, rollback, and
  inactive/suspended/archived tenants.
- Confirm draft CMS changes do not affect live output until a new snapshot is
  published and activated.
- Confirm super-admin-only publish and non-super-admin failures.

## Phase 6: Renderer And Deployment Agent

Goal: make `apps/renderer` safe as a generic public runtime and document the
deployment contract.

### Research

- Trace host normalization, CMS snapshot fetching, bearer-token behavior,
  fixture fallback, page path resolution, aliases, and unknown-host behavior.
- Review renderer build/deploy assumptions, env variables, CI coverage, and VPS
  stack requirements.
- Identify whether canonical-domain redirects are required or aliases should
  simply serve the same snapshot.

### Implement

- Guard fixture fallback so it cannot serve production traffic by accident.
- Ensure unknown hosts, missing hosts, inactive tenants, and unknown paths
  return the intended status.
- Document required renderer/CMS environment variables and production deploy
  assumptions.
- Add CI/workspace gates for renderer checks if still missing.

### Review

- Run renderer typecheck/build and local smoke tests against fixture and CMS
  snapshot modes.
- Test root page, subpage, unknown path, unknown host, inactive tenant, and
  alias behavior.
- Confirm renderer never reads draft CMS state.

## Phase 7: Preview And Customizer Agent

Goal: verify the CMS preview/customizer is secure, iframe-free, and limited to
approved theme edits.

### Research

- Trace preview-token creation, token verification, preview page loading,
  customizer actions, theme persistence, approval, and payment placeholder
  behavior.
- Confirm which theme controls are expected: color scheme, font scheme, radius,
  density, and style preset.
- Audit wrong-tenant, expired-token, invalid-token, and suspended-tenant cases.

### Implement

- Fill only missing controls or guards required by the approved preview contract.
- Keep the preview rendered directly with `packages/site-renderer`; do not add
  iframe-based preview.
- Ensure approval cannot bypass payment/activation rules except through explicit
  manual activation.

### Review

- Run source tests and browser tests for token access, wrong tenant, expiry,
  theme live update, theme persistence, reload, approval, and no iframe usage.
- Confirm preview cannot access another tenant or expose public draft data.

## Phase 8: Final End-To-End Verification Agent

Goal: verify the complete implementation shape and produce a deploy decision.

### Research

- Re-read all phase handoffs and confirm every P0/P1 finding has a resolved,
  accepted, or intentionally deferred status.
- Rebuild the route matrix, operation matrix, environment-variable list,
  migration list, and deployment assumptions from current code.

### Implement

- Make only small corrective fixes uncovered during final verification.
- Do not add new block types, new product flows, or broad refactors in this
  phase.

### Review

- Run the full global completion gate matrix.
- Run a practical local CMS plus renderer flow:
  intake, generation, invalid generation, import, preview token, customizer,
  approval, publish, activation, renderer root/subpage/404, draft change
  isolation, republish, rollback, unknown host, inactive tenant, and alias.
- Produce the final staging/prod readiness report with exact routes, commands,
  failures, and remaining work.

## Phase Handoff Template

Each phase agent must return:

```txt
Phase:
Subagent:
Scope:
Research summary:
Changed files:
Routes affected:
Env vars affected:
Migrations/schema affected:
Tests run:
Pass/fail table:
Remaining risks:
Next phase dependencies:
```

## Stop Conditions

Stop and ask for operator direction if any phase requires:

- creating tenant-specific source code;
- adding folders under `sites/*` for generated sites;
- adding tenant-specific workflows or images;
- copying unlicensed or paid-only block source;
- changing payment-provider neutrality;
- changing the approved app boundaries between `apps/landing`, `apps/intake`,
  `apps/cms`, `apps/renderer`, `packages/contracts`, and
  `packages/site-renderer`.
