import { readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { RENDERER_PRODUCTION_HOSTS } = await import(
  `file://${resolve(repoRoot, "packages/contracts/src/deploy-targets.ts")}`
)
const rendererComposePath = resolve(repoRoot, "apps/renderer/compose.yml")
const rendererDockerfilePath = resolve(repoRoot, "apps/renderer/Dockerfile")
const rendererPackagePath = resolve(repoRoot, "apps/renderer/package.json")
const buildRendererWorkflowPath = resolve(repoRoot, ".github/workflows/build-renderer-image.yml")
const ciWorkflowPath = resolve(repoRoot, ".github/workflows/ci.yml")

const expectedHosts = [...RENDERER_PRODUCTION_HOSTS].sort()
const expectedHostSet = new Set(expectedHosts)

function formatPath(filePath) {
  return relative(repoRoot, filePath)
}

function extractTraefikHosts(text) {
  return [...text.matchAll(/Host\(`([^`]+)`\)/g)].map((match) => match[1]).sort()
}

async function listRepoFiles(dir, predicate, files = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".next" || entry.name === "dist" || entry.name === "node_modules") continue

    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      await listRepoFiles(path, predicate, files)
      continue
    }
    if (entry.isFile() && predicate(path)) files.push(path)
  }
  return files
}

function isComposePath(filePath) {
  return /(^|[/\\])(?:docker-)?compose(?:\.[^/\\]+)?\.ya?ml$/.test(filePath)
}

const errors = []

const rendererPackage = JSON.parse(await readFile(rendererPackagePath, "utf8"))
const buildRendererWorkflow = await readFile(buildRendererWorkflowPath, "utf8")
if (rendererPackage.dependencies?.["@siteinabox/legal-content"]?.startsWith("workspace:")) {
  const legalContentWorkflowPath = "packages/legal-content/**"
  const legalContentOnlyFixture = "packages/legal-content/src/documents/privacy.md"
  const workflowPaths = buildRendererWorkflow
    .split("\n")
    .map((line) => line.trim().match(/^- "([^"]+)"$/)?.[1])
    .filter(Boolean)
  const selectsLegalContentFixture = workflowPaths.some((pattern) =>
    pattern.endsWith("/**")
      ? legalContentOnlyFixture.startsWith(pattern.slice(0, -2))
      : legalContentOnlyFixture === pattern,
  )

  if (!workflowPaths.includes(legalContentWorkflowPath) || !selectsLegalContentFixture) {
    errors.push(
      `${formatPath(buildRendererWorkflowPath)} must select ${legalContentOnlyFixture} because ${formatPath(rendererPackagePath)} directly depends on @siteinabox/legal-content`,
    )
  }
}

const rendererCompose = await readFile(rendererComposePath, "utf8")
for (const requiredFragment of [
  "image: ghcr.io/optidigi/siteinabox-renderer@${SIAB_RENDERER_IMAGE_DIGEST:?required}",
  "docker.io/cloudflare/cloudflared:2026.7.0@sha256:5e49861633763e8933475477c20bae6039ed47f32c1d267a34babc347f28f0df",
  "SIAB_RENDERER_API_TOKEN_FILE: /run/secrets/renderer_api_token",
  "SIAB_RENDERER_ORIGIN_SECRET_FILE: /run/secrets/renderer_origin_secret",
  "file: ${SIAB_RENDERER_API_TOKEN_FILE:?required}",
  "file: ${SIAB_RENDERER_ORIGIN_SECRET_FILE:?required}",
  "file: ${CLOUDFLARE_TUNNEL_TOKEN_FILE:?required}",
  "/run/secrets/cloudflare_tunnel_token",
  "http://siteinabox-renderer:4321",
  'test: ["CMD", "cloudflared", "tunnel", "--metrics", "127.0.0.1:2000", "ready"]',
  "renderer-origin:",
]) {
  if (!rendererCompose.includes(requiredFragment)) {
    errors.push(`${formatPath(rendererComposePath)} is missing private Tunnel origin contract: ${requiredFragment}`)
  }
}
if ((rendererCompose.match(/^\s{4}user: "1000:1000"$/gm) ?? []).length !== 2) {
  errors.push(`${formatPath(rendererComposePath)} must run both private-origin services as secret-file owner 1000:1000`)
}
for (const forbiddenFragment of [
  "traefik.enable=true",
  "traefik.http.routers.siteinabox-renderer",
  "certresolver=",
  "HostRegexp(",
  "siteinabox-renderer:latest",
  "external: true",
  "ports:",
  "SIAB_RENDERER_API_TOKEN: ${",
  "SIAB_RENDERER_ORIGIN_SECRET: ${",
]) {
  if (rendererCompose.includes(forbiddenFragment)) {
    errors.push(`${formatPath(rendererComposePath)} publicly exposes or weakens the private origin: ${forbiddenFragment}`)
  }
}

const composePaths = await listRepoFiles(repoRoot, isComposePath)
for (const composePath of composePaths) {
  if (composePath === rendererComposePath) continue
  const compose = await readFile(composePath, "utf8")
  const conflictingHosts = extractTraefikHosts(compose).filter((host) => expectedHostSet.has(host))
  if (conflictingHosts.length > 0) {
    errors.push(
      `${formatPath(composePath)} still routes renderer-owned production host(s): ${conflictingHosts.join(", ")}`,
    )
  }
}

const forbiddenRendererDependencyChecks = [
  {
    filePath: rendererDockerfilePath,
    patterns: [
      /\bCOPY\s+sites\/(?:ami-care)\b/,
      /\bpnpm\s+--dir\s+sites\/(?:ami-care)\b/,
      /\bsites\/(?:ami-care)\/dist\b/,
      /\bAMICARE_SITE_URL\b/,
    ],
  },
  {
    filePath: buildRendererWorkflowPath,
    patterns: [/sites\/(?:ami-care)\/\*\*/, /\bSIAB_RENDERER_FIXTURE_MODE=1\b/, /\bAMICARE_SITE_URL\b/],
  },
  {
    filePath: ciWorkflowPath,
    patterns: [/\bpnpm\s+--dir\s+sites\/(?:ami-care)\b/],
  },
]

for (const { filePath, patterns } of forbiddenRendererDependencyChecks) {
  const text = await readFile(filePath, "utf8")
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      errors.push(`${formatPath(filePath)} reintroduces renderer dependency on legacy tenant app builds: ${pattern}`)
    }
  }
}

if (errors.length > 0) {
  console.error("Renderer deploy contract check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Renderer deploy contract OK: ${expectedHosts.join(", ")}`)
