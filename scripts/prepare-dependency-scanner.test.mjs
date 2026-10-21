import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareDependencyScanner } from "./prepare-dependency-scanner.mjs"

test("scanner setup refuses unowned resource directories before network or writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-scanner-owner-"))
  try {
    const target = join(root, "artifacts/dependency-tools/trivy-0.76.0")
    await mkdir(target, { recursive: true }); await writeFile(join(target, "unrelated"), "preserve")
    await assert.rejects(prepareDependencyScanner(root), /unowned/)
    assert.equal(await readFile(join(target, "unrelated"), "utf8"), "preserve")
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("scanner setup refuses symbolic links without adopting their targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-scanner-link-"))
  try {
    const parent = join(root, "artifacts/dependency-tools")
    const unrelated = join(root, "unrelated")
    await mkdir(parent, { recursive: true }); await mkdir(unrelated)
    await symlink(unrelated, join(parent, "trivy-0.76.0"))
    await assert.rejects(prepareDependencyScanner(root), /unowned/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
