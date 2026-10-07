# Engineering workflow

Use the highest risk level triggered by a change; diff size does not lower risk.

## Evidence

| Label | Meaning |
| --- | --- |
| Observed fact | Direct evidence from source, configuration, logs, or an authoritative source |
| Confirmed defect | Reproduced wrong behavior or direct conflict with an invariant |
| Risk | Credible failure or exposure not proven to have occurred |
| Intentional / accepted | Deliberately retained behavior or constraint |
| Unknown | Evidence is insufficient or inaccessible |
| Recommendation | Proposed future action |
| Historical / closed | No longer current |

Material findings include evidence, confidence, affected scope, and next action.

## Type safety

The required checks combine syntax-aware policy, owning compilers and typed
boundary rules. `pnpm type-safety:check` runs the negative coverage fixtures and
scans every tracked first-party TS/TSX/MTS/CTS, Astro, JS/MJS/CJS file plus owning
compiler/build configuration. Maintained TypeScript and Astro parsers distinguish
executable syntax from harmless strings and comments.

The syntax gate rejects explicit `any` (including unions, nested generics and
type defaults), `as any`, Zod `any()` including resolved aliases, `@ts-ignore`,
`@ts-nocheck`, double assertions, `as never`, `noCheck` and build-error bypasses.
Keep raw external values `unknown` until their consumed fields are validated;
use generated collection-aware types and actual library contracts at callers.

The required owning CI jobs also run the five TypeScript ESLint unsafe
assignment/call/member/argument/return rules with inline suppression disabled.
The executable [verification matrix](verification-matrix.json) records those
commands and their ordering after Payload generation or Astro check. Astro
frontmatter and template expressions use the maintained Astro parser; executable
client bodies use its processor with real project compiler programs. The actual
shared renderer bootstrap emitted through `set:html` has a separate exact-source
positive/negative compiler fixture. New executable strings require equivalent
coverage because checking a string's type does not check its contents.

Shipped JavaScript is deliberately strict `checkJs`/JSDoc source: the four
`packages/legal-content/src/*.js` modules and renderer's
`src/lib/analytics-config.js` and `src/lib/pathname.js`. The Astro client parser
MJS tooling has the same strict JavaScript compiler and typed lint coverage.
Other JS/MJS/CJS files are configuration, generation, operational or test harness
code; all receive syntax-policy scanning. Their existing command and harness
tests retain behavioral coverage; this policy does not claim strict JavaScript
compilation for those operational files. No directory-wide syntax escapes or
cosmetic format conversion are introduced. External script URLs and
JSON/importmap data blocks are inventoried separately from executable first-party
Astro source.

Generated files are inventoried by exact path: `apps/cms/src/payload-types.ts`,
`apps/cms/src/app/(payload)/admin/importMap.js` and `apps/cms/next-env.d.ts`.
They remain in the syntax scan and owning compiler/generator checks. Typed runtime
lint omits the generated Payload declaration file and declaration-only `.d.ts`
files; collection consumers still compile against those contracts. CMS compiler
coverage includes `scripts/**/*.ts`, proven by an isolated operational script
that compiles when valid and fails when its number value becomes a string.

`@ts-expect-error` requires one reviewed line naming the actual external typing
mismatch and why a typed alternative is infeasible. The current exception is
`apps/cms/tests/integration/_helpers.ts`, at the `migrations: postgresMigrations`
property: Payload 3.90.1's generic database adapter declares migration callbacks
with `unknown` arguments, while its Postgres adapter owns the concrete migration
and transaction arguments. The callbacks are checked against the actual Postgres
`prodMigrations` contract and passed unchanged; preserving adapter-owned
transactions is preferable to inventing a wrapper over erased arguments. This
exception does not exclude migrations or tests from checking. Review it when the
installed adapter contracts change.

## Risk

Provider validation, durable uncertainty and safe schema rollback are described
in [the provider boundary runbook](runbooks/provider-boundaries.md).

| Level | Typical triggers | Required handling |
| --- | --- | --- |
| Routine | Bounded, understood, reversible; no security, data, contract, release, legal/privacy, or compatibility concern | Implement directly, focused checks, self-review |
| Significant | Several modules, uncertain cause, contract/concurrency/generated surface, broad visual or compatibility effect | Short plan, isolated worktree when useful, focused and broader checks, fresh review across risk boundaries |
| High | Authentication/authorization, secrets, migrations/data integrity, destructive work, deployment/release, external writes, legal/privacy, uncertain compatibility removal | Plan with invariants, tests, rollback and approvals; isolated worktree; production-equivalent rehearsal where possible; independent review |

