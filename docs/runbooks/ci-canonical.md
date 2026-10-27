# Canonical CI execution

`docs/verification-matrix.json` owns commands, per-check settings, hosted contexts
and the four CMS test partitions. `ci.yml` owns their execution and isolated
services. `pnpm check:toolchain` verifies the two agree, including interpolated
matrix commands. Combining local profiles preserves their environment settings
and executes shared checks once. Installed main protection keeps its existing
six contexts; `required-ci` requires every internal job and image variant.

## Execution graph

- Quality, four test partitions, CMS browser, landing, renderer and image jobs
  start independently. `cms-quality` validates the complete test inventory and
  Payload configuration imports; these produce no shared artifact and do not
  gate unrelated work. All remain required by the final aggregate.
- `.github/actions/setup-ci` owns the exact Node/pnpm setup, frozen installation
  and exact-checkout Git trust. Native Node-only aggregators disable dependency
  installation; CMS containers opt into authoritative DNS prerequisites. The
  cache option supports controlled measurements; the default retains caching.
- `ciDependencies` in the verification matrix declares the actual intermediate
  dependencies. Policy rejects additional sequencing or missing dependencies.
- Four `cms-tests` jobs execute unit-1, unit-2, integration-1 and integration-2.
  Scheduling uses historical per-file execution times plus amortized setup
  costs, with deterministic longest-first allocation. `unit-1` reserves measured
  time for its additional checkout fixture. New files use a median estimate and
  remain included. Each job owns an independent PostgreSQL service, authorized database and worker
  storage. Files remain serial and isolated inside a partition. Real committed
  migrations still initialize integration files; no schema push, shared parallel
  database or globally disabled isolation is introduced.
- `cms-test` always checks the matrix result and complete current-run receipts.
  `required-ci` independently checks them again. Missing/duplicate/failed/skipped,
  stale, dirty or cross-run evidence fails. Vitest must execute every selected
  file and case; Node TAP counts must contain no skipped/todo/cancelled cases.
- `cms-browser`, landing and renderer retain their real browser journeys.
  The independent checkout Vite/browser fixture runs on `unit-1`, alongside the
  CMS journey rather than after it. Its failure fails that required matrix job.
  Build-to-journey reuse, database initialization and migration rehearsals stay
  sequential within their owning job; shared database/build output is never
  concurrently mutated.
- Every source receives actual CMS/renderer/site image builds and packaged
  startup/native/scanner checks. PostgreSQL rehearsals wait for a successful TCP
query against the actual target database; temporary entrypoint socket readiness
is insufficient. `image-security` surfaces image advisory failures
  as soon as the source/image inputs are ready. The final aggregate still verifies
  every job, source/run/attempt, raw report, native assessment and image identity.

## Shared workflow policy

`scripts/canonical-ci-workflow.mjs` owns the common trigger, all-image coverage,
conditional-step and archive rules. Image, path, renderer and aggregate checks
call it rather than repeating source fragments. A pinned development-only YAML
parser validates structure, duplicate keys and aliases; human labels, indentation
and key order are not policy. Negative tests retain skipped verification,
untrusted triggers, registry writes and unsafe archive conditions. Static checks
run in package quality; native receipt aggregation checks their required job
result and exact-source artifacts without installing the YAML parser.

## Browser runtime

Browser jobs use the official Playwright Noble image pinned by digest in
`docs/infrastructure-images.json`. The image version must match the installed
Playwright package, and the exact governed Node LTS is installed through the
pinned setup action. Real Chromium rendering and BIND availability are checked
before CMS verification. PostgreSQL uses its service hostname inside the job
container. A job-local Git entry trusts only the exact mounted checkout; no
wildcard ownership exception is permitted. No Playwright OS-package installation occurs on the hot path; CMS
still installs the smaller authoritative DNS tools. Root execution follows the
existing trusted-test Chromium model; this container is not for production or
untrusted web browsing.

## Caches and timing evidence

Caches accelerate inputs only. Every test and packaged smoke still executes.

- Existing pnpm caching remains.
- CMS browser builds restore only `.next/cache` compiler intermediates, not a
  completed build or its qualification receipt. The browser journey still reuses
  the same freshly qualified CMS build within its job.
- CMS partitions may restore V8 compile intermediates bound to the Node/lockfile
  and partition. Vitest file isolation remains enabled.
