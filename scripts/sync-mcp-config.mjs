import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const registryPath = resolve(root, "mcp.registry.json")
const TARGETS = new Set(["codex", "cursor", "genericJson", "genericToml"])
const SERVER_FIELDS = new Set([
  "purpose", "transport", "command", "args", "url", "workingDirectory", "implementation", "requiredEnv", "staticEnv",
  "staticHeaders", "secretHeaders", "serverPolicy", "clientPolicy", "preconditions", "projectionTargets", "fallback",
  "runtimeConfig",
])
const IMPLEMENTATION_FIELDS = new Set(["kind", "identifier", "version", "digest", "reviewedAt", "unpinnedReason"])
const SERVER_POLICY_FIELDS = new Set(["readOnly", "toolsets", "toolAllowlist"])
const CLIENT_POLICY_FIELDS = new Set(["defaultEnabled", "approval", "enabledTools", "disabledTools"])
const CONTROL_FIELDS = new Set(["required", "values", "enforcement"])
const APPROVAL_MODES = new Set(["auto", "prompt", "writes", "approve"])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function rejectUnknownKeys(value, allowed, location) {
  for (const key of Object.keys(value)) {
    assert(allowed.has(key), `${location} contains unknown field ${key}`)
  }
}

function validateStringArray(value, location, allowDuplicates = false) {
  assert(Array.isArray(value) && value.every((entry) => typeof entry === "string"), `${location} must be a string array`)
  assert(allowDuplicates || new Set(value).size === value.length, `${location} must not contain duplicates`)
}

function validateControl(control, location, hasValues, requireEnforcement = true) {
  assert(control && typeof control === "object" && !Array.isArray(control), `${location} must be an object`)
  rejectUnknownKeys(control, CONTROL_FIELDS, location)
  assert(typeof control.required === "boolean", `${location}.required must be boolean`)
  if (hasValues) validateStringArray(control.values, `${location}.values`)
  else assert(!Object.hasOwn(control, "values"), `${location}.values is not supported`)
  if (control.enforcement != null) {
    assert(control.enforcement && typeof control.enforcement === "object", `${location}.enforcement must be null or an object`)
    rejectUnknownKeys(control.enforcement, new Set(["kind", "value"]), `${location}.enforcement`)
    assert(["argument", "environment", "header", "generatedConfig"].includes(control.enforcement.kind), `${location}.enforcement.kind is invalid`)
    assert(typeof control.enforcement.value === "string" && control.enforcement.value.length > 0, `${location}.enforcement.value is required`)
  }
  assert(!requireEnforcement || !control.required || control.enforcement, `${location} requires an enforcement mechanism`)
}

function validateNoCredentialUrls(value, location = "registry") {
  if (typeof value === "string") {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      const parsed = new URL(value)
      assert(!parsed.username && !parsed.password, `${location} contains a credential-bearing URL`)
    }
    return
  }
  if (Array.isArray(value)) return value.forEach((entry, index) => validateNoCredentialUrls(entry, `${location}[${index}]`))
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) validateNoCredentialUrls(entry, `${location}.${key}`)
  }
}

function targetSupports(server, target) {
  const policy = server.clientPolicy
  if (!policy.defaultEnabled && target !== "codex") return false
  if (policy.approval.required && target !== "codex") return false
  if ((policy.enabledTools.required || policy.disabledTools.required) && target !== "codex") return false
  if (server.requiredEnv.length > 0 && (target === "genericJson" || target === "genericToml")) return false
  if (server.workingDirectory && target !== "codex") return false
  if ((Object.keys(server.staticEnv).length > 0 || Object.keys(server.staticHeaders).length > 0 || Object.keys(server.secretHeaders).length > 0) && target === "genericToml") return false
  return true
}

function validateEnforcement(server, control, location) {
  if (!control.enforcement) return
  const { kind, value } = control.enforcement
  let enforcedValue = value
  if (kind === "argument") {
    assert(server.transport === "stdio" && server.args.includes(value), `${location} argument enforcement is missing from args`)
  } else if (kind === "environment") {
    assert(Object.hasOwn(server.staticEnv, value), `${location} environment enforcement is missing from staticEnv`)
    enforcedValue = server.staticEnv[value]
  } else {
    if (kind === "generatedConfig") {
      assert(server.runtimeConfig, `${location} generatedConfig enforcement requires runtimeConfig`)
      return
    }
    assert(Object.hasOwn(server.staticHeaders, value), `${location} header enforcement is missing from staticHeaders`)
    enforcedValue = server.staticHeaders[value]
  }
  for (const requiredValue of control.values ?? []) {
    assert(enforcedValue.split(",").some((entry) => entry.trim() === requiredValue), `${location} does not enforce value ${requiredValue}`)
  }
}

