import { postgresRehearsalReady } from "./postgres-readiness.mjs"
import { prepareImageBuildCache } from "./image-build-cache.mjs"
import { requiredImageAnalysisTypes } from "./dependency-image-evidence.mjs"
import { execFileSync, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import { sha256File } from "./image-artifact.mjs"
import { infrastructure } from "./infrastructure-images.mjs"
import { verifyCloudflaredImage } from "./verify-cloudflared-image.mjs"
import { parseOsRelease } from "./image-platform.mjs"
import { collectImageDependencies } from "./collect-image-dependencies.mjs"

const app = process.argv[2]
const application = { cms: "cms", renderer: "renderer", site: "landing" }[app]
if (!application || process.argv.length !== 3) throw new Error("Usage: node scripts/verify-image.mjs <cms|renderer|site>")
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit the image source before recording exact-revision verification")
}
const expectedNode = (await readFile(".nvmrc", "utf8")).trim()
if (process.versions.node !== expectedNode || !process.release.lts) {
  throw new Error("Image verification requires the exact .nvmrc Node LTS toolchain")
}
const resourceId = randomUUID()
const prefix = "siab-verify-" + resourceId.slice(0, 8)
const image = prefix + "-" + revision + ":" + app
const postgresImage = prefix + "-" + revision + ":postgres"
const cloudflaredImage = prefix + "-" + revision + ":cloudflared"
const artifactDir = "artifacts/" + prefix
const container = prefix + "-app"
const database = prefix + "-db"
const network = prefix + "-network"
const dataVolume = "siab-verify-" + resourceId + "-postgres"
let ownsDataVolume = false
let ownsBuilder = false
const builder = prefix + "-builder"
const verificationStarted = performance.now()
const timings = {}
let phaseStarted = verificationStarted

function docker(args, capture = false) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: capture ? "pipe" : "inherit" })
}


async function health(probe) {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try {
      if (await probe()) return
    } catch { /* Retry only within the bounded disposable-start window. */ }
    await setTimeout(2000)
  }
  throw new Error("Packaged image did not satisfy its health contract")
}

