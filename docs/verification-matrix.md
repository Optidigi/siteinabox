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
- The CI profile includes landing `astro check`, fresh advisory disposition,
  a fail-closed CMS prerequisite read, and each actual packaged-image build/smoke.
  Full verification uses Linux with real BIND, isolated PostgreSQL 18, Chromium,
  and Docker. See [local verification setup](runbooks/local-development.md#complete-isolated-verification).
- pnpm check:toolchain validates the root Node/pnpm authority, repeated
  Docker/workflow declarations, local-development documentation, and matrix
  structure.

Hosted workflow YAML remains responsible for setup and service lifecycle. The
matrix is the command inventory, not permission to make external provider
writes or use production credentials. External review checkouts are outside the
repository toolchain and are not part of this matrix.

`required-ci` always runs after every canonical job and succeeds only when all
dependency results are `success`; skipped, cancelled and missing jobs fail it.
Matrix validation checks its dependency list and all three packaged-image
variants. Hosted branch controls bind this summary and the five stable app/job
contexts to GitHub Actions, as documented in
[protected delivery](runbooks/protected-delivery.md).