export function validateRegistry(registry) {
  assert(registry && typeof registry === "object" && !Array.isArray(registry), "registry must be an object")
  rejectUnknownKeys(registry, new Set(["schemaVersion", "servers"]), "registry")
  assert(registry.schemaVersion === 1, "registry.schemaVersion must be 1")
  assert(registry.servers && typeof registry.servers === "object" && !Array.isArray(registry.servers), "registry.servers must be an object")

  for (const [name, server] of Object.entries(registry.servers)) {
    const location = `servers.${name}`
    assert(/^[a-z0-9-]+$/.test(name), `${location} has an invalid stable name`)
    assert(server && typeof server === "object" && !Array.isArray(server), `${location} must be an object`)
    rejectUnknownKeys(server, SERVER_FIELDS, location)
    assert(typeof server.purpose === "string" && server.purpose.length > 0, `${location}.purpose is required`)
    assert(["stdio", "http"].includes(server.transport), `${location}.transport is invalid`)
    if (server.transport === "stdio") {
      assert(typeof server.command === "string" && server.command.length > 0, `${location}.command is required`)
      validateStringArray(server.args, `${location}.args`, true)
      assert(!Object.hasOwn(server, "url"), `${location}.url is invalid for stdio`)
    } else {
      assert(typeof server.url === "string" && server.url.startsWith("https://"), `${location}.url must use HTTPS`)
      assert(!Object.hasOwn(server, "command") && !Object.hasOwn(server, "args"), `${location} cannot mix HTTP and stdio fields`)
    }
    if (Object.hasOwn(server, "workingDirectory")) {
      assert(server.workingDirectory === "repositoryRoot", `${location}.workingDirectory must be repositoryRoot`)
    }

    rejectUnknownKeys(server.implementation, IMPLEMENTATION_FIELDS, `${location}.implementation`)
    assert(["npm", "container", "remote"].includes(server.implementation.kind), `${location}.implementation.kind is invalid`)
    assert(typeof server.implementation.identifier === "string" && server.implementation.identifier.length > 0, `${location}.implementation.identifier is required`)
    assert(typeof server.implementation.version === "string" && server.implementation.version.length > 0, `${location}.implementation.version is required`)
    assert(!["latest", "main", "master"].includes(server.implementation.version), `${location}.implementation.version must be pinned`)
    if (server.implementation.kind === "npm") {
      const pinned = `${server.implementation.identifier}@${server.implementation.version}`
      assert(server.args.includes(pinned), `${location}.args must invoke pinned implementation ${pinned}`)
    }
    if (server.implementation.kind === "container") {
      assert(!server.implementation.digest || /^sha256:[a-f0-9]{64}$/.test(server.implementation.digest), `${location}.implementation.digest is invalid`)
      const pinned = server.implementation.digest
        ? `${server.implementation.identifier}@${server.implementation.digest}`
        : `${server.implementation.identifier}:${server.implementation.version}`
      assert(server.args.includes(pinned), `${location}.args must invoke pinned implementation ${pinned}`)
    }
    if (server.implementation.kind === "remote") {
      assert(server.implementation.version === "provider-managed", `${location} remote version must be provider-managed`)
      assert(/^\d{4}-\d{2}-\d{2}$/.test(server.implementation.reviewedAt), `${location}.implementation.reviewedAt is required`)
      assert(typeof server.implementation.unpinnedReason === "string" && server.implementation.unpinnedReason.length > 0, `${location}.implementation.unpinnedReason is required`)
    }

    validateStringArray(server.requiredEnv, `${location}.requiredEnv`)
    for (const envName of server.requiredEnv) assert(/^[A-Z][A-Z0-9_]*$/.test(envName), `${location}.requiredEnv contains invalid name ${envName}`)
    for (const field of ["staticEnv", "staticHeaders", "secretHeaders"]) {
      assert(server[field] && typeof server[field] === "object" && !Array.isArray(server[field]), `${location}.${field} must be an object`)
      assert(Object.values(server[field]).every((value) => typeof value === "string"), `${location}.${field} values must be strings`)
    }
    for (const key of Object.keys(server.staticEnv)) {
      assert(!/(TOKEN|SECRET|PASSWORD|KEY|DSN|URL)/i.test(key), `${location}.staticEnv cannot contain credential-like field ${key}`)
    }
    for (const envName of Object.values(server.secretHeaders)) {
      assert(server.requiredEnv.includes(envName), `${location}.secretHeaders must reference a required environment name`)
    }

    rejectUnknownKeys(server.serverPolicy, SERVER_POLICY_FIELDS, `${location}.serverPolicy`)
    validateControl(server.serverPolicy.readOnly, `${location}.serverPolicy.readOnly`, false)
    validateControl(server.serverPolicy.toolsets, `${location}.serverPolicy.toolsets`, true)
    validateControl(server.serverPolicy.toolAllowlist, `${location}.serverPolicy.toolAllowlist`, true)
    validateEnforcement(server, server.serverPolicy.readOnly, `${location}.serverPolicy.readOnly`)
    validateEnforcement(server, server.serverPolicy.toolsets, `${location}.serverPolicy.toolsets`)
    validateEnforcement(server, server.serverPolicy.toolAllowlist, `${location}.serverPolicy.toolAllowlist`)
    rejectUnknownKeys(server.clientPolicy, CLIENT_POLICY_FIELDS, `${location}.clientPolicy`)
    assert(typeof server.clientPolicy.defaultEnabled === "boolean", `${location}.clientPolicy.defaultEnabled must be boolean`)
    rejectUnknownKeys(server.clientPolicy.approval, new Set(["required", "mode"]), `${location}.clientPolicy.approval`)
    assert(typeof server.clientPolicy.approval.required === "boolean", `${location}.clientPolicy.approval.required must be boolean`)
    assert(APPROVAL_MODES.has(server.clientPolicy.approval.mode), `${location}.clientPolicy.approval.mode is invalid`)
    validateControl(server.clientPolicy.enabledTools, `${location}.clientPolicy.enabledTools`, true, false)
    validateControl(server.clientPolicy.disabledTools, `${location}.clientPolicy.disabledTools`, true, false)

    validateStringArray(server.preconditions, `${location}.preconditions`)
    if (server.runtimeConfig) validateRuntimeConfig(server, location)
    validateStringArray(server.projectionTargets, `${location}.projectionTargets`)
    assert(server.projectionTargets.length > 0, `${location}.projectionTargets must not be empty`)
    for (const target of server.projectionTargets) {
      assert(TARGETS.has(target), `${location}.projectionTargets contains unknown target ${target}`)
      assert(targetSupports(server, target), `${location} cannot preserve mandatory policy in ${target}; omit that target`)
    }
    assert(typeof server.fallback === "string" && server.fallback.length > 0, `${location}.fallback is required`)
  }

  validateNoCredentialUrls(registry)
  return registry
}

