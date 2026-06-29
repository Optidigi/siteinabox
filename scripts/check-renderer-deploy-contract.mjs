import { readdir, readFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { RENDERER_DEPLOY_TARGETS, RENDERER_PRODUCTION_HOSTS } = await import(
  `file://${resolve(repoRoot, "packages/contracts/src/deploy-targets.ts")}`
)
const rendererComposePath = resolve(repoRoot, "apps/renderer/compose.yml")
const rendererDockerfilePath = resolve(repoRoot, "apps/renderer/Dockerfile")
const buildRendererWorkflowPath = resolve(repoRoot, ".github/workflows/build-renderer-image.yml")
const ciWorkflowPath = resolve(repoRoot, ".github/workflows/ci.yml")

const expectedHosts = [...RENDERER_PRODUCTION_HOSTS].sort()
const expectedHostSet = new Set(expectedHosts)
const expectedOriginsByBuildArg = new Map(
  RENDERER_DEPLOY_TARGETS.map((target) => [target.siteUrlBuildArg, target.productionOrigin]),
)

function formatPath(filePath) {
  return relative(repoRoot, filePath)
}

function extractTraefikHosts(text) {
  return [...text.matchAll(/Host\(`([^`]+)`\)/g)].map((match) => match[1]).sort()
}

function extractBuildArgValues(text) {
  const values = new Map()
  for (const [buildArg] of expectedOriginsByBuildArg) {
    const match = text.match(new RegExp(`\\b${buildArg}=([^\\s]+)`))
    if (match?.[1]) values.set(buildArg, match[1])
  }
  return values
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

function assertEqualList(errors, label, actual, expected) {
  const actualJson = JSON.stringify([...actual].sort())
  const expectedJson = JSON.stringify([...expected].sort())
  if (actualJson !== expectedJson) {
    errors.push(`${label}: expected ${expectedJson}, got ${actualJson}`)
  }
}

const errors = []

const rendererCompose = await readFile(rendererComposePath, "utf8")
assertEqualList(errors, `${formatPath(rendererComposePath)} Traefik hosts`, extractTraefikHosts(rendererCompose), expectedHosts)

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

for (const filePath of [rendererDockerfilePath, buildRendererWorkflowPath]) {
  const text = await readFile(filePath, "utf8")
  const values = extractBuildArgValues(text)
  for (const [buildArg, expectedOrigin] of expectedOriginsByBuildArg) {
    const actualOrigin = values.get(buildArg)
    if (actualOrigin !== expectedOrigin) {
      errors.push(`${formatPath(filePath)} ${buildArg}: expected ${expectedOrigin}, got ${actualOrigin ?? "missing"}`)
    }
  }
}

const forbiddenRendererDependencyChecks = [
  {
    filePath: rendererDockerfilePath,
    patterns: [
      /\bCOPY\s+sites\/(?:ami-care)\b/,
      /\bpnpm\s+--dir\s+sites\/(?:ami-care)\b/,
      /\bsites\/(?:ami-care)\/dist\b/,
    ],
  },
  {
    filePath: buildRendererWorkflowPath,
    patterns: [/sites\/(?:ami-care)\/\*\*/, /\bSIAB_RENDERER_FIXTURE_MODE=1\b/],
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
