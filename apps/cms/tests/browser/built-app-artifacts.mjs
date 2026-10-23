import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, lstat, readFile, readdir, readlink, realpath } from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { dependencyIdentities } from "../../../../scripts/collect-dependency-evidence.mjs"
import { sha256File } from "../../../../scripts/image-artifact.mjs"

export const cmsRoot = path.resolve(import.meta.dirname, "../..")
export const repositoryRoot = path.resolve(cmsRoot, "../..")
export const standaloneRoot = path.join(cmsRoot, ".next/standalone")
export const cmsEntry = path.join(standaloneRoot, "apps/cms/server.js")
const diagnosticDriverPaths = new Set(["apps/cms/tests/browser/built-app-browser.mjs",
  "apps/cms/tests/browser/built-private-workspace.mjs", "apps/cms/tests/browser/built-app-options.mjs"])

export async function prepareBuiltCmsAssets() {
  // Match the production Dockerfile's copies; standalone output does not include
  // browser assets on its own. Every destination belongs to this fresh build.
  await cp(path.join(cmsRoot, "public"), path.join(standaloneRoot, "apps/cms/public"), { recursive: true })
  await cp(path.join(cmsRoot, ".next/static"), path.join(standaloneRoot, "apps/cms/.next/static"), { recursive: true })
}

export async function hashBuiltTree(directory) {
  const root = await realpath(directory)
  const entries = []
  async function walk(relative = "") {
    for (const name of (await readdir(path.join(root, relative))).sort()) {
      const file = path.join(relative, name)
      if (/(?:^|\/)\.next\/cache(?:\/|$)/.test(file.split(path.sep).join("/"))) continue // Mutable runtime cache, not build code.
      const absolute = path.join(root, file)
      const stat = await lstat(absolute)
      if (stat.isSymbolicLink()) {
        const target = await readlink(absolute)
        const lexical = path.relative(root, path.resolve(path.dirname(absolute), target))
        if (lexical.startsWith("..") || path.isAbsolute(lexical)) throw new Error("Built artifact link escapes this checkout's build")
        let actual = "missing"
        try { actual = path.relative(root, await realpath(absolute)) }
        catch (error) { if (error.code !== "ENOENT") throw error }
        if (actual.startsWith("..") || path.isAbsolute(actual)) throw new Error("Built artifact link escapes this checkout's build")
        // Optional traced dependencies can be dangling. Bind that exact state;
        // creating a target later must invalidate the receipt as well.
        entries.push([file, "link", target, actual])
      } else if (stat.isDirectory()) await walk(file)
      else if (stat.isFile()) entries.push([file, await sha256File(absolute)])
      else throw new Error("Unsupported built artifact member")
      if (entries.length > 100000) throw new Error("Built artifact inventory exceeded its bound")
    }
  }
  await walk()
  assert(entries.length, "Built artifact inventory is empty")
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex")
}

export function buildEnvironmentFingerprint(environment) {
  const values = Object.entries(environment).filter(([name]) => /^(?:NEXT_PUBLIC_|PUBLIC_)/.test(name) ||
    ["NODE_ENV", "CI", "SITE_URL", "PAYLOAD_DISABLE_JOBS_AUTORUN", "SITE_GENERATION_PROVIDER"].includes(name)).sort(([a], [b]) => a.localeCompare(b))
  return createHash("sha256").update(JSON.stringify(values)).digest("hex")
}

export async function captureBuiltCmsIdentity() {
  const expectedNode = (await readFile(path.join(repositoryRoot, ".nvmrc"), "utf8")).trim()
  assert.equal(process.versions.node, expectedNode, "Use this checkout's pinned Node runtime")
  const inputs = await dependencyIdentities(repositoryRoot)
  return { sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
    sourceDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: repositoryRoot, encoding: "utf8" }).trim()),
    graphHash: inputs.graph.sha256, configurationHash: inputs.configuration.sha256, node: process.versions.node,
    diagnosticInputsHash: createHash("sha256").update(JSON.stringify(inputs.configuration.files.filter(file => !diagnosticDriverPaths.has(file.path)))).digest("hex"),
    buildEnvironmentSha256: buildEnvironmentFingerprint(process.env),
    buildId: (await readFile(path.join(cmsRoot, ".next/BUILD_ID"), "utf8")).trim(), artifactSha256: await hashBuiltTree(standaloneRoot) }
}

export async function assertBuiltCmsIdentity(expected, allowDirty = false) {
  const actual = await captureBuiltCmsIdentity()
  if (!allowDirty) assert.equal(actual.sourceDirty, false, "Build reuse requires a clean checkout")
  assert.deepEqual(actual, expected, "Built browser requires this checkout's unchanged source and artifact bytes")
  return actual
}

/** Diagnostic driver edits never become full-qualification build reuse. */
export function assertDiagnosticIdentity(expected, actual, changedPaths, untrackedPaths) {
  assert.equal(expected.sourceDirty, false, "Diagnostic reuse starts from a clean built checkpoint")
  assert(untrackedPaths.length === 0 && changedPaths.every(file => diagnosticDriverPaths.has(file)),
    "Diagnostic reuse permits only the three named browser driver files; runtime/guard/unknown edits require a build")
  assert(/^[a-f0-9]{64}$/.test(expected.diagnosticInputsHash), "Rebuild to capture diagnostic input identity")
  const runtime = ({ sourceSHA, sourceDirty, configurationHash, ...identity }) => identity
  assert.deepEqual(runtime(actual), runtime(expected), "Diagnostic runtime inputs, environment or built bytes changed")
}

export async function assertDiagnosticBuiltCmsIdentity(expected) {
  assert(/^[a-f0-9]{40}$/.test(expected?.sourceSHA), "Diagnostic build receipt needs a full source SHA")
  const actual = await captureBuiltCmsIdentity()
  const gitPaths = args => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).split("\0").filter(Boolean)
  assertDiagnosticIdentity(expected, actual, gitPaths(["diff", "--name-only", "-z", expected.sourceSHA, "--"]),
    gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]))
  return actual
}
