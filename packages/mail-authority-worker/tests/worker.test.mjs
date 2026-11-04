import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WorkerStore, advanceJob } from "../src/worker.mjs"
const id = "a".repeat(64)
const job = {
  id,
  binding: id,
  targetRelationshipId: "full-relationship",
  tenantId: "00000000-0000-4000-8000-000000000002",
  initialDomain: "fixture.onmicrosoft.com",
}
test("journals privileged steps, encrypts credentials, and completes once", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-"))
  const store = new WorkerStore(root, Buffer.alloc(32, 9), Buffer.alloc(32, 10))
  let writes = 0
  const driver = {
    run: async (step, _job, state) => {
      writes++
      return {
        ...state,
        password: "synthetic-private-password",
        relationshipId: "full-relationship",
      }
    },
  }
  let result
  for (let i = 0; i < 10; i++) {
    result = await advanceJob(job, store, driver)
    if (result.phase === "complete") break
  }
  assert.equal(result.phase, "complete")
  const before = writes
  await advanceJob(job, store, driver)
  assert.equal(writes, before)
  const bytes = await readFile(join(root, id + ".json"), "utf8")
  assert.equal(bytes.includes("synthetic-private-password"), false)
})
test("a crash after a write never repeats that action or fabricates completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-"))
  const store = new WorkerStore(root, Buffer.alloc(32, 8), Buffer.alloc(32, 10))
  let writes = 0
  const driver = {
    run: async () => {
      writes++
      throw Error("private provider details")
    },
  }
  assert.equal((await advanceJob(job, store, driver)).phase, "uncertain")
  assert.equal((await advanceJob(job, store, driver)).phase, "uncertain")
  assert.equal(writes, 1)
})
