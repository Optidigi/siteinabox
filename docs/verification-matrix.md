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
  structure.

Hosted workflow YAML remains responsible for setup and service lifecycle. The
matrix is the command inventory, not permission to make provider writes or use
production credentials. The pinned pnpm used by the external visual-parity
checkout remains an intentional compatibility exception and is not part of the
repository toolchain check.
