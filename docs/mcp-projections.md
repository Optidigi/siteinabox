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
| `opencode.jsonc` | OpenCode V2 server and permission projection | Add; provider-only, read-only-first. |
| `.mcp.json` | Generic MCP client compatibility projection | Retain; owner-confirmed generic-agent compatibility. |
| `.mcp.toml` | Generic MCP TOML compatibility projection | Retain; owner-confirmed generic-agent compatibility. |
| `.mcp/dbhub-postgres.toml` | DBHub PostgreSQL projection | Retain; disabled/read-only guardrails are security-relevant. |

The compatibility projections are not removable based on an empty in-workspace
import search. Removal requires owner confirmation for each client, a migration
window for users of the filename, and a generated-projection parity check.

## OpenCode projection

`opencode.jsonc` is generated in the OpenCode V2 shape: servers live under
`mcp.servers`, not directly under `mcp`. It currently projects only the three
provider servers used for approved cross-system verification:
`cloudflare-api`, `openprovider`, and `posthog`. Local stdio servers and
Docker/PostgreSQL are intentionally absent; add one only after its approval,
secret-forwarding, and disabled semantics are represented here.

- `cloudflare-api` uses OAuth with requested scopes `user:read account:read`.
  Reauthorize with additional optional scopes only for an approved
  investigation.
- `openprovider` uses OAuth with the server-enforced `mcp:read` scope. The
  registry's `OPENPROVIDER_MCP_AUTHORIZATION` header remains for Codex and
  Cursor; OpenCode does not receive that key.
- `posthog` uses OAuth and sends `x-posthog-read-only: true`, which PostHog
  applies server-side. OpenCode also asks before every PostHog tool call.
- The generator emits a broad `deny` for `openprovider_*` followed by `ask`
  rules for the reviewed read-only tool allowlist, preserving the registry's
  separate approval requirement. New or unreviewed tools stay
  denied. Compare the allowlist with the provider's live `tools/list` catalog
  whenever the provider changes.
- Prompt-mode servers without an allowlist, currently Cloudflare and PostHog,
  receive a broad `ask` permission rule. OpenCode's base policy allows by default, so
  the generated rule is the client-side approval boundary.
- `defaultEnabled: false` becomes `disabled: true`. Secret headers become
  `{env:NAME}` references. OAuth is disabled only for a header-authenticated
  target; `clientPolicy.opencode.auth` can select OAuth for OpenCode while other
  clients keep their header.

The Openprovider OAuth scope is the server-side boundary; the OpenCode deny
list is defense in depth. Do not treat the client deny list as a substitute for
the provider's scope or tenant policy.

Sessions opened at the repository root load `opencode.jsonc`. A T3/OpenCode
session whose working directory is outside the repository must receive the same
`mcp.servers` and `permissions` through the user-scope
`~/.config/opencode/opencode.jsonc`. That file is not committed. Keep OAuth
sessions in OpenCode's credential store and never copy provider tokens into
`opencode.jsonc`.

## Policies protected by the current check

The executable check currently proves:

| Policy | Required behavior |
| --- | --- |
| Registry validation | Unknown fields and credential-bearing URLs fail closed. |
| Secret handling | Embedded credentials and transport-incompatible fields fail validation; HTTP secret headers do not become stdio environment forwarding. |
| Executable safety | Dynamic executable versions fail validation. |
| Target enforcement | A target that cannot preserve mandatory policy fails closed, and declared server enforcement must be represented in transport. |
| Client projection | Codex receives policy fields; Cursor receives enabled servers and permissions; OpenCode receives V2 `mcp.servers` plus ordered permission rules. |
| OpenCode read-only policy | Openprovider is deny-by-default and asks for its complete reviewed read-only allowlist; Cloudflare and PostHog ask before tool calls; PostHog retains its server-side read-only header. |
| OpenCode authentication isolation | OpenCode-specific OAuth overrides do not alter Codex/Cursor header projections; secret headers never become literal values. |
| GitHub least privilege | GitHub projections retain the official server-side least-privilege policy. |
| Database safety | PostgreSQL remains disabled with generated DBHub guardrails. |
| Docker safety | Unsafe Docker integration remains disabled and Codex-only. |
| Determinism | Generated projections match the canonical registry. |

These controls are intentional complexity. They should not be weakened to make
the generated files smaller or more uniform.

## Verification evidence

The audit command was run on 2026-10-22:

```text
pnpm mcp:check
```

Result: 16 registry/projection tests passed and `MCP registry is valid and
projections are current.`

The owning implementation is `scripts/sync-mcp-config.mjs`; its tests are
`scripts/sync-mcp-config.test.mjs`. Generated files remain reviewable output,
not independent policy authorities.

## Filename compatibility evidence

The owner confirms that all ten registry servers are actively used by the
supported agent setup and that Codex and Cursor compatibility must remain.
The OpenCode projection is additive and provider-only; it does not remove any
compatibility filename. The individual generated filenames remain supported
aliases; no projection is removable solely because its exact client-level
consumer is not observable in the repository.

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
