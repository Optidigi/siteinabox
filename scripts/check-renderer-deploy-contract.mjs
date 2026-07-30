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
const cmsComposePath = resolve(repoRoot, "apps/cms/docker-compose.yml")
const landingComposePath = resolve(repoRoot, "apps/landing/compose.yml")
const intakeComposePath = resolve(repoRoot, "apps/intake/compose.yml")
const buildRendererWorkflowPath = resolve(repoRoot, ".github/workflows/build-renderer-image.yml")
const ciWorkflowPath = resolve(repoRoot, ".github/workflows/ci.yml")
const traefikAopConfigPath = resolve(repoRoot, "ops/traefik/cloudflare-aop.dynamic.yml")
const traefikAopComposePath = resolve(repoRoot, "ops/traefik/compose.cloudflare-aop.yml")
const traefikAopStaticFlagsPath = resolve(repoRoot, "ops/traefik/cloudflare-aop.static-flags.txt")

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
  "SIAB_RENDERER_ORIGIN_TRUST_MODE: cloudflare_tunnel",
  "file: ${SIAB_RENDERER_API_TOKEN_FILE:?required}",
  "file: ${CLOUDFLARE_TUNNEL_TOKEN_FILE:?required}",
  "/run/secrets/cloudflare_tunnel_token",
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
  "SIAB_RENDERER_ORIGIN_SECRET_FILE:",
  "--url",
  "httpHostHeader",
]) {
  if (rendererCompose.includes(forbiddenFragment)) {
    errors.push(`${formatPath(rendererComposePath)} publicly exposes or weakens the private origin: ${forbiddenFragment}`)
  }
}

const cmsCompose = await readFile(cmsComposePath, "utf8")
for (const requiredFragment of [
  "siteinabox-cms-tunnel:",
  "CLOUDFLARE_RENDERER_TUNNEL_ID:",
  "CLOUDFLARE_CMS_TUNNEL_ID:",
  "/run/secrets/cloudflare_cms_tunnel_token",
  "file: ${CLOUDFLARE_CMS_TUNNEL_TOKEN_FILE:?required}",
  "networks: [proxy, internal, cms-origin]",
  "networks: [cms-origin]",
  "cms-origin:",
]) {
  if (!cmsCompose.includes(requiredFragment)) {
    errors.push(`${formatPath(cmsComposePath)} is missing private CMS Tunnel contract: ${requiredFragment}`)
  }
}

const cloudflareAopOption = "tls.options=siteinabox-cloudflare-aop@file"
for (const composePath of [cmsComposePath, landingComposePath, intakeComposePath]) {
  const compose = await readFile(composePath, "utf8")
  const websecureRouters = [
    ...compose.matchAll(/traefik\.http\.routers\.([a-z0-9-]+)\.entrypoints=websecure/g),
  ].map((match) => match[1])
  if (websecureRouters.length === 0) {
    errors.push(`${formatPath(composePath)} must declare at least one explicit platform websecure router`)
  }
  for (const router of websecureRouters) {
    const requiredBinding = `traefik.http.routers.${router}.${cloudflareAopOption}`
    if (!compose.includes(requiredBinding)) {
      errors.push(
        `${formatPath(composePath)} must bind platform HTTPS router ${router} to ${cloudflareAopOption}`,
      )
    }
  }
}

const traefikAopConfig = await readFile(traefikAopConfigPath, "utf8")
for (const requiredFragment of [
  "siteinabox-cloudflare-aop:",
  "minVersion: VersionTLS12",
  "sniStrict: true",
  "/run/secrets/siteinabox-cloudflare-aop-ca.pem",
  "clientAuthType: RequireAndVerifyClientCert",
]) {
  if (!traefikAopConfig.includes(requiredFragment)) {
    errors.push(`${formatPath(traefikAopConfigPath)} is missing platform AOP contract: ${requiredFragment}`)
  }
}
const traefikAopCompose = await readFile(traefikAopComposePath, "utf8")
for (const requiredFragment of [
  "./cloudflare-aop.dynamic.yml:/etc/traefik/dynamic/cloudflare-aop.yml:ro",
  "${SIAB_CLOUDFLARE_AOP_CA_FILE:?required}:/run/secrets/siteinabox-cloudflare-aop-ca.pem:ro",
]) {
  if (!traefikAopCompose.includes(requiredFragment)) {
    errors.push(`${formatPath(traefikAopComposePath)} is missing platform AOP deployment contract: ${requiredFragment}`)
  }
}
const traefikAopStaticFlags = await readFile(traefikAopStaticFlagsPath, "utf8")
for (const requiredFragment of [
  "--providers.file.directory=/etc/traefik/dynamic",
  "--providers.file.watch=true",
]) {
  if (!traefikAopStaticFlags.split("\n").includes(requiredFragment)) {
    errors.push(
      `${formatPath(traefikAopStaticFlagsPath)} is missing required Traefik static flag: ${requiredFragment}`,
    )
  }
}
for (const forbiddenFragment of [
  "Host(`admin.ami-care.nl`)",
  "HostRegexp(",
  "cloudflare_cms_tunnel_token\n      - --url",
  "httpHostHeader",
]) {
  if (cmsCompose.includes(forbiddenFragment)) {
    errors.push(`${formatPath(cmsComposePath)} exposes a customer-specific or weak CMS origin route: ${forbiddenFragment}`)
  }
}

for (const [composePath, requiredImage] of [
  [
    landingComposePath,
    "image: ghcr.io/optidigi/siteinabox-site@${SIAB_SITE_IMAGE_DIGEST:?required}",
  ],
  [
    intakeComposePath,
    "image: ghcr.io/optidigi/siteinabox-intake@${SIAB_INTAKE_IMAGE_DIGEST:?required}",
  ],
]) {
  const compose = await readFile(composePath, "utf8")
  if (!compose.includes(requiredImage)) {
    errors.push(
      `${formatPath(composePath)} must deploy its successful workflow output by immutable digest`,
    )
  }
  if (/image:\s+\S+:(?:latest|main)\s*$/m.test(compose)) {
    errors.push(`${formatPath(composePath)} must not deploy a mutable production image tag`)
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

console.log("Renderer/CMS private Tunnel deploy contract OK: customer hosts are data-driven")
