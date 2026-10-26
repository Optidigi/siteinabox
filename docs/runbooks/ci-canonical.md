# Canonical CI execution

`docs/verification-matrix.json` owns commands, per-check settings, hosted contexts
and the four CMS test partitions. `ci.yml` owns their execution and isolated
services. `pnpm check:toolchain` verifies the two agree, including interpolated
matrix commands. Combining local profiles preserves their environment settings
and executes shared checks once. Installed main protection keeps its existing
six contexts; `required-ci` requires every internal job and image variant.

## Execution graph

- `cms-preflight` validates the matrix, complete test inventory and Payload
  configuration imports before expensive test/browser/image jobs start.
- `package-quality` and `cms-quality` retain their existing checks.
- Four `cms-tests` jobs execute unit-1, unit-2, integration-1 and integration-2.
  Each job owns an independent PostgreSQL service, authorized database and worker
  storage. Files remain serial and isolated inside a partition. Real committed
  migrations still initialize integration files; no schema push, shared parallel
  database or globally disabled isolation is introduced.
- `cms-test` always checks the matrix result and complete current-run receipts.
  `required-ci` independently checks them again. Missing/duplicate/failed/skipped,
  stale, dirty or cross-run evidence fails. Vitest must execute every selected
  file and case; Node TAP counts must contain no skipped/todo/cancelled cases.
- `cms-browser`, landing and renderer retain their real browser journeys.
- Every source receives actual CMS/renderer/site image builds and packaged
  startup/native/scanner checks. `image-security` surfaces image advisory failures
  as soon as the source/image inputs are ready. The final aggregate still verifies
  every job, source/run/attempt, raw report, native assessment and image identity.

## Browser runtime

Browser jobs use the official Playwright Noble image pinned by digest in
`docs/infrastructure-images.json`. The image version must match the installed
Playwright package, and the exact governed Node LTS is installed through the
pinned setup action. Real Chromium rendering and BIND availability are checked
before CMS verification. PostgreSQL uses its service hostname inside the job
container. No Playwright OS-package installation occurs on the hot path; CMS
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
