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
const rendererRule = rendererCompose
  .split("\n")
  .find((line) => line.includes("traefik.http.routers.siteinabox-renderer.rule=")) ?? ""
if (!rendererRule.includes("HostRegexp(")) {
  errors.push(`${formatPath(rendererComposePath)} must use a TLD-neutral HostRegexp edge route`)
}
if (/\\\.nl\b|Host\(`/.test(rendererRule)) {
  errors.push(`${formatPath(rendererComposePath)} renderer route must not hard-code a production host or .nl TLD`)
}
for (const requiredFragment of [
  "traefik.http.routers.siteinabox-renderer.entrypoints=websecure",
  "traefik.http.routers.siteinabox-renderer.tls.certresolver=",
  "SIAB_RENDERER_ORIGIN_SECRET: ${SIAB_RENDERER_ORIGIN_SECRET:?required}",
]) {
  if (!rendererCompose.includes(requiredFragment)) {
    errors.push(`${formatPath(rendererComposePath)} is missing protected HTTPS origin contract: ${requiredFragment}`)
  }
}
if (rendererCompose.includes("customrequestheaders.X-Siab-Origin-Verify")) {
  errors.push(`${formatPath(rendererComposePath)} must validate the Cloudflare edge secret, not inject it at the origin`)
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
