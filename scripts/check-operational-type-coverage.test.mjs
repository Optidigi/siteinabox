import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

const execute = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("the owning CMS compiler includes operational TypeScript and rejects an invalid value", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-operational-types-"))
  try {
    await mkdir(path.join(directory, "scripts"))
    // Use the actual owning configuration, including its source inclusion rules.
    // Disable only incremental output so the fixture remains self-contained.
    const config = JSON.parse(await readFile(path.join(root, "apps/cms/tsconfig.json"), "utf8"))
    config.compilerOptions.incremental = false
    await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify(config))
    const source = path.join(directory, "scripts/check-operation.ts")
    await writeFile(source, 'export const requiredCount: number = 7\n')
    const command = [path.join(root, "node_modules/typescript/bin/tsc"), "--project", path.join(directory, "tsconfig.json"), "--noEmit"]
    await execute(process.execPath, command, { cwd: directory, timeout: 30_000 })
    await writeFile(source, 'export const requiredCount: number = "broken"\n')
    let failure
    try { await execute(process.execPath, command, { cwd: directory, timeout: 30_000 }) }
    catch (error) { failure = error }
    assert(failure, "the owning compiler accepted a broken operational script")
    const output = `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`
    assert.equal(failure.code, 2, output)
    assert.match(output, /scripts\/check-operation\.ts/)
    assert.match(output, /TS2322: Type 'string' is not assignable to type 'number'/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
