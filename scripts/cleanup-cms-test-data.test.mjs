import assert from "node:assert/strict"
import { lstat, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { cleanupCmsTestData, parseCleanupArgs } from "./cleanup-cms-test-data.mjs"

async function fixture(t) {
  const parentDir = await mkdtemp(path.join(os.tmpdir(), "siab-cms-cleanup-"))
  t.after(() => rm(parentDir, { recursive: true, force: true }))
  return parentDir
}

test("dry-run reports only matching immediate directories", async (t) => {
  const parentDir = await fixture(t)
  await mkdir(path.join(parentDir, ".data-test-101"))
  await mkdir(path.join(parentDir, ".data-local"))
  await mkdir(path.join(parentDir, "ordinary", ".data-test-202"), { recursive: true })
  const output = []

  const candidates = await cleanupCmsTestData({ parentDir, log: (line) => output.push(line) })

  assert.deepEqual(candidates, [path.join(parentDir, ".data-test-101")])
  assert.match(output[0], /^would remove: /)
  assert.equal(output.at(-1), "found: 1")
  assert.equal(await lstatPath(path.join(parentDir, ".data-test-101")), "directory")
})

test("--apply removes only matching immediate directories", async (t) => {
  const parentDir = await fixture(t)
  const matching = path.join(parentDir, ".data-test-303")
  const generic = path.join(parentDir, ".data-other")
  const ordinary = path.join(parentDir, "ordinary")
  const nested = path.join(ordinary, ".data-test-404")
  await mkdir(matching)
  await writeFile(path.join(matching, "fixture"), "test")
  await mkdir(generic)
  await mkdir(nested, { recursive: true })

  await cleanupCmsTestData({ apply: true, parentDir, log: () => {} })

  await assert.rejects(lstatPath(matching))
  assert.equal(await lstatPath(generic), "directory")
  assert.equal(await lstatPath(ordinary), "directory")
  assert.equal(await lstatPath(nested), "directory")
})

test("a matching symlink causes safe refusal and remains", async (t) => {
  const parentDir = await fixture(t)
  const target = await mkdtemp(path.join(os.tmpdir(), "siab-cms-cleanup-target-"))
  t.after(() => rm(target, { recursive: true, force: true }))
  const link = path.join(parentDir, ".data-test-505")
  const validDirectory = path.join(parentDir, ".data-test-504")
  await mkdir(validDirectory)
  await symlink(target, link, "dir")

  await assert.rejects(
    cleanupCmsTestData({ apply: true, parentDir, log: () => {} }),
    /Refusing symlink cleanup candidate/,
  )
  assert.equal(await lstatPath(validDirectory), "directory")
  assert.equal(await lstatPath(link), "symlink")
  assert.equal(await lstatPath(target), "directory")
})

test("a matching non-directory causes safe refusal", async (t) => {
  const parentDir = await fixture(t)
  const file = path.join(parentDir, ".data-test-606")
  await writeFile(file, "not a directory")

  await assert.rejects(cleanupCmsTestData({ parentDir, log: () => {} }), /Refusing non-directory/)
  assert.equal(await lstatPath(file), "file")
})

test("CLI arguments cannot select an external cleanup root", () => {
  assert.deepEqual(parseCleanupArgs([]), { apply: false })
  assert.deepEqual(parseCleanupArgs(["--apply"]), { apply: true })
  assert.throws(() => parseCleanupArgs(["/tmp"]), /Unsupported argument/)
  assert.throws(() => parseCleanupArgs(["--root=/tmp"]), /Unsupported argument/)
  assert.throws(() => parseCleanupArgs(["--apply", "--apply"]), /only once/)
})

async function lstatPath(target) {
  const stats = await lstat(target)
  if (stats.isSymbolicLink()) return "symlink"
  if (stats.isDirectory()) return "directory"
  if (stats.isFile()) return "file"
  return "other"
}