- Image builds use local OCI BuildKit layer caches, with an owned docker-container
  builder and pinned BuildKit image. No registry login/cache export is used.
  Cache directories cannot be symlinks; malformed indexes are cache misses.
  The owned builder and disposable resources are cleaned up after verification.
- Trivy tool/database caches do not skip current publisher eligibility, checksum,
  scanner version or advisory freshness checks. The scanner refreshes its database
  under the existing policy on every verification invocation.

Per-partition receipts record file/case counts and elapsed time. Image receipts
separate build, packaged smoke, archive/hash, application inventory and
infrastructure inventory. The aggregate retains these and renders a job summary.
Compare cold/warm end-to-end critical path and runner-seconds; do not infer savings
from cache presence alone. Existing advisory/native blockers remain blockers.

## Refresh scheduling estimates

Download all `cms-test-*` artifacts and the complete jobs API response from one
successful canonical run, then run:

```bash
node scripts/update-cms-test-timings.mjs ARTIFACT_DIRECTORY JOBS_API_JSON
```

The generator validates successful, clean, same-run receipts, complete current
file coverage and per-file report timings before updating
`apps/cms/tests/_helpers/timings.json`. Commit the reviewed estimates. They are
historical scheduling hints, not qualification evidence. Vitest reports omit
import/setup time; measured partition wall time supplies an amortized estimate.
Use fresh hosted results to check whether the estimate actually balances work.

## Controlled performance measurements

On the same unchanging non-main branch, dispatch canonical `ci.yml` sequentially
with `cache-mode=cold`, then `normal`, then `normal` again. The cold mode disables
pnpm, Next, V8, BuildKit and scanner cache restore/save while retaining every
qualification step and advisory refresh. It measures repository-managed cache
inputs, not a guaranteed uncached GitHub host or container registry. The first
normal run seeds caches; inspect its logs and the repeat's cache logs before
calling the repeat warm. Never dispatch these measurements on main: trusted main
runs retain promotion archives even though publication remains separate.

After completion, collect read-only run/job/receipt evidence:

```bash
node scripts/benchmark-ci.mjs COLD_RUN_ID NORMAL_RUN_ID REPEAT_RUN_ID
```

`artifacts/ci-performance/report.json` groups exact tested source, event and cache
mode; it rejects partial/failed, cross-run and repeated observations. It records
elapsed, summed job and queue time, plus descriptive nearest-rank p50/p95. Fewer
than 20 samples are explicitly insufficient for a stable p95. A cache mode alone
never proves a hit or steady-state savings. This command collects existing runs;
it neither dispatches workflows nor supplies publication clearance.

## One promotion producer and a separate release decision

Canonical CI is the sole push-triggered main image and promotion-archive
producer. Scheduled/manual `dependency-security.yml` still uses the same verifier
to rebuild for fresh advisory inventories; it retains metadata only and is not
an eligible promotion source. PR runs retain JSON/raw scanner evidence. Only trusted main runs retain `image-cms`, `image-renderer` and
`image-site` TAR archives for seven days. Landing receives the existing public
analytics build token only on trusted main; synthetic-input archives remain
unpublishable. Removing the three duplicate archive producers does not publish
anything.

The separately approved manual publisher selects a complete successful canonical
main run. The selected archive and all supplemental image archives must come
from that same run/attempt and exact source; an unrelated later success or PR
merge-ref artifact cannot substitute. Fresh security clearance, owner approval,
archive hashes and the existing 90-day publication receipt policy still apply.
No release, registry publication, deployment or provider operation follows from
CI success alone.

## Local diagnostics

After the normal owned-resource authorization in
[local development](local-development.md), run a partition from the repository
root with `node scripts/run-cms-tests.mjs unit-1` (or another governed partition).
Execute the four partitions serially when they share one local resource, then
`node scripts/check-cms-test-results.mjs`. Separate local parallel runs require
separately owned databases and storage. `pnpm --dir apps/cms test` remains the
full serial development command; no partition environment is set by default.
Local receipts are explicitly diagnostic and cannot enter hosted admission.

Use `pnpm check:affected --base FULL_SHA --plan` for focused local preflight.
Shared/unknown changes broaden coverage. Canonical CI continues to run every
required consumer; no change-path filtering silently removes authorization,
migration or packaged-image proof.
