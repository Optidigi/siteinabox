import { createServer } from "node:http"
import { timingSafeEqual, createHash } from "node:crypto"
import { readFile, lstat } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import {
  MAIL_BOOTSTRAP_PROTOCOL,
  parseMailBootstrapJob,
} from "@siteinabox/contracts/microsoft-mail-authority"
import { assertRecoveryMount } from "./recovery.mjs"
import { WorkerStore, advanceJob, steps } from "./worker.mjs"
import { MicrosoftBootstrapBrowser, UI_PROFILE } from "./browser.mjs"
export async function privateFile(path) {
  const s = await lstat(path)
  if (
    s.isSymbolicLink() ||
    !s.isFile() ||
    s.mode & 0o077 ||
    s.uid !== process.getuid()
  )
    throw Error("WORKER_PRIVATE_FILE_UNSAFE")
  return readFile(path)
}
export async function driverRevision() {
  const hash = createHash("sha256")
  for (const name of [
    "browser.mjs",
    "worker.mjs",
    "totp.mjs",
    "server.mjs",
    "recovery.mjs",
    "commission.mjs",
    "status.mjs",
    "rehearse.mjs",
    "../package.json",
  ])
    hash.update(await readFile(new URL(name, import.meta.url)))
  hash.update(
    await readFile(
      new URL(
        import.meta.resolve("@siteinabox/contracts/microsoft-mail-authority"),
      ),
    ),
  )
  return hash.digest("hex")
}
export function createWorkerServer({
  store,
  driver,
  secret,
  applicationId,
  partnerTenantId,
  groupId,
  qualified,
}) {
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    typeof qualified !== "function"
  )
    throw Error("WORKER_CONFIGURATION_INVALID")
  const active = new Map()
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      })
      res.end(JSON.stringify(body))
    }
    const supplied = Buffer.from(req.headers.authorization ?? ""),
      expected = Buffer.from("Bearer " + secret)
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return send(401, { code: "unauthorized" })
    try {
      const enabled = await qualified()
      if (req.method === "GET" && req.url === "/health")
        return send(200, {
          protocol: MAIL_BOOTSTRAP_PROTOCOL,
          unattended: true,
          qualified: enabled,
          uiProfile: UI_PROFILE,
          applicationId,
          partnerTenantId,
          groupId,
        })
      if (req.method !== "PUT" || !/^\/jobs\/[a-f0-9]{64}$/.test(req.url ?? ""))
        return send(404, { code: "not_found" })
      if (!enabled) return send(403, { code: "worker_not_qualified" })
      if (req.headers["content-type"] !== "application/json")
        return send(415, { code: "json_required" })
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > 16384) {
          send(413, { code: "request_too_large" })
          req.destroy()
          return
        }
        chunks.push(chunk)
      }
      let job
      try {
        job = parseMailBootstrapJob(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        )
      } catch {
        return send(422, { code: "job_invalid" })
      }
      if (
        req.url !== "/jobs/" + job.id ||
        job.applicationId.toLowerCase() !== applicationId.toLowerCase() ||
        job.partnerTenantId.toLowerCase() !== partnerTenantId.toLowerCase() ||
        job.groupId.toLowerCase() !== groupId.toLowerCase()
      )
        return send(422, { code: "job_binding_invalid" })
      const receipt = (body) => ({
        protocol: MAIL_BOOTSTRAP_PROTOCOL,
        jobId: job.id,
        binding: job.binding,
        ...body,
      })
      const record = await store.load(job.id)
      if (record && record.binding !== job.binding)
        return send(422, { code: "job_binding_invalid" })
      if (record?.status === "complete")
        return send(
          200,
          receipt({
            phase: "complete",
            relationshipId: record.state.relationshipId,
          }),
        )
      if (
        record &&
        ["started", "uncertain", "blocked"].includes(record.status) &&
        !active.has(job.id)
      )
        return send(
          200,
          receipt({
            phase: record.status === "blocked" ? "blocked" : "uncertain",
          }),
        )
      if (!active.has(job.id) && (await store.locked(job.id)))
        return send(200, receipt({ phase: "uncertain" }))
      if (!active.size) {
        const work = advanceJob(job, store, driver)
          .catch(() => ({ phase: "uncertain" }))
          .finally(() => active.delete(job.id))
        active.set(job.id, work)
      }
      return send(202, receipt({ phase: "pending" }))
    } catch {
      return send(503, { code: "worker_unavailable" })
    }
  })
  server.requestTimeout = 10000
  server.headersTimeout = 5000
  server.keepAliveTimeout = 5000
  server.maxHeadersCount = 30
  return {
    server,
    async close() {
      await new Promise((resolve) => server.close(resolve))
      await driver.close?.()
      await Promise.allSettled(active.values())
    },
  }
}
export function qualificationValid(proof, expected, now = Date.now()) {
  return (
    !!proof &&
    typeof proof === "object" &&
    !Array.isArray(proof) &&
    proof.protocol === MAIL_BOOTSTRAP_PROTOCOL &&
    proof.uiProfile === UI_PROFILE &&
    proof.revision === expected.revision &&
    proof.policyDigest === expected.policyDigest &&
    proof.applicationId === expected.applicationId &&
    proof.partnerTenantId === expected.partnerTenantId &&
    proof.qualified === true &&
    proof.offHostRecoveryVerified === true &&
    Date.parse(proof.observedAt) <= now &&
    Date.parse(proof.expiresAt) > now
  )
}
export async function startWorker(configPath, { readMountInfo } = {}) {
  const config = JSON.parse((await privateFile(configPath)).toString("utf8"))
  const pin = (
    await readFile(new URL("../../../.nvmrc", import.meta.url), "utf8")
  ).trim()
  if (process.versions.node !== pin || !process.release.lts)
    throw Error("WORKER_NODE_VERSION_INVALID")
  const guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  if (
    !guid.test(config.applicationId) ||
    !guid.test(config.partnerTenantId) ||
    !guid.test(config.groupId) ||
    config.applicationName !== "Siteinabox mail" ||
    config.location !== "Netherlands" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.partnerAccount) ||
    ![undefined, "127.0.0.1"].includes(config.host)
  )
    throw Error("WORKER_CONFIGURATION_INVALID")
  if (!/^[1-9][0-9]{0,8}$/.test(config.credentialVersion))
    throw Error("WORKER_CONFIGURATION_INVALID")
  const key = await privateFile(config.keyFile),
    factorKey = await privateFile(config.factorKeyFile)
  const secret = (await privateFile(config.secretFile)).toString("utf8").trim()
  if (
    key.length !== 32 ||
    factorKey.length !== 32 ||
    key.equals(factorKey) ||
    !/^https:\/\//.test(config.redirectUri ?? "") ||
    !config.consentPermissionLabels ||
    !Array.isArray(config.consentPermissionLabels.graph) ||
    config.consentPermissionLabels.graph.length < 5 ||
    !Array.isArray(config.consentPermissionLabels.exchange) ||
    config.consentPermissionLabels.exchange.length < 1
  )
    throw Error("WORKER_CONFIGURATION_INVALID")
  const redirect = new URL(config.redirectUri)
  if (
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  )
    throw Error("WORKER_CONFIGURATION_INVALID")
  if (typeof config.backupRoot !== "string")
    throw Error("WORKER_BACKUP_REQUIRED")
  const recoveryGuard =
    config.liveEnabled === true
      ? () =>
          assertRecoveryMount(config.backupRoot, config.backupMount, {
            readMountInfo,
          })
      : undefined
  await recoveryGuard?.()
  const store = new WorkerStore(
    config.stateRoot,
    key,
    factorKey,
    config.backupRoot,
    recoveryGuard,
  )
  key.fill(0)
  factorKey.fill(0)
  await store.initialize()
  const partnerId = createHash("sha256")
    .update(
      "siab-mail-partner:" +
        config.partnerTenantId +
        ":" +
        config.applicationId +
        ":" +
        config.credentialVersion,
    )
    .digest("hex")
  const partnerRecord = await store.load(partnerId)
  if (
    !partnerRecord?.state ||
    partnerRecord.state.account !== config.partnerAccount
  )
    throw Error("WORKER_PARTNER_COMMISSIONING_REQUIRED")
  const partner = partnerRecord.state
  const driver = new MicrosoftBootstrapBrowser({
    ...config,
    partnerAccount: partner.account,
    partnerPassword: partner.password,
    partnerTotpSeed: partner.seed,
  })
  const revision = await driverRevision()
  const browserVersion =
    config.liveEnabled === true ? await driver.preflight() : null
  const digestForBrowser = (browserVersion) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          UI_PROFILE,
          config.partnerAccount,
          config.credentialVersion,
          config.applicationId,
          config.partnerTenantId,
          config.groupId,
          config.redirectUri,
          config.applicationName,
          config.location,
          config.consentPermissionLabels,
          config.stateRoot,
          config.backupRoot,
          config.backupMount,
          process.versions.node,
          browserVersion,
        ]),
      )
      .digest("hex")
  const policyDigest = digestForBrowser(browserVersion)
  const qualified = async () => {
    if (config.liveEnabled !== true || !config.qualificationFile) return false
    try {
      await recoveryGuard?.()
      const proof = JSON.parse(
        (await privateFile(config.qualificationFile)).toString("utf8"),
      )
      return qualificationValid(proof, {
        revision,
        policyDigest,
        applicationId: config.applicationId,
        partnerTenantId: config.partnerTenantId,
      })
    } catch {
      return false
    }
  }
  const worker = createWorkerServer({
    store,
    driver,
    secret,
    applicationId: config.applicationId,
    partnerTenantId: config.partnerTenantId,
    groupId: config.groupId,
    qualified,
  })
  await new Promise((resolve, reject) => {
    worker.server.once("error", reject)
    worker.server.listen(
      config.port ?? 8082,
      config.host ?? "127.0.0.1",
      resolve,
    )
  })
  const stop = () => worker.close().then(() => process.exit(0))
  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
  console.log(
    JSON.stringify({
      event: "mail_authority_worker_started",
      protocol: MAIL_BOOTSTRAP_PROTOCOL,
      uiProfile: UI_PROFILE,
      revision,
      policyDigest,
      browserVersion,
      qualified: await qualified(),
    }),
  )
  return {
    ...worker,
    async rehearse(value, approval) {
      if (config.liveEnabled === true)
        throw Error("WORKER_REHEARSAL_REQUIRES_CLOSED_SERVICE")
      const job = parseMailBootstrapJob(value)
      const now = Date.now()
      if (
        !approval ||
        approval.kind !== "managed-mail-authority-rehearsal" ||
        approval.jobId !== job.id ||
        approval.tenantId !== job.tenantId ||
        approval.customerAuthorizationRecorded !== true ||
        !(Date.parse(approval.approvedAt) <= now) ||
        !(Date.parse(approval.expiresAt) > now) ||
        Date.parse(approval.expiresAt) - Date.parse(approval.approvedAt) >
          3_600_000 ||
        job.applicationId !== config.applicationId ||
        job.partnerTenantId !== config.partnerTenantId ||
        job.groupId !== config.groupId
      )
        throw Error("WORKER_REHEARSAL_APPROVAL_INVALID")
      const guard = () =>
        assertRecoveryMount(config.backupRoot, config.backupMount, {
          readMountInfo,
        })
      await guard()
      const rehearsalStore = new WorkerStore(
        config.stateRoot,
        store.key,
        store.factorKey,
        config.backupRoot,
        guard,
      )
      const version = await driver.preflight()
      let receipt
      for (let count = 0; count < steps.length; count++) {
        receipt = await advanceJob(job, rehearsalStore, driver)
        if (receipt.phase !== "pending") break
      }
      return {
        ...receipt,
        protocol: MAIL_BOOTSTRAP_PROTOCOL,
        jobId: job.id,
        revision,
        policyDigest: digestForBrowser(version),
        browserVersion: version,
        qualified: false,
      }
    },
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startWorker(process.argv[2]).catch(() => {
    console.error("WORKER_STARTUP_FAILED")
    process.exitCode = 1
  })
}
