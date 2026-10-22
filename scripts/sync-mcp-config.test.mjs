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

  const legitimateArgument = clone()
  legitimateArgument.servers.context7.args.push("--feature=mask-image")
  assert.doesNotThrow(() => validateRegistry(legitimateArgument))

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
  const dockerOnCursor = clone()
  dockerOnCursor.servers.docker.projectionTargets.push("cursor")
  assert.throws(() => validateRegistry(dockerOnCursor), /cannot preserve mandatory policy in cursor/)

  const postgresOnCursor = clone()
  postgresOnCursor.servers.postgres.projectionTargets.push("cursor")
  assert.throws(() => validateRegistry(postgresOnCursor), /cannot preserve mandatory policy in cursor/)

  const approvalOnGeneric = clone()
  approvalOnGeneric.servers.shadcn.projectionTargets.push("genericJson")
  assert.throws(() => validateRegistry(approvalOnGeneric), /cannot preserve mandatory policy in genericJson/)
})

test("declared server enforcement must be present in the transport", () => {
  const registry = clone()
  registry.servers.context7.serverPolicy.readOnly = {
    required: true,
    enforcement: { kind: "argument", value: "--read-only" },
  }
  assert.throws(() => validateRegistry(registry), /argument enforcement is missing from args/)
})

test("Codex receives policy fields while Cursor gets enabled servers and permissions", () => {
  const projections = renderProjections(clone())
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const cursor = JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/mcp.json"))))
  const permissions = JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/permissions.json"))))
  assert.match(codex, /\[mcp_servers\.cloudflare-api\][^[]*enabled = true[^[]*default_tools_approval_mode = "prompt"/)
  assert.match(codex, /\[mcp_servers\.posthog\][^[]*enabled = true[^[]*default_tools_approval_mode = "prompt"/)
  assert.match(codex, /env_vars = \["SIAB_MCP_POSTGRES_URL"\]/)

  for (const included of ["better-auth", "cloudflare-api", "context7", "github", "openprovider", "posthog", "sequential-thinking", "shadcn"]) {
    assert(Object.hasOwn(cursor.mcpServers, included), `${included} must be projected to Cursor`)
  }
  for (const omitted of ["docker", "postgres"]) {
    assert(!Object.hasOwn(cursor.mcpServers, omitted), `${omitted} must be omitted from Cursor`)
  }

  assert.deepEqual(permissions.mcpAllowlist, [
    "better-auth:*",
    "context7:*",
    "github:*",
    "sequential-thinking:*",
  ])
  for (const promptServer of ["cloudflare-api", "openprovider", "posthog", "shadcn"]) {
    assert(!permissions.mcpAllowlist.includes(`${promptServer}:*`), `${promptServer} must not be auto-allowlisted`)
  }
  assert.equal(permissions.autoRun.block_instructions.length, 4)
  assert.match(permissions.autoRun.block_instructions.join("\n"), /Cloudflare/)
  assert.match(permissions.autoRun.block_instructions.join("\n"), /Openprovider/)
  assert.match(permissions.autoRun.block_instructions.join("\n"), /PostHog/)
  assert.match(permissions.autoRun.block_instructions.join("\n"), /shadcn/)
})

test("HTTP secret headers do not generate stdio env forwarding", () => {
  const projections = renderProjections(clone())
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const cursor = JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/mcp.json"))))
  assert.match(codex, /\[mcp_servers\.openprovider\][^[]*env_http_headers = \{ "Authorization" = "OPENPROVIDER_MCP_AUTHORIZATION" \}/)
  assert.doesNotMatch(codex, /\[mcp_servers\.openprovider\][^[]*env_vars =/)
  assert.equal(cursor.mcpServers.openprovider.headers.Authorization, "${env:OPENPROVIDER_MCP_AUTHORIZATION}")
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

const openCodeConfig = (registry) => {
  const projections = renderProjections(registry)
  return JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith("opencode.jsonc"))))
}

test("OpenCode receives V2 provider servers with read-only controls", () => {
  const config = openCodeConfig(clone())
  assert.equal(config.$schema, "https://opencode.ai/config.json")
  assert.deepEqual(Object.keys(config.mcp.servers), ["cloudflare-api", "openprovider", "posthog"])
  assert.equal(config.mcp.servers["cloudflare-api"].type, "remote")
  assert.equal(config.mcp.servers["cloudflare-api"].oauth.scope, "user:read account:read")
  assert.equal(config.mcp.servers.openprovider.oauth.scope, "mcp:read")
  assert(!Object.hasOwn(config.mcp.servers.openprovider, "headers"))
  assert.equal(config.mcp.servers.posthog.headers["x-posthog-read-only"], "true")
  assert(!Object.hasOwn(config.mcp.servers.posthog, "oauth"))

  const cloudflareRule = config.permissions.find((rule) => rule.action === "cloudflare-api_*")
  const posthogRule = config.permissions.find((rule) => rule.action === "posthog_*")
  assert.equal(cloudflareRule.effect, "ask")
  assert.equal(posthogRule.effect, "ask")

  const denyIndex = config.permissions.findIndex((rule) => rule.action === "openprovider_*")
  const allowIndex = config.permissions.findIndex((rule) => rule.action === "openprovider_list_dns_zones")
  assert.equal(config.permissions[denyIndex].effect, "deny")
  assert.equal(config.permissions[allowIndex].effect, "allow")
  assert(allowIndex > denyIndex, "OpenCode allow rules must follow the broad Openprovider deny")
  for (const tool of ["list_dns_zones", "list_domains", "get_domain", "check_domain", "suggest_domain"]) {
    assert(config.permissions.some((rule) => rule.action === `openprovider_${tool}` && rule.effect === "allow"), `OpenCode must allow ${tool}`)
  }
  for (const tool of ["create_dns_zone", "update_domain", "delete_domain", "confirm_pending", "get_domain_authcode", "get_plesk_key", "dmarc_sso_login"]) {
    assert(!config.permissions.some((rule) => rule.action === `openprovider_${tool}` && rule.effect === "allow"), `OpenCode must not allow ${tool}`)
  }
  assert(!JSON.stringify(config).includes("OPENPROVIDER_MCP_AUTHORIZATION"))
})

test("OpenCode secret-header fallback retains user-scope token forwarding", () => {
  const registry = clone()
  delete registry.servers.openprovider.clientPolicy.opencode.auth
  const openprovider = openCodeConfig(registry).mcp.servers.openprovider
  assert.equal(openprovider.oauth, false)
  assert.equal(openprovider.headers.Authorization, "{env:OPENPROVIDER_MCP_AUTHORIZATION}")
  assert.equal(openprovider.oauth.scope, undefined)
})

test("OpenCode policy validation fails closed", () => {
  const invalidAuth = clone()
  invalidAuth.servers.openprovider.clientPolicy.opencode.auth.kind = "header"
  assert.throws(() => validateRegistry(invalidAuth), /auth\.kind is invalid/)

  const oauthOnStdio = clone()
  oauthOnStdio.servers.context7.projectionTargets.push("opencode")
  oauthOnStdio.servers.context7.clientPolicy.opencode = { auth: { kind: "oauth" } }
  assert.throws(() => validateRegistry(oauthOnStdio), /OAuth requires HTTP transport/)

  const policyWithoutTarget = clone()
  policyWithoutTarget.servers.openprovider.projectionTargets = ["codex", "cursor"]
  assert.throws(() => validateRegistry(policyWithoutTarget), /requires the opencode projection target/)

  const emptyAllowlist = clone()
  emptyAllowlist.servers.openprovider.clientPolicy.opencode.toolAllowlist.values = []
  assert.throws(() => validateRegistry(emptyAllowlist), /must not be empty when required/)

  const invalidToolName = clone()
  invalidToolName.servers.openprovider.clientPolicy.opencode.toolAllowlist.values.push("list dns zones")
  assert.throws(() => validateRegistry(invalidToolName), /not a stable tool name/)
})

test("PostHog read-only policy is server-enforced in every projection", () => {
  const registry = clone()
  assert.equal(registry.servers.posthog.serverPolicy.readOnly.required, true)
  const projections = renderProjections(registry)
  const codex = projections.get([...projections.keys()].find((path) => path.endsWith(".codex/config.toml")))
  const cursor = JSON.parse(projections.get([...projections.keys()].find((path) => path.endsWith(".cursor/mcp.json"))))
  const opencode = openCodeConfig(registry)
  assert.match(codex, /\[mcp_servers\.posthog\][\s\S]*http_headers = \{ "x-posthog-read-only" = "true" \}/)
  assert.equal(cursor.mcpServers.posthog.headers["x-posthog-read-only"], "true")
  assert.equal(opencode.mcp.servers.posthog.headers["x-posthog-read-only"], "true")
  assert(!Object.hasOwn(opencode.mcp.servers.posthog, "oauth"))
})
