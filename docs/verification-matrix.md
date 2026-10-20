# Verification matrix

The executable matrix is `verification-matrix.json`. It records each check's
command, owner, CI job, prerequisites, and risk. `pnpm check:toolchain` also
validates that every command still exists in the owning package manifest or
script file and that the declared CI job actually runs it; package manifests
and workflow YAML remain the executable authorities.

## Profiles

- pnpm check:fast runs repository contracts and shared package type checks. It
  does not require a database, browser, provider credential, or Docker service.
- pnpm check:ci runs the command sequence represented by the hosted CI jobs. It
  assumes the caller has already installed the documented prerequisites; it
  does not install operating-system packages, browsers, or PostgreSQL.
- pnpm check:toolchain validates the root Node/pnpm authority, repeated
  Docker/workflow declarations, local-development documentation, and matrix
  structure. It also rejects non-LTS execution and same-major patch drift;
  image builders and packaged Node smokes enforce the actual runtime contract.

Hosted workflow YAML remains responsible for setup and service lifecycle. The
matrix is the command inventory, not permission to make external provider
writes or use production credentials. External review checkouts are outside the
repository toolchain and are not part of this matrix.

## Required hosted evidence

Canonical `ci.yml` runs every command owner and all three packaged-image
variants on every PR, main push and manual run. The image matrix deliberately
has no path conditions: shared contracts, UI, renderer, governed legal content,
lockfiles, toolchain and workflow changes all receive consuming-image proof.
`workflow-path-matrix.json` additionally retains minimum consumer paths for the
standalone archive workflows. These workflows preserve the approved publication
path; their archives are separate from the CI matrix's small JSON evidence.

`required-ci` always runs after every canonical job, rejects every dependency
result except success, and verifies all three image records from this run and
attempt against the checked-out SHA. For PRs this is GitHub's tested merge SHA;
the record also identifies the PR head SHA. CI artifacts identify the workflow,
run, dependency results, image ID, archive hash and real packaged smoke. A local
image ID is not a published registry digest. Provider doubles, Local API tests,
real browser tests and packaged startup/host-routing checks retain their distinct
boundaries; see [test taxonomy](test-taxonomy.md).

`pnpm ci:policy:check` tests failure/missing/skipped dependencies, image-matrix
coverage, source/run/attempt mismatches and changed/unknown protection settings.
`pnpm check:ci` includes real Docker image verification and requires committed,
clean source as well as the M02 database/storage authorization and prerequisites.
The hosted aggregate itself consumes authentic `needs` and artifact evidence;
its policy fixtures are not substitutes for actual hosted results.

See [protected delivery](runbooks/protected-delivery.md) for proposal and live
control diagnostics. Source policy is not proof that settings are installed.

For Astro group upgrades, keep renderer host/origin/form/appointment tests, both
analytics browser commands and landing `test:ui` intact. The latter covers
responsive themes, keyboard/mobile interactions, accessibility, phone links and
contact behavior. Semantic build-output comparison excludes only explained
compiler output; it does not substitute for these browser checks or for the
unpublished consuming-image matrix. See [dependency compatibility](dependency-policy.md#astro-and-renderer-compatibility).

`pnpm infrastructure:check` binds the reviewed image/Action inventory to literal
consumer pins and persisted-volume identities. It is part of the fast profile
and package-quality job. CMS packaged verification additionally exercises offline
connector ingress (network disabled) and an owned-volume PostgreSQL 18.4-to-18.6
update/restart with committed migrations and populated fixture preservation.
Image records retain actual architecture/OS, database and ingress results; they
remain unpublished verification evidence, not production/provider proof.