## Proportional verification and release

Verification follows the changed surface as well as its risk. Start narrow and
expand only when a wider check can catch a plausible regression introduced by
the diff.

| Change surface | Expected verification | Release handling |
| --- | --- | --- |
| Documentation or agent instructions only | Link/structure checks, diff check, self-review | No application build, image publication, or deployment |
| Tests only | The changed test and its owning package/job | No deployment unless runtime packaging or release behavior changed |
| One application runtime | Focused regression, owning package checks, production build | Build and deploy only the affected image when approved |
| Shared runtime contract, workspace dependency, lockfile, generator, or release workflow | Focused checks plus every demonstrated consumer/release path | Build affected consumers; rehearse the relevant release boundary |
| Authentication, authorization, data/schema, legal/privacy behavior, or production operation | Focused checks plus the High-risk evidence required above | Use explicit approval, rollback, and production-equivalent verification |

Practical stopping rules:

- Do not rerun the full repository merely because a narrow check passed; require
  a shared dependency, contract, generated artifact, or risk boundary that makes
  broader verification relevant.
- A broadly triggered hosted workflow may continue as repository policy, but it
  does not expand the implementation or deployment scope. Wait for the jobs
  required to support the handoff claim and report unrelated jobs separately.
- One well-instrumented production smoke is preferable to repeated probes. A
  failed probe is evidence about the system only after the harness itself is
  ruled out.
- Production is in sync when it runs the latest deploy-relevant content.
  Documentation, instructions, and non-packaged tests can be ahead of the image
  revision without requiring a no-op rebuild or redeploy.

## Flow

1. Record branch, exact SHA, and dirty state; protect unrelated work.
2. Read the applicable current sources and identify owners, callers, data flow,
   contracts, tests, and release path.
3. Reproduce the problem where feasible, classify it, and select risk.
4. Use one integration owner. Delegate independent work using the bounded
   contract below; the owner integrates changes and remains accountable.
5. Make the smallest coherent change. Avoid new sources of truth and do not
   remove compatibility behavior without consumer evidence.
6. Verify in expanding rings: focused regression, changed package/app, broader
   CI-equivalent checks, then release/migration/browser/visual/legal checks when
   applicable.
7. Review scope, secrets, generated files, compatibility, data/access rules,
   release effects, documentation, and rollback.
8. Hand off exact commands/results, commits/files, skipped evidence, unresolved
   assumptions, and operator actions.

Owner input is required for product/security/privacy policy, credentials,
destructive removal, production/provider writes, unresolved consumers, and
material release or rollback decisions. Do not weaken a control to make a
change pass.

## Delegation and handoff

One integration owner controls the active PR, resolves conflicts, and produces
the review packet. Start with at most three additional workers across the whole
tree and two delegation levels. The owner may reduce this budget for measured
capacity; increasing it requires recording the resource evidence and disjoint
ownership in the operational packet. Exactly one worker owns the shared
lockfile and one integrates generated configuration; migration ownership is
exclusive. Use separate worktrees when file ownership alone is insufficient.

Each parent supplies the child with the exact base/head, objective, owned files,
invariants, permission ceiling, resource/time bound, output location, and a
checkable completion criterion. Include pointers to root `AGENTS.md`, the
approved scope, nearest manifests/tests, applicable contracts, and any requested
skills with their reviewed revision. Children read these pointers explicitly;
conversation inheritance is not assumed. A child may delegate only an
independent subtask within the shared worker/depth budget and its own scope.

Configure descendant permissions no broader than the parent's and verify the
actual runtime ceiling before dispatch. File ownership is coordination, not
sandbox enforcement. Report unavailable isolation, cancellation, or quota
controls and use a narrower supported execution mode; written instructions do
not establish a hard security boundary. Production/provider writes and
administrative changes retain their separate approval requirements.

A handoff records exact SHAs, changed files, decisions with source pointers,
commands/results, unresolved findings, remaining checks, and transferred
ownership. Keep transient model selections, task identifiers, machine paths,
credentials, and raw transcripts in the private operational packet. Integration
is complete only when every changed and materially affected surface is accounted
for, required checks pass, and fresh separate Standards and Spec reviews have
their findings resolved or explicitly gated. Architect review remains separate;
the integration owner stops at the requested PR-review boundary.
