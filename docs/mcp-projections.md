# MCP registry and client projections

`mcp.registry.json` is the only authored MCP policy source. The client files
listed below are generated projections and must not be hand-edited. Run
`pnpm mcp:sync` after a registry change and `pnpm mcp:check` before review.

## Current projections

| Projection | Target | Status |
| --- | --- | --- |
| `.codex/config.toml` | Codex configuration projection | Retain; owner-confirmed active Codex compatibility. |
| `.codex/mcp.toml` | Codex MCP compatibility projection | Retain; owner-confirmed filename compatibility. |
| `.cursor/mcp.json` | Cursor server projection | Retain. |
| `.cursor/permissions.json` | Cursor command permission projection | Retain; security-relevant. |
| `.mcp.json` | Generic MCP client compatibility projection | Retain; owner-confirmed generic-agent compatibility. |
| `.mcp.toml` | Generic MCP TOML compatibility projection | Retain; owner-confirmed generic-agent compatibility. |
| `.mcp/dbhub-postgres.toml` | DBHub PostgreSQL projection | Retain; disabled/read-only guardrails are security-relevant. |

The compatibility projections are not removable based on an empty in-workspace
import search. Removal requires owner confirmation for each client, a migration
window for users of the filename, and a generated-projection parity check.

## Policies protected by the current check

The executable check currently proves:

| Policy | Required behavior |
| --- | --- |
| Registry validation | Unknown fields and credential-bearing URLs fail closed. |
| Secret handling | Embedded credentials and transport-incompatible fields fail validation; HTTP secret headers do not become stdio environment forwarding. |
| Executable safety | Dynamic executable versions fail validation. |
| Target enforcement | A target that cannot preserve mandatory policy fails closed, and declared server enforcement must be represented in transport. |
| Client projection | Codex receives policy fields; Cursor receives enabled servers and permissions. |
| GitHub least privilege | GitHub projections retain the official server-side least-privilege policy. |
| Database safety | PostgreSQL remains disabled with generated DBHub guardrails. |
| Docker safety | Unsafe Docker integration remains disabled and Codex-only. |
| Determinism | Generated projections match the canonical registry. |

These controls are intentional complexity. They should not be weakened to make
the generated files smaller or more uniform.

## Verification evidence

The audit command was run on 2026-08-11:

```text
pnpm mcp:check
```

Result: 11 registry/projection tests passed and `MCP registry is valid and
projections are current.`

The owning implementation is `scripts/sync-mcp-config.mjs`; its tests are
`scripts/sync-mcp-config.test.mjs`. Generated files remain reviewable output,
not independent policy authorities.

## Filename compatibility evidence

The owner confirms that all ten registry servers are actively used by the
supported agent setup and that Codex and Cursor compatibility must remain.
The individual generated filenames remain supported aliases; no projection is
removable solely because its exact client-level consumer is not observable in
the repository.

The following questions cannot be answered safely from repository contents:

1. Which Codex projection filename is consumed by each supported Codex setup?
2. Which generic `.mcp` projection filenames are consumed by supported local
   tooling or external documentation?
3. Are any generated projections copied into managed developer environments?
4. What deprecation window would external users need before a compatibility
   filename could be removed?

Until those answers are recorded, retain all current projections and keep the
disabled-by-default, secret-detection, least-privilege, and command-restriction
checks unchanged.
