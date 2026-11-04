import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, writeFile, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WorkerStore, advanceJob } from "../src/worker.mjs"
const id = "a".repeat(64)
test("checkpoint acknowledgement includes independently readable recovery data", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-recovery-"))
  const key = Buffer.alloc(32, 1),
    factor = Buffer.alloc(32, 2)
  const store = new WorkerStore(
    join(root, "state"),
    key,
    factor,
    join(root, "backup"),
  )
  await store.save(id, {
    state: { password: "synthetic-private-password", seed: "GEZDGNBVGY3TQOJQ" },
  })
  const recovered = await new WorkerStore(
    join(root, "backup"),
    key,
    factor,
  ).load(id)
  assert.equal(recovered.state.password === "synthetic-private-password", true)
  assert.equal(recovered.state.seed === "GEZDGNBVGY3TQOJQ", true)
})
test("a stale process lock is not reclaimed and no security action is replayed", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-lock-")),
    store = new WorkerStore(root, Buffer.alloc(32, 1), Buffer.alloc(32, 2))
  await writeFile(join(root, id + ".json.lock"), "", { mode: 0o600 })
  let writes = 0
  assert.equal(
    (
      await advanceJob({ id }, store, {
        run: async () => {
          writes++
          return {}
        },
      })
    ).phase,
    "uncertain",
  )
  assert.equal(writes, 0)
})
test("unsafe storage and an unavailable recovery target prevent execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-unsafe-")),
    key = Buffer.alloc(32, 1),
    factor = Buffer.alloc(32, 2)
  await symlink(root, join(root, "alias"))
  await assert.rejects(
    new WorkerStore(join(root, "alias"), key, factor).initialize(),
    /WORKER_STORAGE_UNSAFE/,
  )
  await writeFile(join(root, "not-a-directory"), "synthetic")
  const store = new WorkerStore(
    join(root, "state"),
    key,
    factor,
    join(root, "not-a-directory"),
  )
  let writes = 0
  await assert.rejects(
    advanceJob({ id, binding: id }, store, {
      run: async () => {
        writes++
        return {}
      },
    }),
  )
  assert.equal(writes, 0)
})

test("loss of the commissioned remote mount blocks checkpoints instead of using local disk", async () => {
  const { assertRecoveryMount } = await import("../src/recovery.mjs")
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-mount-")),
    backup = join(root, "backup")
  const expected = {
    mountPoint: backup,
    fileSystem: "nfs4",
    source: "recovery.example.invalid:/worker",
  }
  let mountInfo = `1 0 0:1 / / rw - overlay overlay rw\n42 1 0:42 / ${backup} rw - nfs4 recovery.example.invalid:/worker rw`
  const guard = () =>
    assertRecoveryMount(backup, expected, {
      readMountInfo: async () => mountInfo,
    })
  const store = new WorkerStore(
    join(root, "state"),
    Buffer.alloc(32, 1),
    Buffer.alloc(32, 2),
    backup,
    guard,
  )
  await store.save(id, { state: { password: "synthetic" } })
  mountInfo = "1 0 0:1 / / rw - overlay overlay rw"
  await assert.rejects(
    store.save(id, { state: { password: "replacement" } }),
    /WORKER_RECOVERY_MOUNT_UNAVAILABLE/,
  )
  assert.equal((await store.load(id)).state.password, "synthetic")
  let writes = 0
  await assert.rejects(
    advanceJob({ id: "b".repeat(64), binding: "b".repeat(64) }, store, {
      run: async () => {
        writes++
        return {}
      },
    }),
    /WORKER_RECOVERY_MOUNT_UNAVAILABLE/,
  )
  assert.equal(writes, 0)
})
