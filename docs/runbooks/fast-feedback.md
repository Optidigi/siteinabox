# Fast feedback

Keep one task record outside tracked source: outcome, scope, invariants, risk,
required checks, rollback, base/head, results/artifacts and next action. Keep tests
with their behavior and separate independent maintenance from feature work.

## Select checks before building

- `pnpm check:preflight` runs cheap repository and CMS frontend contracts, with
  no-CSS first. The generic `fast` profile does not include the CMS frontend gates.
- `pnpm check:affected --base FULL_SHA --plan` previews local profiles for changed
  owners, including working/untracked files. Omit `--plan` to execute. Shared or
  unknown paths select every local profile. This is preflight, not full testing.
- Add focused regressions and verification for the task's highest risk. The runner
  deduplicates combined profiles and records source/dirty state, commands, results
  and elapsed times in ignored `artifacts/verification.json`.

After an expensive failure, isolate its exact symptom at the smallest existing
unit, component, real-database or focused browser seam. Reuse successful evidence
only while its inputs and risk boundaries are unchanged. Qualify a coherent working
candidate instead of repeating the full journey after each diagnostic patch.
When splitting CI jobs, prove startup against a fresh owned resource; a warm local
database does not prove that the new lane initializes its own schema/prerequisites.

## Diagnose workspace/settings

Use the documented owned [test environment](local-development.md), then:

```bash
pnpm --dir apps/cms test:built-browser --reuse-built --scenario=workspace-settings
```

This uses the existing invitation-action build receipt, guarded fixture, genuine
logins, HTTPS tunnel, NL/EN desktop/phone saves, recovery and access tests. It skips
renderer build/start and unrelated journeys. Without `--reuse-built`, it creates
a new CMS build through the existing invitation seam.

Focused summaries record `qualification: diagnostic`, scenario, elapsed time,
original build identity and current driver source. Reuse permits edits only to the
three driver files named in `built-app-artifacts.mjs`; guard/runtime/toolchain,
environment, unknown untracked files and artifact bytes remain bound. The starting
receipt must be clean. Full/CI reuse stays strict. A diagnostic cannot supply full
browser, renderer, release or publication clearance.

## Review and context

High-risk work retains independent Standards and Spec reviews. Give reviewers a
fixed base/head, acceptance criteria, risk, relevant validation and prior findings.
Run the formal pair on a coherent candidate after relevant checks pass; use early
architecture review when needed. Follow-ups inspect the new delta, affected callers
and unresolved findings, carrying unchanged coverage forward. A new risk boundary
can warrant broader review; a commit alone does not. No round limit permits leaving
findings unresolved.

Keep tool output bounded: retrieve relevant excerpts and changed rows, retaining
details in artifacts. Delegate only a material independent question or review and
apply the user's model/effort settings in actual tool options. Use an owning PR
watcher and end the turn during waits. Handle stale notifications once against the
current head; a stale failure does not invalidate newer receipts or justify a rerun.

## Compare and admit evidence

```bash
pnpm dependency:compare before.json after.json
# Optional arguments: before-image-directory after-image-directory
pnpm ci:receipts DIRECTORY --head FULL_PR_SHA --run RUN_ID --attempt N
```

The comparison writes `artifacts/dependency-comparison.json` and prints counts of
changed inputs, advisories, publisher facts and optional raw-image/native evidence.
It is not approval, freshness or admission. Existing gates remain authoritative.

Download `ci-image-*`, `dependency-source-evidence` and `required-ci-evidence` from
the same canonical run into DIRECTORY. The inspector validates current inputs and
policy bytes, fresh source evidence, run/attempt, raw image hashes, reconstructed
findings and native assessments. It writes `artifacts/ci-evidence-inspection.json`.
Verify live GitHub checks, base/tree, reviews and delivery controls separately.
Neither tool refreshes expiry, clears blockers or authorizes publication.

Measure focused-failure latency, broad build/browser cycles, review rounds, CI
critical path, model input/output and escaped defects. Target one working-candidate
qualification and one final canonical CI cycle; failures or changed inputs can
require more. Preserve required checks and the separate release boundary.
