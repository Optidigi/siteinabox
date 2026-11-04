import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMailBootstrapJob } from "@siteinabox/contracts/microsoft-mail-authority"
import { WorkerStore } from "../src/worker.mjs"
import { createWorkerServer } from "../src/server.mjs"
const job = createMailBootstrapJob({
  runId: "42",
  orderId: "9",
  tenantId: "00000000-0000-4000-8000-000000000002",
  initialDomain: "fixture.onmicrosoft.com",
  domain: "fixture.test",
  applicationId: "00000000-0000-4000-8000-000000000003",
  partnerTenantId: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000004",
  sourceRelationshipId: "default",
  targetRelationshipId: "full",
})
const secret = "s".repeat(40)
test("real HTTP boundary authenticates, validates binding and blocks unqualified writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-http-"))
  const store = new WorkerStore(root, Buffer.alloc(32, 1), Buffer.alloc(32, 2))
  let enabled = false,
    writes = 0
  const worker = createWorkerServer({
    store,
    driver: {
      run: async () => {
        writes++
        return { relationshipId: "full" }
      },
    },
    secret,
    applicationId: job.applicationId,
    partnerTenantId: job.partnerTenantId,
    groupId: job.groupId,
    qualified: async () => enabled,
  })
  await new Promise((resolve) => worker.server.listen(0, "127.0.0.1", resolve))
  const origin = "http://127.0.0.1:" + worker.server.address().port
  try {
    assert.equal((await fetch(origin + "/health")).status, 401)
    const headers = {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
    }
    const health = await fetch(origin + "/health", { headers })
    assert.equal((await health.json()).qualified, false)
    assert.equal(
      (
        await fetch(origin + "/jobs/" + job.id, {
          method: "PUT",
          headers,
          body: JSON.stringify(job),
        })
      ).status,
      403,
    )
    assert.equal(writes, 0)
    enabled = true
    assert.equal(
      (
        await fetch(origin + "/jobs/" + job.id, {
          method: "PUT",
          headers,
          body: JSON.stringify({ ...job, password: "must-not-be-accepted" }),
        })
      ).status,
      422,
    )
    assert.equal(writes, 0)
    const response = await fetch(origin + "/jobs/" + job.id, {
      method: "PUT",
      headers,
      body: JSON.stringify(job),
    })
    assert.equal(response.status, 202)
  } finally {
    await worker.close()
  }
  assert.equal(writes, 1)
})
test("separate factor key is necessary to decrypt saved seed; tampering fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-factor-")),
    key = Buffer.alloc(32, 1),
    factor = Buffer.alloc(32, 2)
  const store = new WorkerStore(root, key, factor)
  await store.save(job.id, {
    state: { password: "synthetic-password", seed: "GEZDGNBVGY3TQOJQ" },
  })
  assert.equal((await store.load(job.id)).state.seed, "GEZDGNBVGY3TQOJQ")
  await assert.rejects(
    new WorkerStore(root, key, Buffer.alloc(32, 3)).load(job.id),
    /WORKER_STATE_INVALID/,
  )
  const file = join(root, job.id + ".json")
  const text = await readFile(file, "utf8")
  assert.equal(text.includes("synthetic-password"), false)
  assert.equal(text.includes("GEZDGNBVGY3TQOJQ"), false)
  await writeFile(file, text.replace('"tag":"', '"tag":"a'))
  await assert.rejects(store.load(job.id), /WORKER_STATE_INVALID/)
})

test("source, policy, expiry and off-host recovery proof all constrain qualification", async () => {
  const { qualificationValid } = await import("../src/server.mjs")
  const now = Date.parse("2026-11-04T12:00:00Z")
  const expected = {
    revision: "source",
    policyDigest: "policy",
    applicationId: job.applicationId,
    partnerTenantId: job.partnerTenantId,
    groupId: job.groupId,
  }
  const proof = {
    ...expected,
    protocol: "siab-managed-mail-authority-v1",
    uiProfile: "partner-center-users-2026-11-04",
    qualified: true,
    offHostRecoveryVerified: true,
    observedAt: "2026-11-04T11:00:00Z",
    expiresAt: "2026-11-05T12:00:00Z",
  }
  assert.equal(qualificationValid(proof, expected, now), true)
  for (const patch of [
    { revision: "other" },
    { policyDigest: "other" },
    { offHostRecoveryVerified: false },
    { applicationId: "other" },
    { partnerTenantId: "other" },
    { observedAt: "2026-11-06T12:00:00Z" },
    { expiresAt: "2026-11-03T12:00:00Z" },
    { expiresAt: "invalid" },
  ])
    assert.equal(
      qualificationValid({ ...proof, ...patch }, expected, now),
      false,
    )
})
test("an interrupted job with only a lock returns uncertain immediately over HTTP", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-http-lock-")),
    store = new WorkerStore(root, Buffer.alloc(32, 1), Buffer.alloc(32, 2))
  let writes = 0
  await writeFile(join(root, job.id + ".json.lock"), "", { mode: 0o600 })
  const worker = createWorkerServer({
    store,
    driver: {
      run: async () => {
        writes++
        return {}
      },
    },
    secret,
    applicationId: job.applicationId,
    partnerTenantId: job.partnerTenantId,
    groupId: job.groupId,
    qualified: async () => true,
  })
  await new Promise((resolve) => worker.server.listen(0, "127.0.0.1", resolve))
  try {
    const response = await fetch(
      "http://127.0.0.1:" + worker.server.address().port + "/jobs/" + job.id,
      {
        method: "PUT",
        headers: {
          authorization: "Bearer " + secret,
          "content-type": "application/json",
        },
        body: JSON.stringify(job),
      },
    )
    assert.equal((await response.json()).phase, "uncertain")
    assert.equal(writes, 0)
  } finally {
    await worker.close()
  }
})
