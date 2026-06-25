# .codex

Codex-specific project config lives here.

Behavioral instructions live in the repository root `AGENTS.md` and
`apps/cms/AGENTS.md`. Keep this directory for Codex config and MCP mirrors so
policy does not drift into runner config.

Files:

- `config.toml` - Codex-style project MCP server config.
- `mcp.toml` - MCP TOML mirror for tools that probe this filename.

Do not store API keys, tokens, or other secrets in this directory.
