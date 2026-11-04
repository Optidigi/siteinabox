import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { assertRecoveryMount } from "./recovery.mjs"
import { WorkerStore } from "./worker.mjs"
import { privateFile } from "./server.mjs"
import { base32 } from "./totp.mjs"

/** Trusted platform intake. CLI always uses real mountinfo; synthetic tests inject only its reader. */
export async function commissionPartner(config, input, { readMountInfo } = {}) {
  if (
    typeof config.backupRoot !== "string" ||
    !/^[1-9][0-9]{0,8}$/.test(config.credentialVersion)
  )
    throw Error("WORKER_CONFIGURATION_INVALID")
  if (
    Object.keys(input).some(
      (key) => !["account", "password", "seed"].includes(key),
    ) ||
    input.account !== config.partnerAccount ||
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 256
  )
    throw Error("WORKER_CREDENTIAL_INVALID")
  base32(input.seed)
  const guard = () =>
    assertRecoveryMount(config.backupRoot, config.backupMount, {
      readMountInfo,
    })
  await guard()
  const key = await privateFile(config.keyFile),
    factorKey = await privateFile(config.factorKeyFile)
  const store = new WorkerStore(
    config.stateRoot,
    key,
    factorKey,
    config.backupRoot,
    guard,
  )
  key.fill(0)
  factorKey.fill(0)
  const id = createHash("sha256")
    .update(
      "siab-mail-partner:" +
        config.partnerTenantId +
        ":" +
        config.applicationId +
        ":" +
        config.credentialVersion,
    )
    .digest("hex")
  const release = await store.lock(id)
  if (!release) throw Error("WORKER_COMMISSIONING_LOCKED")
  try {
    if (await store.load(id)) throw Error("WORKER_CREDENTIAL_VERSION_EXISTS")
    await store.save(id, {
      state: input,
      commissionedAt: new Date().toISOString(),
    })
  } finally {
    await release()
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const config = JSON.parse(
      (await privateFile(process.argv[2])).toString("utf8"),
    )
    const chunks = []
    let size = 0
    for await (const chunk of process.stdin) {
      size += chunk.length
      if (size > 4096) throw Error()
      chunks.push(chunk)
    }
    await commissionPartner(
      config,
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    )
    console.log("WORKER_PARTNER_COMMISSIONED")
  } catch {
    console.error("WORKER_COMMISSIONING_FAILED")
    process.exitCode = 1
  }
}
