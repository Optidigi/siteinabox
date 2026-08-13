# Documentation

This is the index for current human engineering guidance and durable evidence.
Documentation explains intent, policy, procedure, or an evidence record; it
does not override executable sources.

## Authority model

| Concern | Canonical source |
| --- | --- |
| Exact runtime and data behavior | Source, schemas, migrations, tests, and scripts |
| Dependencies and workspace topology | `package.json` files, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` |
| CI, image triggers, and container wiring | `.github/workflows/`, Dockerfiles, and Compose files |
| MCP policy | `mcp.registry.json`; client files are generated projections |
| Shared public product facts | `packages/contracts/src/product.ts` |
| Authored legal text | Immutable files in `packages/legal-content` |
| Published legal state and acceptance evidence | Payload legal collections and append-only records |
| Provider and production state | The provider system and approved operator evidence |
| Human guidance and durable records | This `docs/` tree |

When prose and executable evidence disagree, treat the difference as a finding
and follow the executable source until the source is intentionally changed.

## Current guidance

- [`architecture.md`](architecture.md) — application, package, data-flow, and
  ownership boundaries.
- [`engineering.md`](engineering.md) — evidence, risk, implementation,
  verification, review, and handoff rules.
- [`tooling.md`](tooling.md) — root toolchain and MCP policy usage.
- [`dependency-policy.md`](dependency-policy.md) — rationale for dependency
  alignment, overrides, and release-age policy.
- [`environment-contracts.md`](environment-contracts.md) — source-read
  environment contract and its checked JSON inventory.
- [`test-taxonomy.md`](test-taxonomy.md) — test boundary vocabulary and
  retention rules.

## Contracts and procedures

- [`contracts/`](contracts/) — analytics, authentication, canvas/editor,
  legal, rich text, route access, responsive layout, and UI boundaries.
- [`runbooks/`](runbooks/) — local development, deployment, commerce,
  migration, provider, analytics, legal-release, and origin-isolation
  procedures.
- [`compliance/`](compliance/) — retention and supplier/subprocessor registers.

## Evidence and machine-checked inventories

- [`findings.md`](findings.md) — unresolved defects, risks, accepted
  constraints, and unknowns.
- [`mcp-projections.md`](mcp-projections.md) — generated MCP projection
  inventory and compatibility evidence.
- [`public-export-inventory.md`](public-export-inventory.md) — package export
  reachability and compatibility evidence.
- [`siab-014-schema-residue-audit.md`](siab-014-schema-residue-audit.md) —
  deferred high-risk schema residue audit.
- [`test-durability.md`](test-durability.md) — retained-test and replacement
  evidence; it complements the taxonomy rather than replacing it.
- [`verification-matrix.md`](verification-matrix.md) and
  [`verification-matrix.json`](verification-matrix.json) — checked command
  inventory and profiles.
- [`workflow-path-matrix.md`](workflow-path-matrix.md) and
  [`workflow-path-matrix.json`](workflow-path-matrix.json) — checked image
  workflow trigger coverage.
- [`environment-inventory.json`](environment-inventory.json) — machine-owned
  source-read inventory consumed by `pnpm environment:check`.
- [`contracts/rich-text-fixtures.json`](contracts/rich-text-fixtures.json) —
  renderer test input consumed by the site-renderer contract test.

Historical reports and completed implementation diaries belong in Git history,
not beside current guidance. Runtime content, including public summaries and
versioned legal documents, remains beside the code or package that consumes it.
