import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises"
import { dirname, resolve, relative, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { sha256File } from "./image-artifact.mjs"
import { normalizeAudit } from "./dependency-security-policy.mjs"

const hash = (value) => createHash("sha256").update(value).digest("hex")
const maxOutput = 32 * 1024 * 1024
const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30000, maxBuffer: maxOutput }).trim()
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}

export async function dependencyIdentities(root) {
  const files = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean).sort()
  const graphFiles = files.filter((file) => file === "pnpm-lock.yaml" || file === "pnpm-workspace.yaml" || /(?:^|\/)package\.json$/.test(file))
  if (!graphFiles.includes("pnpm-lock.yaml") || !graphFiles.includes("package.json")) throw new Error("Complete frozen dependency inputs are missing")
  const configurationFiles = files.filter((file) => file !== "docs/dependency-security.json" &&
    (/^(?:apps|packages|scripts|infra|ops|\.github)\//.test(file) || file === ".nvmrc" ||
      [".dockerignore", ".gitignore", ".npmrc", "tsconfig.json", "docs/infrastructure-images.json", "docs/dependency-scanners.json", "docs/verification-matrix.json", "docs/workflow-path-matrix.json", "docs/environment-inventory.json"].includes(file)))
  const digest = async (names) => {
    const entries = []
    const actualRoot = await realpath(root)
    for (const file of names) {
      const target = await realpath(resolve(root, file))
      const location = relative(actualRoot, target).replaceAll("\\", "/")
      if (location === ".." || location.startsWith("../") || isAbsolute(location) || !files.includes(location)) throw new Error("Dependency input points outside tracked source")
      entries.push({ path: file, sha256: await sha256File(target) })
    }
    return { sha256: hash(JSON.stringify(entries)), files: entries }
  }
  return { graph: await digest(graphFiles), configuration: await digest(configurationFiles) }
}

function assertPublicGitHubMetadata(url) {
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) throw new Error("Publisher evidence must use a supported public primary API")
  const primaryRepos = new Set(["aquasecurity/trivy", "nodejs/node", "vitest-dev/vitest", "vitejs/vite", "vercel/next.js", "facebook/react", "payloadcms/payload", "withastro/astro", "mastra-ai/mastra", "nodemailer/nodemailer", "better-auth/better-auth", "pnpm/pnpm", "cloudflare/cloudflared", "postgres/postgres", "nginx/nginx"])
  const repository = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/(?:releases\/(?:latest|tags\/.+)|git\/ref\/tags\/.+)$/)?.[1]
  if (!/^\/advisories\/GHSA-[a-z0-9-]+$/.test(url.pathname) && !primaryRepos.has(repository)) throw new Error("Publisher evidence must use a supported public primary API, not account/repository operations")
}

/** Credential-free first; only confirmed quota exhaustion may use existing CLI auth. */
export async function readPublicPublisherJSON(url) {
  const parsed = new URL(url)
  if (parsed.hostname === "api.github.com") assertPublicGitHubMetadata(parsed)
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error",
    headers: { Accept: "application/json" } })
  if (parsed.hostname === "api.github.com" && response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    await response.body?.cancel()
    return JSON.parse(execFileSync("gh", ["api", parsed.href], { encoding: "utf8", timeout: 30000, maxBuffer: maxOutput }))
  }
  if (!response.ok) throw new Error("Primary publisher evidence unavailable: " + parsed.href + " HTTP " + response.status)
  const chunks = []; let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxOutput) throw new Error("Publisher evidence exceeds its completeness bound")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export async function fetchPublisherFact(descriptor, { readGitHubJSON } = {}) {
  const url = new URL(descriptor.url)
  if (url.protocol !== "https:" || !["api.github.com", "raw.githubusercontent.com", "registry.npmjs.org", "nodejs.org", "secdb.alpinelinux.org", "vuln.go.dev"].includes(url.hostname) || url.username || url.password || !descriptor.id) {
    throw new Error("Publisher fact must use a supported primary HTTPS source")
  }
  if (url.hostname === "api.github.com") assertPublicGitHubMetadata(url)
  const body = url.hostname === "api.github.com" && readGitHubJSON
    ? await readGitHubJSON(url.href) : await readPublicPublisherJSON(url.href)
  // Use selected publisher facts, not changing download counters or presentation.
  let facts = body
  if (descriptor.kind === "github-advisory") {
    if (body.ghsa_id !== url.pathname.split("/").at(-1) || !Number.isFinite(Date.parse(body.updated_at)) ||
        !["low", "medium", "high", "critical", "unknown"].includes(body.severity) || !Array.isArray(body.vulnerabilities) || !body.vulnerabilities.length) {
      throw new Error("Primary advisory evidence is incomplete: " + descriptor.id)
    }
    facts = { id: body.ghsa_id, updatedAt: body.updated_at, withdrawnAt: body.withdrawn_at, severity: body.severity, vulnerabilities: body.vulnerabilities, cwes: body.cwes }
  } else if (descriptor.kind === "github-release") {
    const requestedTag = url.pathname.includes("/releases/tags/") ? decodeURIComponent(url.pathname.split("/releases/tags/")[1]) : null
    if ((requestedTag && body.tag_name !== requestedTag) || !body.tag_name || !Number.isFinite(Date.parse(body.published_at)) || body.draft !== false || body.prerelease !== false) throw new Error("Publisher release is missing or unpublished")
    const eligibleForSelection = Date.now() - Date.parse(body.published_at) >= 1440 * 60000
    if (descriptor.selected && !eligibleForSelection) throw new Error("Selected publisher release has not met the release-age floor")
    facts = { tag: body.tag_name, publishedAt: body.published_at, draft: body.draft, prerelease: body.prerelease, eligibleForSelection, body: body.body }
  } else if (descriptor.kind === "npm-version") {
    const requested = decodeURIComponent(url.pathname).match(/^\/((?:@[^/]+\/)?[^/]+)\/([^/]+)$/)
    if (!requested || body.name !== requested[1] || (requested[2] !== "latest" && body.version !== requested[2]) ||
        !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(body.version ?? "") || !body.dist?.integrity) {
      throw new Error("Published package identity is missing")
    }
    facts = { name: body.name, version: body.version, engines: body.engines, peers: body.peerDependencies, dependencies: body.dependencies, integrity: body.dist.integrity }
  } else if (descriptor.kind !== "json" || !body || typeof body !== "object" || !Object.keys(body).length) {
    throw new Error("Unsupported or incomplete publisher evidence")
  }
  return { id: descriptor.id, url: descriptor.url, sha256: hash(JSON.stringify(canonical(facts))), facts }
}

