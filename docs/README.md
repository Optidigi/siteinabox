# Documentation

All human engineering documentation for this monorepo lives here. Manifests,
schemas, migrations, scripts, compose files, Dockerfiles, tests, and CI remain
canonical for executable facts.

## Current sources

- [`architecture.md`](architecture.md) — applications, packages, data flow, and
  operational ownership.
- [`engineering.md`](engineering.md) — evidence, risk, implementation, review,
  and handoff workflow.
- [`tooling.md`](tooling.md) — root toolchain and repository MCP configuration.
- [`findings.md`](findings.md) — active defects, risks, accepted constraints,
  and unresolved unknowns.
- [`contracts/`](contracts/) — durable cross-cutting CMS, rendering, UI,
  authentication, analytics, and legal contracts.
- [`runbooks/`](runbooks/) — current local-development and operator procedures.
- [`compliance/`](compliance/) — current retention and supplier registers.

Historical reports and completed implementation diaries are kept in Git
history, not alongside current guidance. Runtime content such as versioned legal
documents and landing-page Markdown remains beside the code that consumes it.
