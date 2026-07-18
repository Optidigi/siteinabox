import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { renderProjections, validateRegistry } from "./sync-mcp-config.mjs"

const canonical = JSON.parse(await readFile(new URL("../mcp.registry.json", import.meta.url), "utf8"))
const clone = () => structuredClone(canonical)

test("canonical registry validates and renders deterministically", () => {
  const first = [...renderProjections(clone()).values()]
  const second = [...renderProjections(clone()).values()]
  assert.deepEqual(first, second)
})

test("unknown fields and credential-bearing URLs fail validation", () => {
  const unknown = clone()
  unknown.servers.context7.surprise = true
  assert.throws(() => validateRegistry(unknown), /unknown field surprise/)

  const credential = clone()
  credential.servers["better-auth"].url = "https://user:secret@example.com/mcp"
  assert.throws(() => validateRegistry(credential), /credential-bearing URL/)

  const assignedCredentialUrl = clone()
  assignedCredentialUrl.servers.context7.args.push("--dsn=postgres://user:secret@example.test/database")
  assert.throws(() => validateRegistry(assignedCredentialUrl), /credential-bearing URL/)
})

test("embedded credentials and transport-incompatible fields fail validation", () => {
  const argumentSecret = clone()
  argumentSecret.servers.context7.args.push("--token=github_pat_not-a-real-token")
  assert.throws(() => validateRegistry(argumentSecret), /embedded credential-like value/)

  const accessKeyStaticValue = clone()
  accessKeyStaticValue.servers.context7.staticEnv.NOTE = "AKIAIOSFODNN7EXAMPLE"
  assert.throws(() => validateRegistry(accessKeyStaticValue), /embedded credential-like value/)

  const legitimateStaticValue = clone()
  legitimateStaticValue.servers.context7.staticEnv.NOTE = "release-channel-version-2026"
  legitimateStaticValue.servers.context7.projectionTargets = ["codex"]
  assert.doesNotThrow(() => validateRegistry(legitimateStaticValue))

  const staticAuthorization = clone()
  staticAuthorization.servers["better-auth"].staticHeaders.Authorization = "public-value"
  assert.throws(() => validateRegistry(staticAuthorization), /credential-like field Authorization/)

  const stdioHeader = clone()
  stdioHeader.servers.context7.staticHeaders["X-Public-Metadata"] = "documentation"
  assert.throws(() => validateRegistry(stdioHeader), /stdio transport cannot define HTTP headers/)

  const httpEnvironment = clone()
  httpEnvironment.servers["better-auth"].staticEnv.MODE = "read-only"
  assert.throws(() => validateRegistry(httpEnvironment), /HTTP transport cannot define process environment/)
})

test("dynamic executable versions fail validation", () => {
  const registry = clone()
  registry.servers.context7.implementation.version = "latest"
  registry.servers.context7.args[1] = "@upstash/context7-mcp@latest"
  assert.throws(() => validateRegistry(registry), /must be pinned/)
})

test("a target that cannot preserve mandatory policy fails closed", () => {
  const registry = clone()
  registry.servers.shadcn.projectionTargets.push("cursor")
  assert.throws(() => validateRegistry(registry), /cannot preserve mandatory policy in cursor/)
})

test("declared server enforcement must be present in the transport", () => {
  const registry = clone()
  registry.servers.context7.serverPolicy.readOnly = {
    required: true,
    enforcement: { kind: "argument", value: "--read-only" },
  }
  assert.throws(() => validateRegistry(registry), /argument enforcement is missing from args/)
})

test("Codex receives policy fields while basic clients omit unsafe servers", () => {
  const projections = renderProjections(clone())
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const cursor = projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/mcp.json")))
  assert.match(codex, /\[mcp_servers\.cloudflare-api\][\s\S]*enabled = false[\s\S]*default_tools_approval_mode = "prompt"/)
  assert.match(codex, /env_vars = \["SIAB_MCP_POSTGRES_URL"\]/)
  const cursorServers = Object.keys(JSON.parse(cursor).mcpServers)
  for (const omitted of ["cloudflare-api", "docker", "postgres", "posthog", "shadcn"]) {
    assert(!cursorServers.includes(omitted), `${omitted} must be omitted from Cursor`)
  }
})

test("GitHub projections retain official server-side least privilege", () => {
  const projections = renderProjections(clone())
  for (const content of projections.values()) {
    if (!content.includes("github-mcp-server")) continue
    assert.match(content, /ghcr\.io\/github\/github-mcp-server@sha256:2b0c48b070f61e9d3969269ead600f62d00fb237b60ac849ef3d166ee7de9ad3/)
    assert.match(content, /GITHUB_READ_ONLY/)
    assert.match(content, /repos,issues,pull_requests,actions/)
    assert.doesNotMatch(content, /@modelcontextprotocol\/server-github/)
  }
})

test("PostgreSQL stays disabled with generated DBHub guardrails", () => {
  const projections = renderProjections(clone())
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const dbhub = projections.get([...projections.keys()].find((path) => path.endsWith(".mcp/dbhub-postgres.toml")))
  assert.match(codex, /@bytebase\/dbhub@0\.23\.0/)
  assert.match(codex, /\[mcp_servers\.postgres\][\s\S]*enabled = false/)
  assert.match(codex, /env_vars = \["SIAB_MCP_POSTGRES_URL"\]/)
  assert.match(codex, /cwd = "\."/)
  assert.match(dbhub, /dsn = "\$\{SIAB_MCP_POSTGRES_URL\}"/)
  assert.match(dbhub, /connection_timeout = 10/)
  assert.match(dbhub, /query_timeout = 15/)
  assert.match(dbhub, /readonly = true/)
  assert.match(dbhub, /max_rows = 100/)

  const unsafe = clone()
  unsafe.servers.postgres.runtimeConfig.executeSql.readOnly = false
  assert.throws(() => validateRegistry(unsafe), /does not enforce read-only SQL/)

  const bogusReadOnlyPath = clone()
  bogusReadOnlyPath.servers.postgres.serverPolicy.readOnly.enforcement.value = "anything.is.readonly"
  assert.throws(() => validateRegistry(bogusReadOnlyPath), /must be tools\.execute_sql\.readonly/)

  const mismatchedTools = clone()
  mismatchedTools.servers.postgres.serverPolicy.toolAllowlist.values = ["execute_sql"]
  assert.throws(() => validateRegistry(mismatchedTools), /does not match generated DBHub tools/)
})

test("unsafe Docker integration remains disabled and Codex-only", () => {
  const projections = renderProjections(clone())
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const cursor = JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/mcp.json"))))
  assert.match(codex, /\[mcp_servers\.docker\][\s\S]*enabled = false[\s\S]*default_tools_approval_mode = "prompt"/)
  assert(!Object.hasOwn(cursor.mcpServers, "docker"))
})