function validateRuntimeConfig(server, location) {
  const config = server.runtimeConfig
  rejectUnknownKeys(config, new Set(["kind", "path", "source", "executeSql", "exposeSearchObjects"]), `${location}.runtimeConfig`)
  assert(config.kind === "dbhub", `${location}.runtimeConfig.kind must be dbhub`)
  assert(config.path === ".mcp/dbhub-postgres.toml", `${location}.runtimeConfig.path is invalid`)
  assert(server.args.includes(config.path), `${location}.args must reference runtimeConfig.path`)
  rejectUnknownKeys(config.source, new Set(["id", "dsnEnv", "connectionTimeoutSeconds", "queryTimeoutSeconds"]), `${location}.runtimeConfig.source`)
  assert(/^[a-z0-9-]+$/.test(config.source.id), `${location}.runtimeConfig.source.id is invalid`)
  assert(server.requiredEnv.includes(config.source.dsnEnv), `${location}.runtimeConfig.source.dsnEnv must be required`)
  assert(Number.isInteger(config.source.connectionTimeoutSeconds) && config.source.connectionTimeoutSeconds > 0, `${location} connection timeout must be positive`)
  assert(Number.isInteger(config.source.queryTimeoutSeconds) && config.source.queryTimeoutSeconds > 0, `${location} query timeout must be positive`)
  rejectUnknownKeys(config.executeSql, new Set(["readOnly", "maxRows"]), `${location}.runtimeConfig.executeSql`)
  assert(config.executeSql.readOnly === true, `${location}.runtimeConfig.executeSql.readOnly must be true`)
  assert(Number.isInteger(config.executeSql.maxRows) && config.executeSql.maxRows > 0, `${location}.runtimeConfig.executeSql.maxRows must be positive`)
  assert(config.exposeSearchObjects === true, `${location}.runtimeConfig.exposeSearchObjects must be true`)
}

const quote = (value) => JSON.stringify(value)
const tomlInlineTable = (value) => `{ ${Object.entries(value).map(([key, entry]) => `${quote(key)} = ${quote(entry)}`).join(", ")} }`

function baseJsonServer(server, target) {
  const projected = server.transport === "stdio"
    ? { command: server.command, args: server.args }
    : { type: "http", url: server.url }
  if (Object.keys(server.staticEnv).length > 0) projected.env = { ...server.staticEnv }
  if (server.requiredEnv.length > 0 && target === "cursor") {
    projected.env = { ...projected.env, ...Object.fromEntries(server.requiredEnv.map((name) => [name, `\${env:${name}}`])) }
  }
  const headers = { ...server.staticHeaders }
  if (target === "cursor") {
    for (const [header, envName] of Object.entries(server.secretHeaders)) headers[header] = `\${env:${envName}}`
  }
  if (Object.keys(headers).length > 0) projected.headers = headers
  return projected
}

