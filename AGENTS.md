# Repository agent instructions

This is one monorepo. These instructions apply everywhere; there are no
app-local agent instruction files. Start work from the repository root.

## Canonical sources

- Human documentation lives under `docs/`.
- Executable facts come from manifests, the root lockfile, schemas, tests,
  scripts, compose files, Dockerfiles, and CI.
- Root `mcp.registry.json` is the canonical MCP policy registry. Root client
  projections, including `.mcp.json`, are checked with `pnpm mcp:check` and
  updated with `pnpm mcp:sync`.
- Type-safety policy is enforced by `pnpm type-safety:check`; see
  `docs/engineering.md` for the ratchet and touched-file rules.
- Runtime content, migrations, fixtures, and source-owned configuration stay
  with the code that consumes them; they are not general documentation.
- Do not commit temporary plans, transcripts, personal machine paths, secrets,
  credentials, or `AGENTS.override.md` files.

## Before changing anything

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

- Read the request, this file, the nearest relevant manifest/tests, and only
  the root documentation needed for the changed surface.
- Preserve unrelated work. Never reset, clean, stash, overwrite, or broadly
  reformat changes you do not own.
- Reproduce a reported defect where feasible. Classify material findings as
  observed fact, confirmed defect, risk, intentional/accepted behavior,
  unknown, recommendation, or historical/closed.
- Use the highest risk level triggered by the change; follow
  `docs/engineering.md`.

## Architecture boundaries

- `apps/landing` owns the marketing site; `apps/intake` owns `/intake`;
  `apps/cms` owns Payload administration, tenants, and content;
  `apps/renderer` serves published tenant snapshots.
- New sites are validated tenant/site/page/theme/SEO/publishing data, not
  tenant-specific source trees, workflows, images, or executable AI output.
- Shared contracts belong in `packages/contracts`, shared UI in `packages/ui`,
  shared preview/live rendering in `packages/site-renderer`, and governed legal
  source in `packages/legal-content`.
- Do not import one application's components into another application.
- Preserve existing provider boundaries for domains, DNS/proxy/email, analytics,
  and payments. External writes always require explicit approval.

## CMS-specific safety

When changing `apps/cms`:

- Treat authentication, authorization, tenancy, schema/data migrations,
  production operations, and legal/privacy behavior as High risk.
- Tenancy is resolved by `src/proxy.ts`; consumers use `getSiabContext()`.
- `super-admin` has no tenant; `owner`, `editor`, and `viewer` have exactly one.
- RSC pages use `requireAuth()` or `requireRole()`; server actions authenticate
  with `payload.auth(...)`; user-triggered Local API calls pass the caller.
- Reserve `overrideAccess: true` for reviewed system-internal work. Keep guards
  needing original request data before field-level access can remove it.
- Preserve password-change session invalidation and one-time bootstrap-token
  behavior.
- `packages/ui` owns primitives. CMS UI paths are compatibility re-exports;
  application composites remain outside `src/components/ui/`.
- CMS preview, editor, and public output share the rendering contract. Do not
  introduce a second block renderer or iframe DOM/geometry synchronization.
- Rich text remains structured `RtRoot` JSONB, never stored HTML or an opaque
  string.
- After Payload schema changes, run the owning generators, inspect their output,
  create a committed migration, and test it against disposable PostgreSQL.
  Never substitute ad hoc production SQL or fabricate migration state.

## Implementation and tools

- Make the smallest coherent change; do not create a framework for one case or
  another source of truth.
- One agent normally owns investigation through handoff. Use additional agents
  only for bounded read-only research or genuinely independent review.
- MCPs are repository tools. Inventory availability before relying on them,
  use read-only operations first, and keep credentials in user scope. Follow
  `docs/tooling.md`.
- Never print secrets or commit real environment values. Production/provider
  writes and destructive operations require explicit approval.
- Do not hand-edit generated artifacts. Use the owning generator and review the
  resulting diff.

## Verification and handoff

- Run the narrowest check first, then the broader package and CI-equivalent
  checks justified by the changed surface.
- Stop expanding verification when the changed surface and triggered risk are
  proven. Documentation-only changes do not require application builds, image
  publication, or deployment; test-only changes do not require deployment
  unless they alter runtime packaging or release behavior.
- Wait for and report workflows required by the changed surface. Do not turn an
  unrelated workflow selected by broad CI triggers into extra implementation or
  production work.
- Treat production as current when it runs the latest deploy-relevant content.
  Documentation, instructions, and non-packaged tests may legitimately be ahead
  of the deployed image SHA.
- Never weaken tests, typing, access rules, constraints, visual-parity checks,
  legal-integrity checks, or release controls to make work pass.
- For a workspace package used by an image, verify the consuming image
  workflow's path filters.
- Review the final diff for scope, secrets, generated files, compatibility,
  release effects, canonical documentation, and unrelated changes.
- Report baseline and final SHA/dirty state, risk, changed files/commits, exact
  checks and results, skipped evidence, rollback notes, and operator follow-ups.
