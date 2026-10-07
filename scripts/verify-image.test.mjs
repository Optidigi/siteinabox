import assert from "node:assert/strict"
import childProcess from "node:child_process"
import fs from "node:fs/promises"
import { syncBuiltinESMExports } from "node:module"
import test from "node:test"

// Intercept the process boundary of the actual verifier, never a Docker daemon.
// This proves command construction and finally cleanup, not packaged runtime health.
for (const failApplicationStart of [false, true]) {
  test(`CMS image cleanup after ${failApplicationStart ? "failed" : "successful"} verification`, async (t) => {
    const revision = "1".repeat(40)
    const expectedNode = (
      await fs.readFile(new URL("../.nvmrc", import.meta.url), "utf8")
    ).trim()
    const calls = []
    const artifacts = []
    const originalArgv = process.argv
    t.mock.method(childProcess, "execFileSync", (command, args) => {
      calls.push([command, ...args])
      if (command === "git") return args[0] === "rev-parse" ? revision : ""
      assert.equal(command, "docker")
      if (args[0] === "image" && args[1] === "inspect") return "sha256:fixture"
      if (args.includes("--version")) return "v" + expectedNode
      if (
        failApplicationStart &&
        args[0] === "run" &&
        args.includes("DATA_DIR=/tmp/siab-data")
      ) {
        throw new Error("fixture application start failed")
      }
      return ""
    })
    t.mock.method(childProcess, "spawnSync", (command, args) => {
      calls.push([command, ...args])
      assert.equal(command, "docker")
      return {
        status: 0,
        stdout: JSON.stringify({
          status: "ok",
          db: "connected",
          dataDir: "writable",
          revision,
        }),
      }
    })
    t.mock.method(fs, "mkdir", async () => {})
    t.mock.method(fs, "writeFile", async (path, content) => {
      artifacts.push([path, JSON.parse(content)])
    })
    syncBuiltinESMExports()
    process.argv = [process.execPath, "scripts/verify-image.mjs", "cms"]
    try {
      const verification = import(
        `./verify-image.mjs?cleanup=${failApplicationStart}`
      )
      if (failApplicationStart)
        await assert.rejects(verification, /fixture application start failed/)
      else await verification
      const databaseRun = calls.find(
        (args) =>
          args[0] === "docker" &&
          args[1] === "run" &&
          args.at(-1) === "postgres:18-alpine",
      )
      assert.ok(databaseRun, "the actual CMS path must start PostgreSQL")
      const database = databaseRun[databaseRun.indexOf("--name") + 1]
      assert.equal(
        databaseRun[databaseRun.indexOf("--tmpfs") + 1],
        "/var/lib/postgresql",
        "PostgreSQL 18 data must use ephemeral storage at its declared volume path",
      )
      assert.ok(
        databaseRun.includes("--rm"),
        "database must also auto-remove on exit",
      )
      const cleanup = calls.filter(
        (args) =>
          args[0] === "docker" &&
          ["rm", "network", "image"].includes(args[1]) &&
          !(args[1] === "image" && args[2] === "inspect") &&
          !(args[1] === "network" && args[2] === "create"),
      )
      const prefix = database.slice(0, -3)
      assert.deepEqual(
        cleanup,
        [
          ["docker", "rm", "--force", "--volumes", prefix + "-app"],
          ["docker", "rm", "--force", "--volumes", database],
          ["docker", "network", "rm", prefix + "-network"],
          ["docker", "image", "rm", prefix + ":cms"],
        ],
        "cleanup must remove only the verifier's unique resources and anonymous volumes",
      )
      assert.equal(
        artifacts.length,
        failApplicationStart ? 0 : 1,
        "failure must not record successful image verification",
      )
      if (!failApplicationStart)
        assert.equal(artifacts[0][1].sourceSHA, revision)
      assert.ok(
        calls.some((args) => args.includes("/usr/bin/named-checkzone")),
        "real BIND probe remains on the CMS command path",
      )
    } finally {
      process.argv = originalArgv
      t.mock.restoreAll()
      syncBuiltinESMExports()
    }
  })
}