function tomlServer(name, server, target) {
  const lines = [`[mcp_servers.${name}]`]
  if (server.transport === "stdio") {
    lines.push(`command = ${quote(server.command)}`)
    lines.push(`args = [${server.args.map(quote).join(", ")}]`)
  } else {
    lines.push(`url = ${quote(server.url)}`)
  }
  if (target === "codex") {
    lines.push(`enabled = ${server.clientPolicy.defaultEnabled}`)
    lines.push("required = false")
    lines.push(`default_tools_approval_mode = ${quote(server.clientPolicy.approval.mode)}`)
    if (server.requiredEnv.length > 0) lines.push(`env_vars = [${server.requiredEnv.map(quote).join(", ")}]`)
    if (server.clientPolicy.enabledTools.values.length > 0) lines.push(`enabled_tools = [${server.clientPolicy.enabledTools.values.map(quote).join(", ")}]`)
    if (server.clientPolicy.disabledTools.values.length > 0) lines.push(`disabled_tools = [${server.clientPolicy.disabledTools.values.map(quote).join(", ")}]`)
    if (Object.keys(server.staticEnv).length > 0) lines.push(`env = ${tomlInlineTable(server.staticEnv)}`)
    if (Object.keys(server.staticHeaders).length > 0) lines.push(`http_headers = ${tomlInlineTable(server.staticHeaders)}`)
    if (Object.keys(server.secretHeaders).length > 0) lines.push(`env_http_headers = ${tomlInlineTable(server.secretHeaders)}`)
    if (server.workingDirectory === "repositoryRoot") lines.push('cwd = ".."')
  }
  return `${lines.join("\n")}\n`
}

export function renderProjections(registry) {
  validateRegistry(registry)
  const entries = Object.entries(registry.servers).sort(([a], [b]) => a.localeCompare(b))
  const jsonFor = (target) => `${JSON.stringify({
    mcpServers: Object.fromEntries(entries
      .filter(([, server]) => server.projectionTargets.includes(target))
      .map(([name, server]) => [name, baseJsonServer(server, target)])),
  }, null, 2)}\n`
  const tomlFor = (target) => entries
    .filter(([, server]) => server.projectionTargets.includes(target))
    .map(([name, server]) => tomlServer(name, server, target))
    .join("\n")
  const postgres = registry.servers.postgres.runtimeConfig
  const dbhub = [
    "# Generated from mcp.registry.json. Do not edit.",
    "[[sources]]",
    `id = ${quote(postgres.source.id)}`,
    'description = "SIAB local or staging database through a dedicated read-only role"',
    `dsn = ${quote(`\${${postgres.source.dsnEnv}}`)}`,
    `connection_timeout = ${postgres.source.connectionTimeoutSeconds}`,
    `query_timeout = ${postgres.source.queryTimeoutSeconds}`,
    "",
    "[[tools]]",
    'name = "execute_sql"',
    `source = ${quote(postgres.source.id)}`,
    "readonly = true",
    `max_rows = ${postgres.executeSql.maxRows}`,
    "",
    "[[tools]]",
    'name = "search_objects"',
    `source = ${quote(postgres.source.id)}`,
    "",
  ].join("\n")

  return new Map([
    [resolve(root, ".mcp.json"), jsonFor("genericJson")],
    [resolve(root, ".mcp.toml"), tomlFor("genericToml")],
    [resolve(root, ".codex/config.toml"), tomlFor("codex")],
    [resolve(root, ".codex/mcp.toml"), tomlFor("codex")],
    [resolve(root, ".cursor/mcp.json"), jsonFor("cursor")],
    [resolve(root, postgres.path), dbhub],
  ])
}

export async function syncMcpConfig({ check = false } = {}) {
  const registry = JSON.parse(await readFile(registryPath, "utf8"))
  const projections = renderProjections(registry)
  const stale = []

  for (const [path, expected] of projections) {
    let actual
    try {
      actual = await readFile(path, "utf8")
    } catch {
      actual = undefined
    }
    if (actual === expected) continue
    if (check) stale.push(path.slice(root.length + 1))
    else await writeFile(path, expected, "utf8")
  }

  if (stale.length > 0) throw new Error(`MCP projections are stale: ${stale.join(", ")}. Run pnpm mcp:sync.`)
  return check ? "MCP registry is valid and projections are current." : "MCP registry validated and projections updated."
}

async function main() {
  const args = process.argv.slice(2)
  assert(args.every((arg) => arg === "--check") && args.length <= 1, "Usage: sync-mcp-config.mjs [--check]")
  console.log(await syncMcpConfig({ check: args.includes("--check") }))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
