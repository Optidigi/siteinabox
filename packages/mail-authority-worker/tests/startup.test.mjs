import { createMailBootstrapJob } from "@siteinabox/contracts/microsoft-mail-authority"
import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { commissionPartner } from "../src/commission.mjs"
import { startWorker } from "../src/server.mjs"

test("commissioned encrypted credentials start the real service with qualification closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-startup-"))
  const config = {
    partnerAccount: "operator@partner.test",
    credentialVersion: "1",
    groupId: "00000000-0000-4000-8000-000000000004",
    applicationId: "00000000-0000-4000-8000-000000000003",
    partnerTenantId: "00000000-0000-4000-8000-000000000001",
    redirectUri:
      "https://admin.fixture.test/operations/microsoft-mail/consent/callback",
    consentPermissionLabels: {
      graph: ["a", "b", "c", "d", "e"],
      exchange: ["f"],
    },
    applicationName: "Siteinabox mail",
    location: "Netherlands",
    stateRoot: join(root, "state"),
    backupRoot: join(root, "backup"),
    keyFile: join(root, "password.key"),
    factorKeyFile: join(root, "factor.key"),
    secretFile: join(root, "service.key"),
    liveEnabled: false,
    port: 0,
  }
  config.backupMount = {
    mountPoint: config.backupRoot,
    fileSystem: "nfs4",
    source: "recovery.example.invalid:/worker",
  }
  const path = join(root, "config.json")
  await writeFile(path, JSON.stringify(config), { mode: 0o600 })
  await writeFile(config.keyFile, Buffer.alloc(32, 1), { mode: 0o600 })
  await writeFile(config.factorKeyFile, Buffer.alloc(32, 2), { mode: 0o600 })
  await writeFile(config.secretFile, "s".repeat(40), { mode: 0o600 })
  const result = spawnSync(
    process.execPath,
    [new URL("../src/commission.mjs", import.meta.url).pathname, path],
    {
      input: JSON.stringify({
        account: config.partnerAccount,
        password: "synthetic-private-partner",
        seed: "GEZDGNBVGY3TQOJQ",
      }),
      encoding: "utf8",
    },
  )
  // Real CLI cannot be tricked into accepting local storage as a remote recovery mount.
  assert.equal(result.status, 1)
  assert.equal(result.stdout.includes("synthetic-private-partner"), false)
  const input = {
    account: config.partnerAccount,
    password: "synthetic-private-partner",
    seed: "GEZDGNBVGY3TQOJQ",
  }
  const mountInfo = `42 1 0:42 / ${config.backupRoot} rw - nfs4 recovery.example.invalid:/worker rw`
  await commissionPartner(config, input, {
    readMountInfo: async () => mountInfo,
  })
  await assert.rejects(
    commissionPartner(config, input, { readMountInfo: async () => mountInfo }),
    /WORKER_CREDENTIAL_VERSION_EXISTS/,
  )
  const worker = await startWorker(path)
  try {
    const job = createMailBootstrapJob({
      runId: "42",
      orderId: "9",
      tenantId: "00000000-0000-4000-8000-000000000002",
      initialDomain: "fixture.onmicrosoft.com",
      domain: "fixture.test",
      applicationId: config.applicationId,
      partnerTenantId: config.partnerTenantId,
      groupId: config.groupId,
      sourceRelationshipId: "default",
      targetRelationshipId: "full",
    })
    await assert.rejects(
      worker.rehearse(job, {}),
      /WORKER_REHEARSAL_APPROVAL_INVALID/,
    )
    await assert.rejects(
      worker.rehearse(job, {
        kind: "managed-mail-authority-rehearsal",
        jobId: job.id,
        tenantId: job.tenantId,
        customerAuthorizationRecorded: true,
        approvedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      }),
      /WORKER_RECOVERY_MOUNT_UNAVAILABLE/,
    )

    const response = await fetch(
      "http://127.0.0.1:" + worker.server.address().port + "/health",
      { headers: { authorization: "Bearer " + "s".repeat(40) } },
    )
    assert.equal(response.status, 200)
    assert.equal((await response.json()).qualified, false)
  } finally {
    await worker.close()
  }
})
