import { lstat, readdir, realpath, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const CMS_TEST_DATA_PARENT = path.join(repositoryRoot, "apps", "cms")
const TEST_DATA_BASENAME = /^\.data-test-\d+$/

export function parseCleanupArgs(args) {
  let apply = false

  for (const arg of args) {
    if (arg === "--apply") {
      if (apply) throw new Error("--apply may be specified only once")
      apply = true
      continue
    }
    throw new Error(`Unsupported argument: ${arg}`)
  }

  return { apply }
}

export async function cleanupCmsTestData({
  apply = false,
  parentDir = CMS_TEST_DATA_PARENT,
  log = console.log,
} = {}) {
  const fixedParent = path.resolve(parentDir)
  const canonicalParent = await realpath(fixedParent)
  const entries = (await readdir(canonicalParent)).sort()
  const candidates = []

  for (const basename of entries) {
    if (!TEST_DATA_BASENAME.test(basename)) continue

    const candidate = path.resolve(canonicalParent, basename)
    if (path.dirname(candidate) !== canonicalParent) {
      throw new Error(`Unsafe cleanup candidate outside the fixed parent: ${candidate}`)
    }

    const stats = await lstat(candidate)
    if (stats.isSymbolicLink()) {
      throw new Error(`Refusing symlink cleanup candidate: ${candidate}`)
    }
    if (!stats.isDirectory()) {
      throw new Error(`Refusing non-directory cleanup candidate: ${candidate}`)
    }
    candidates.push(candidate)
  }

  for (const candidate of candidates) {
    log(`${apply ? "remove" : "would remove"}: ${candidate}`)
  }

  if (apply) {
    for (const candidate of candidates) {
      await rm(candidate, { recursive: true })
    }
  }

  log(`${apply ? "removed" : "found"}: ${candidates.length}`)
  return candidates
}

async function main() {
  const options = parseCleanupArgs(process.argv.slice(2))
  await cleanupCmsTestData(options)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