export async function collectSourceEvidence(root, descriptors, constraints = []) {
  root = resolve(root)
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
  const node = (await readFile(resolve(root, ".nvmrc"), "utf8")).trim()
  const pnpm = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8", timeout: 10000 }).trim()
  if (process.versions.node !== node || !process.release.lts || manifest.packageManager !== "pnpm@" + pnpm) throw new Error("Dependency evidence requires the exact approved Node LTS and pnpm")
  if (!Array.isArray(descriptors) || !descriptors.length || descriptors.length > 256) throw new Error("Publisher evidence inventory is missing or exceeds its bound")
  const before = await dependencyIdentities(root)
  const audits = {}
  for (const scope of ["full", "production"]) {
    const args = ["audit", ...(scope === "production" ? ["--prod"] : []), "--json", "--registry=https://registry.npmjs.org"]
    const result = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: maxOutput })
    if (result.error || ![0, 1].includes(result.status)) throw new Error("Dependency audit unavailable or incomplete: " + scope)
    audits[scope] = JSON.parse(result.stdout); normalizeAudit(audits[scope], scope)
  }
  const facts = []
  const factsStartedAt = Date.now()
  let factBytes = 0
  for (const descriptor of descriptors) {
    if (Date.now() - factsStartedAt > 5 * 60000) throw new Error("Publisher collection exceeded its completeness time bound")
    const fact = await fetchPublisherFact(descriptor)
    factBytes += Buffer.byteLength(JSON.stringify(fact))
    if (factBytes > 64 * 1024 * 1024) throw new Error("Publisher evidence exceeded its total completeness bound")
    facts.push(fact)
  }
  const lock = await readFile(resolve(root, "pnpm-lock.yaml"), "utf8")
  const publisherVersions = []
  for (const entry of constraints) {
    if (!/^(?:@[\w.-]+\/)?[\w.-]+$/.test(entry.package ?? "") || !/^(?:[\w.-]+\/)*package\.json$/.test(entry.manifest ?? "") || entry.manifest.split("/").includes("..")) throw new Error("Publisher manifest identity is malformed")
    const manifest = JSON.parse(await readFile(resolve(root, entry.manifest), "utf8"))
    const escaped = entry.package.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const versions = [...lock.matchAll(new RegExp(String.raw`^  ['"]?${escaped}@([^\s:'"(]+)`, "gm"))].map((match) => match[1])
    publisherVersions.push({ package: entry.package, manifest: entry.manifest,
      specifier: manifest.dependencies?.[entry.package] ?? manifest.devDependencies?.[entry.package], lockedVersions: [...new Set(versions)].sort() })
  }
  const after = await dependencyIdentities(root)
  if (before.graph.sha256 !== after.graph.sha256 || before.configuration.sha256 !== after.configuration.sha256) throw new Error("Dependency inputs changed during collection")
  return { schemaVersion: 2, collectedAt: new Date().toISOString(), sourceSHA: git(root, ["rev-parse", "HEAD"]),
    sourceDirty: Boolean(git(root, ["status", "--porcelain"])), graphHash: after.graph.sha256, configurationHash: after.configuration.sha256,
    inputs: after, toolchain: { node, nodeLts: process.release.lts, pnpm },
    auditRegistry: "https://registry.npmjs.org",
    verificationRunId: process.env.GITHUB_RUN_ID ?? null, verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    audits, facts, publisherVersions }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error("Usage: node scripts/collect-dependency-evidence.mjs [output.json]")
  const root = fileURLToPath(new URL("..", import.meta.url))
  const record = JSON.parse(await readFile(resolve(root, "docs/dependency-security.json"), "utf8"))
  const evidence = await collectSourceEvidence(root, record.publisherFacts, record.publisherConstraints)
  const output = resolve(process.argv[2] ?? resolve(root, "artifacts/dependency-source.json"))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n")
  console.log("Current full/production and primary publisher evidence collected for " + evidence.sourceSHA + (evidence.sourceDirty ? " (dirty; not release evidence)" : ""))
}
