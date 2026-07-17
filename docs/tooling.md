# Repository tooling

This monorepo has one root toolchain and one repository MCP registry.

## MCP configuration

`.mcp.json` is canonical. These client projections are committed so supported
tools work when the repository is opened at its root:

- `.mcp.toml` — generic TOML compatibility;
- `.codex/config.toml` — Codex project configuration;
- `.codex/mcp.toml` — compatibility for clients probing that filename;
- `.cursor/mcp.json` — Cursor project configuration.

Do not edit projections by hand or create app-local copies.

```bash
pnpm mcp:sync
pnpm mcp:check
```

The registry declares `shadcn`, `postgres`, `github`, `context7`,
`better-auth`, `cloudflare-api`, `docker`, `sequential-thinking`, and `posthog`.
A declaration proves configuration, not startup, authentication, or permission.

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

## Workspace tools

Node, pnpm, the workspace definition, dependency overrides, and the shared
lockfile are root-owned. Package manifests own only package-specific scripts,
dependencies, exports, and runtime engine constraints. Use root scripts for
cross-workspace checks and package scripts for focused checks.