try {
  docker(["version", "--format", "{{.Server.Version}}"])
  const buildArgs = ["--platform", infrastructure.verificationPlatform, "--build-arg", "SIAB_BUILD_REVISION=" + revision,
    "--label", "org.opencontainers.image.revision=" + revision]
  if (app === "site") buildArgs.push(
    "--build-arg", "SITE_URL=https://siteinabox.nl",
    "--build-arg", "POSTHOG_PROJECT_TOKEN=" + (process.env.POSTHOG_PROJECT_TOKEN || "phc_image_verification"),
    "--build-arg", "POSTHOG_PUBLIC_HOST=https://r.siteinabox.nl", "--build-arg", "POSTHOG_HOST=https://eu.posthog.com")
  const cache = process.env.SIAB_IMAGE_BUILD_CACHE === "1" ? await prepareImageBuildCache(process.cwd(), app) : null
  // Cold and normal verification use the same fresh owned builder/version.
  // Only cache import/export varies; changing the driver would confound timing.
  docker(["buildx", "create", "--name", builder, "--driver", "docker-container", "--driver-opt", "image=" + infrastructure.ciBuildkit.reference, "--driver-opt", "memory=6g,cpu-period=100000,cpu-quota=200000"])
  ownsBuilder = true
  docker(["buildx", "build", "--builder", builder, "--load", ...(cache?.arguments ?? []), ...buildArgs, "--file", "apps/" + application + "/Dockerfile", "--tag", image, "."])
  if (app === "cms") {
    docker(["buildx", "build", "--builder", builder, "--load", "--platform", infrastructure.verificationPlatform,
      "--label", "org.opencontainers.image.revision=" + revision, "--file", "ops/postgres/Dockerfile", "--tag", postgresImage, "."])
    execFileSync("sh", ["ops/postgres/Test-PostgresImage.sh", postgresImage, infrastructure.images.postgres.reference], { stdio: "inherit", timeout: 180000 })
    docker(["buildx", "build", "--builder", builder, "--load", "--platform", infrastructure.verificationPlatform,
      "--label", "org.opencontainers.image.revision=" + revision, "--file", "ops/cloudflared/Dockerfile", "--tag", cloudflaredImage, "."])
  }
  if (cache) await cache.commit()
  timings.buildMs = Math.round(performance.now() - phaseStarted)
  phaseStarted = performance.now()
  const imageId = docker(["image", "inspect", "--format", "{{.Id}}", image], true).trim()
  const architecture = docker(["image", "inspect", "--format", "{{.Architecture}}", image], true).trim()
  const runtimePlatform = { architecture, ...parseOsRelease(docker(["run", "--rm", "--entrypoint", "cat", image, "/etc/os-release"], true)) }
  if (infrastructure.verificationPlatform !== "linux/" + architecture || runtimePlatform.os !== "alpine" || !runtimePlatform.version) {
    throw new Error("Packaged image differs from the reviewed Linux architecture/Alpine runtime")
  }
  let postgresRehearsal = null
  let tunnelVerification = null
  let nodeLts = null
  if (app !== "site") {
    docker(["run", "--rm", "--network", "none", "--entrypoint", "/bin/sh", image, "-c",
      'for tool in npm npx yarn yarnpkg; do if command -v "$tool" >/dev/null 2>&1; then echo "Unexpected runtime package manager: $tool" >&2; exit 1; fi; done'])
    const node = JSON.parse(docker(["run", "--rm", "--entrypoint", "node", image, "--eval",
      'console.log(JSON.stringify({version:process.versions.node,lts:process.release.lts||null,uid:process.getuid(),gid:process.getgid(),versions:process.versions}))'], true))
    if (node.version !== expectedNode || !node.lts) throw new Error("Packaged Node must match .nvmrc and actually be LTS")
    if (node.uid !== 1000 || node.gid !== 1000) throw new Error("Packaged Node must preserve deployment UID/GID 1000")
    runtimePlatform.nodeVersions = node.versions
    runtimePlatform.uid = node.uid
    runtimePlatform.gid = node.gid
    nodeLts = node.lts
  }
  if (app === "renderer") {
    const result = spawnSync("pnpm", ["--dir", "apps/renderer", "smoke:packaged-image"], {
      env: { ...process.env, IMAGE_TAG: image }, stdio: "inherit",
    })
    if (result.error || result.status !== 0) throw new Error("Packaged renderer smoke failed")
  } else if (app === "cms") {
    tunnelVerification = await verifyCloudflaredImage({ docker, image: cloudflaredImage, sourceSHA: revision, artifactDir, prefix, resourceId })
    // Load sharp through Next's own dependency context in the actual runner,
    // then process pixels so missing/incompatible native libraries fail here.
    const sharpPin = (await readFile("pnpm-workspace.yaml", "utf8")).match(/^  sharp: "([^"]+)"$/m)?.[1]
    if (!sharpPin) throw new Error("CMS native smoke requires the governed sharp override")
    const nativeSharp = JSON.parse(docker(["run", "--rm", "--network", "none", "--entrypoint", "node", "--workdir", "/app/apps/cms", image,
      "--input-type=module", "--eval", `
        import { createRequire } from "node:module";
        const appRequire = createRequire(process.cwd() + "/server.js");
        const nextRequire = createRequire(appRequire.resolve("next/package.json"));
        const sharp = nextRequire("sharp");
        if (sharp.versions.sharp !== process.argv[1]) throw new Error("Packaged sharp differs from the security override");
        const { info } = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
          .resize(1, 1).png().toBuffer({ resolveWithObject: true });
        if (info.width !== 1 || info.height !== 1 || info.format !== "png") throw new Error("Packaged native image processing failed");
        console.log(JSON.stringify({ nativeImageSmoke: "passed", versions: sharp.versions, platform: process.platform, arch: process.arch }));
      `, sharpPin], true))
    runtimePlatform.sharpVersions = nativeSharp.versions
    docker(["network", "create", "--internal", network])
    docker(["volume", "create", "--label", "siteinabox.verification=" + resourceId, dataVolume], true)
    if (docker(["volume", "inspect", "--format", '{{ index .Labels "siteinabox.verification" }}', dataVolume], true).trim() !== resourceId) {
      throw new Error("Refusing to use an unowned PostgreSQL rehearsal volume")
    }
    ownsDataVolume = true
    const query = (sql) => docker(["exec", database, "psql", "-X", "-U", "payload", "-d", "payload_test",
      "-v", "ON_ERROR_STOP=1", "-Atc", sql], true).trim()
    const databaseRuntime = () => ({ serverVersion: query("SHOW server_version"),
      ...parseOsRelease(docker(["exec", database, "cat", "/etc/os-release"], true)),
      postgresUid: docker(["exec", database, "id", "-u", "postgres"], true).trim(),
      postgresGid: docker(["exec", database, "id", "-g", "postgres"], true).trim() })
    const startDatabase = async (pin) => {
      docker(["run", "--platform", infrastructure.verificationPlatform, "--detach", "--name", database, "--network", network, "--network-alias", "postgres",
        "--mount", "type=volume,src=" + dataVolume + ",dst=/var/lib/postgresql",
        "--env", "POSTGRES_USER=payload", "--env", "POSTGRES_PASSWORD=verification-only", "--env", "POSTGRES_DB=payload_test", pin.reference])
      await health(async () => postgresRehearsalReady(database))
      const [major, minor] = pin.version.split(".").map(Number)
      if (Number(query("SHOW server_version_num")) !== major * 10000 + minor) throw new Error("PostgreSQL image version differs from its reviewed pin")
    }
    await startDatabase(infrastructure.images["postgres-rehearsal-baseline"])
    docker(["run", "--detach", "--name", container, "--network", network,
      "--tmpfs", "/tmp/siab-data:mode=1777", "--env", "DATABASE_URI=postgres://payload:verification-only@postgres:5432/payload_test",
      "--env", "PAYLOAD_SECRET=verification-only-synthetic-secret", "--env", "DATA_DIR=/tmp/siab-data",
      "--env", "PAYLOAD_DISABLE_JOBS_AUTORUN=1", "--env", "SITE_GENERATION_PROVIDER=mock", image])
    // Probe the actual server inside its isolated network; internal-only
    // networks need no host publication to prove the packaged health contract.
    const cmsHealthy = async () => {
      const probe = spawnSync("docker", ["exec", container, "node", "--input-type=module", "--eval",
        'const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(5000) }); if (!response.ok) process.exit(1); console.log(await response.text());'],
        { encoding: "utf8", timeout: 10000 })
      if (probe.error || probe.status !== 0) return false
      const result = JSON.parse(probe.stdout)
      return result.status === "ok" && result.db === "connected" && result.dataDir === "writable" && result.revision === revision
    }
    await health(cmsHealthy)
    if (Number(query("SELECT count(*) FROM payload_migrations")) < 1) throw new Error("Committed migrations must initialize the rehearsal schema")
    query(`INSERT INTO tenants (name, slug, domain, status, theme)
      VALUES ('Infrastructure compatibility fixture', 'infra-rehearsal', 'infra.example.test', 'active',
      '{"version":3,"appearance":{"mode":"light"},"fixture":"sanitized"}'::jsonb)`)
    const snapshot = `SELECT json_build_object(
      'tenant', (SELECT row_to_json(t) FROM tenants t WHERE slug = 'infra-rehearsal'),
      'migrations', (SELECT json_agg(name ORDER BY name) FROM payload_migrations),
      'schema', (SELECT md5(string_agg(table_name || '.' || column_name || ':' || udt_name || ':' || is_nullable,
        ',' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema = 'public'))::text`
    const before = query(snapshot)
    const runtimeBefore = databaseRuntime()
    // Stop the owned app before replacing only its owned database container.
    // The exact volume persists across this same-major binary update.
    docker(["stop", "--time", "10", container])
    docker(["stop", "--time", "30", database])
    if (docker(["inspect", "--format", "{{.State.ExitCode}}", database], true).trim() !== "0") {
      throw new Error("PostgreSQL must stop cleanly before the minor-version replacement")
    }
    docker(["rm", database])
    await startDatabase({ reference: postgresImage, version: infrastructure.images.postgres.version })
    docker(["start", container])
    await health(cmsHealthy)
    const runtimeAfter = databaseRuntime()
    if (runtimeAfter.postgresUid !== runtimeBefore.postgresUid || runtimeAfter.postgresGid !== runtimeBefore.postgresGid) {
      throw new Error("PostgreSQL image update changed its persisted-volume UID/GID")
    }
    if (query(snapshot) !== before) throw new Error("Populated PostgreSQL update changed the fixture, migration history or schema")
    if (!docker(["logs", container], true).includes("[migrate-on-boot] no pending migrations")) {
      throw new Error("The actual restarted entrypoint must preserve committed migration tracking")
    }
    docker(["stop", "--time", "10", container])
    const backup = execFileSync("docker", ["exec", database, "pg_dump", "-U", "payload", "-d", "payload_test", "--format=custom"], { maxBuffer: 64 * 1024 * 1024 })
    execFileSync("docker", ["exec", "-i", database, "pg_restore", "-U", "payload", "-d", "payload_test", "--clean", "--if-exists", "--exit-on-error"], { input: backup, stdio: ["pipe", "inherit", "inherit"], timeout: 120000 })
    if (query(snapshot) !== before) throw new Error("PostgreSQL logical restore changed the fixture, schema or migration history")
    docker(["start", container])
    await health(cmsHealthy)
    if (!docker(["logs", container], true).includes("[migrate-on-boot] no pending migrations")) throw new Error("Restored database did not preserve migration tracking")
    postgresRehearsal = { lifecycleContract: "passed", logicalRestore: true, from: infrastructure.images["postgres-rehearsal-baseline"].version,
      to: infrastructure.images.postgres.version, populatedDataPreserved: true, schemaPreserved: true,
      migrationHistoryPreserved: true, gracefulDatabaseStop: true, actualEntrypointRestartPassed: true, runtimeBefore, runtimeAfter }
  } else {
    const nginx = spawnSync("docker", ["run", "--rm", "--entrypoint", "nginx", image, "-v"], { encoding: "utf8" })
    if (nginx.error || nginx.status !== 0 || !(nginx.stdout + nginx.stderr).includes("nginx/" + infrastructure.images.nginx.version)) {
      throw new Error("Packaged Nginx differs from the reviewed runtime")
    }
    runtimePlatform.nginx = infrastructure.images.nginx.version
    docker(["run", "--detach", "--name", container, "--publish", "127.0.0.1::80", image])
    const port = docker(["port", container, "80/tcp"], true).trim()
    await health(async () => {
      const response = await fetch("http://" + port + "/", { signal: AbortSignal.timeout(5000) })
      return response.ok && (await response.text()).includes("<html")
    })
  }
  timings.packagedSmokeMs = Math.round(performance.now() - phaseStarted)
  phaseStarted = performance.now()
  await mkdir(artifactDir, { recursive: true })
  const archive = artifactDir + "/image-" + app + ".tar"
  docker(["save", "--output", archive, image])
  const archiveSha256 = await sha256File(archive)
  timings.archiveMs = Math.round(performance.now() - phaseStarted)
  phaseStarted = performance.now()
  const dependencyInventory = await collectImageDependencies({ docker, root: process.cwd(), archive,
    image: { application: app, sourceSHA: revision, tag: image, imageId, archiveSha256, runtimePlatform },
    artifactDir, prefix, resourceId, requiredTypes: requiredImageAnalysisTypes(app) })
  timings.applicationInventoryMs = Math.round(performance.now() - phaseStarted)
  phaseStarted = performance.now()
  if (app === "cms") {
    const pgArchive = artifactDir + "/image-postgres.tar"
    docker(["save", "--output", pgArchive, postgresImage])
    const pg = { application: "postgres", sourceSHA: revision, tag: postgresImage,
      imageId: docker(["image", "inspect", "--format", "{{.Id}}", postgresImage], true).trim(),
      archiveSha256: await sha256File(pgArchive), runtimePlatform: { architecture: "amd64", ...parseOsRelease(docker(["run", "--rm", "--network", "none", "--entrypoint", "cat", postgresImage, "/etc/os-release"], true)) } }
    const dependencyInventory = await collectImageDependencies({ docker, root: process.cwd(), archive: pgArchive,
      image: pg, artifactDir, prefix, resourceId, requiredTypes: requiredImageAnalysisTypes("postgres") })
    await writeFile(artifactDir + "/image-postgres.json", JSON.stringify({ ...pg, archiveIdentity: dependencyInventory.archiveIdentity,
      verificationRunId: process.env.GITHUB_RUN_ID ?? null, verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      runtimeVersion: infrastructure.images.postgres.version, postgresRehearsal, dependencyInventory,
      packagedSmoke: "passed", published: false, publishable: true }, null, 2) + "\n")
  }
  timings.infrastructureInventoryMs = Math.round(performance.now() - phaseStarted)
  timings.totalMs = Math.round(performance.now() - verificationStarted)
  await writeFile(artifactDir + "/image-" + app + ".json", JSON.stringify({ application: app, sourceSHA: revision,
    imageId, tag: image, archiveSha256, archiveIdentity: dependencyInventory.archiveIdentity,
    verificationRunId: process.env.GITHUB_RUN_ID ?? null,
    verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    publishable: app !== "site" || Boolean(process.env.POSTHOG_PROJECT_TOKEN),
    nodeVersion: expectedNode, buildNodeLts: process.release.lts, nodeLts, runtimePlatform, postgresRehearsal, tunnelVerification,
    dependencyInventory, timings,
    buildEnvironment: { builder: infrastructure.ciBuildkit.reference, driver: "docker-container", cacheEnabled: process.env.SIAB_IMAGE_BUILD_CACHE === "1" },
    packagedSmoke: "passed", published: false }, null, 2) + "\n")
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    "artifact-path=" + artifactDir + "/image-" + app + ".*\nevidence-path=" + artifactDir + "/image-*.json\npostgres-artifact-path=" + artifactDir + "/image-postgres*\ncloudflared-artifact-path=" + artifactDir + "/image-cloudflared*\n")
  console.log("Verification artifacts: " + artifactDir)
  console.log("Packaged " + app + " image verification passed; no image published")
} catch (error) {
  for (const owned of [container, database]) { try { docker(["logs", owned]) } catch { /* This owned container may not have started. */ } }
  throw error
} finally {
  if (ownsBuilder) { try { docker(["buildx", "rm", builder], true) } catch { /* Only this owned builder may be removed. */ } }
  for (const args of [["rm", "--force", "--volumes", container], ["rm", "--force", "--volumes", database], ["network", "rm", network], ["image", "rm", image], ...(app === "cms" ? [["image", "rm", postgresImage]] : [])]) {
    try { docker(args, true) } catch { /* Only these uniquely owned disposable resources are eligible for cleanup. */ }
  }
  if (ownsDataVolume) {
    try {
      if (docker(["volume", "inspect", "--format", '{{ index .Labels "siteinabox.verification" }}', dataVolume], true).trim() === resourceId) {
        docker(["volume", "rm", dataVolume], true)
      }
    } catch { /* Never broaden cleanup to an unowned volume or a global prune. */ }
  }
}
