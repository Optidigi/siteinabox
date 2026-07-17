# Repository tooling

This monorepo has one root toolchain and one repository MCP registry.

## MCP configuration

`mcp.registry.json` is the single human-authored canonical policy. It records
transport, pinned implementation, required environment-variable names,
server-enforced controls, client tool and approval policy, preconditions,
supported targets, and the fallback for an unavailable server. These generated
client projections are committed so supported tools work when the repository is
opened at its root:

- `.mcp.json` — basic JSON compatibility;
- `.mcp.toml` — generic TOML compatibility;
- `.codex/config.toml` — Codex project configuration;
- `.codex/mcp.toml` — compatibility for clients probing that filename;
- `.cursor/mcp.json` — Cursor project configuration.

Do not edit projections by hand or create app-local copies. The generator omits
a server from a target that cannot preserve its mandatory controls; it never
silently weakens policy to make a projection fit.

```bash
pnpm mcp:sync
pnpm mcp:check
```

The policy registry declares `shadcn`, `postgres`, `github`, `context7`,
`better-auth`, `cloudflare-api`, `docker`, `sequential-thinking`, and `posthog`.
A declaration proves policy, not startup, authentication, or effective runtime
permission. Inspect the generated target and the server's advertised tools
before relying on it.

`docker` remains a stable policy name but is disabled and omitted where a
client cannot express disabled state. No reviewed server combines an explicit
SIAB-container allowlist with a server-enforced inspection-only surface. Use
Docker or Podman CLI under the normal sandbox and approval policy instead.

## MCP use

- Inventory availability before relying on a server and use read-only
  operations first.
- Credentials, OAuth sessions, and personal paths remain in user scope.
- Cloudflare, PostHog, GitHub, database, container, and other external writes
  require explicit approval.
- Use the matching MCP when current material evidence lives in that system:
  Better Auth for authentication behavior, shadcn for primitive discovery,
  Context7 for versioned library documentation, GitHub for hosted repository
  state, PostgreSQL for approved database inspection, Cloudflare/PostHog for
  approved provider investigation, and Docker for container inspection.
- If a server is unavailable, use repository evidence, an established CLI, or
  official primary documentation and report the limitation.

Never install components, mutate providers, change database state, publish,
deploy, rotate, provision, or delete anything merely as an availability test.

### PostgreSQL MCP precondition

The `postgres` server is disabled until an owner creates a dedicated local or
staging role and supplies `SIAB_MCP_POSTGRES_URL` in user scope. The role must
not be the Payload application role: grant only database `CONNECT`, `USAGE` on
the intended schemas, and `SELECT` on the intended relations. It must have no
write, DDL, role-management, superuser, or `BYPASSRLS` capability, and
production must not be its default target.

After an owner supplies that role, harmless availability checks are limited to
`current_database()`, `current_user`,
`current_setting('transaction_read_only')`, bounded object search, and a small
`SELECT`. DB role access does not reproduce application tenant or access rules.

## Workspace tools

Node, pnpm, the workspace definition, dependency overrides, and the shared
lockfile are root-owned. Package manifests own only package-specific scripts,
dependencies, exports, and runtime engine constraints. Use root scripts for
cross-workspace checks and package scripts for focused checks.
