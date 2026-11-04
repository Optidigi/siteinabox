import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto"
import {
  mkdir,
  open,
  lstat,
  realpath,
  readFile,
  rename,
  unlink,
} from "node:fs/promises"
import { join, resolve } from "node:path"
export const steps = [
  "create_admin",
  "promote_admin",
  "secure_admin",
  "approve_gdap",
  "consent_application",
  "verify_completion",
]
export class WorkerStore {
  constructor(root, key, factorKey, backupRoot, recoveryGuard) {
    if (
      !Buffer.isBuffer(key) ||
      key.length !== 32 ||
      !Buffer.isBuffer(factorKey) ||
      factorKey.length !== 32 ||
      key.equals(factorKey)
    )
      throw Error("WORKER_KEY_INVALID")
    this.recoveryGuard = recoveryGuard
    this.root = resolve(root)
    this.key = Buffer.from(key)
    this.factorKey = Buffer.from(factorKey)
    this.backupRoot = backupRoot ? resolve(backupRoot) : null
    if (
      this.backupRoot &&
      (this.backupRoot === this.root ||
        this.backupRoot.startsWith(this.root + "/") ||
        this.root.startsWith(this.backupRoot + "/"))
    )
      throw Error("WORKER_BACKUP_INVALID")
  }
  path(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("WORKER_JOB_INVALID")
    return join(this.root, id + ".json")
  }
  async initialize() {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const s = await lstat(this.root)
    if (
      s.isSymbolicLink() ||
      !s.isDirectory() ||
      s.mode & 0o077 ||
      s.uid !== process.getuid() ||
      (await realpath(this.root)) !== this.root
    )
      throw Error("WORKER_STORAGE_UNSAFE")
  }
  async load(id) {
    try {
      const file = this.path(id)
      const s = await lstat(file)
      if (
        !s.isFile() ||
        s.isSymbolicLink() ||
        s.mode & 0o077 ||
        s.uid !== process.getuid()
      )
        throw Error("WORKER_STORAGE_UNSAFE")
      const e = JSON.parse(await readFile(file, "utf8"))
      const d = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(e.iv, "base64"),
      )
      d.setAAD(Buffer.from("siab-bootstrap-v1:" + id))
      d.setAuthTag(Buffer.from(e.tag, "base64"))
      const state = JSON.parse(
        Buffer.concat([
          d.update(Buffer.from(e.body, "base64")),
          d.final(),
        ]).toString("utf8"),
      )
      if (state.factor) {
        const f = state.factor
        const decrypt = createDecipheriv(
          "aes-256-gcm",
          this.factorKey,
          Buffer.from(f.iv, "base64"),
        )
        decrypt.setAAD(Buffer.from("siab-bootstrap-factor-v1:" + id))
        decrypt.setAuthTag(Buffer.from(f.tag, "base64"))
        state.state.seed = Buffer.concat([
          decrypt.update(Buffer.from(f.body, "base64")),
          decrypt.final(),
        ]).toString("utf8")
        delete state.factor
      }
      return state
    } catch (e) {
      if (e.code === "ENOENT") return null
      throw Error("WORKER_STATE_INVALID")
    }
  }
  async save(id, state) {
    await this.recoveryGuard?.()
    await this.initialize()
    state = structuredClone(state)
    if (state.state?.seed) {
      const factorIv = randomBytes(12),
        f = createCipheriv("aes-256-gcm", this.factorKey, factorIv)
      f.setAAD(Buffer.from("siab-bootstrap-factor-v1:" + id))
      const factorBody = Buffer.concat([f.update(state.state.seed), f.final()])
      state.factor = {
        iv: factorIv.toString("base64"),
        tag: f.getAuthTag().toString("base64"),
        body: factorBody.toString("base64"),
      }
      delete state.state.seed
    }
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.key, iv)
    c.setAAD(Buffer.from("siab-bootstrap-v1:" + id))
    const body = Buffer.concat([c.update(JSON.stringify(state)), c.final()])
    const file = this.path(id),
      temp = file + "." + randomUUID() + ".tmp"
    const f = await open(temp, "wx", 0o600)
    try {
      await f.writeFile(
        JSON.stringify({
          iv: iv.toString("base64"),
          tag: c.getAuthTag().toString("base64"),
          body: body.toString("base64"),
        }),
      )
      await f.sync()
    } finally {
      await f.close()
    }
    await rename(temp, file)
    const dir = await open(this.root, "r")
    try {
      await dir.sync()
    } finally {
      await dir.close()
    }
    if (this.backupRoot) {
      const backup = new WorkerStore(this.backupRoot, this.key, this.factorKey)
      await backup.save(id, await this.load(id))
      const recovered = await backup.load(id)
      if (JSON.stringify(recovered) !== JSON.stringify(await this.load(id)))
        throw Error("WORKER_BACKUP_RECOVERY_FAILED")
      await this.recoveryGuard?.()
    }
  }
  async locked(id) {
    try {
      await lstat(this.path(id) + ".lock")
      return true
    } catch (error) {
      if (error.code === "ENOENT") return false
      throw error
    }
  }
  async lock(id) {
    await this.initialize()
    const file = this.path(id) + ".lock"
    try {
      const fd = await open(file, "wx", 0o600)
      return async () => {
        await fd.close()
        await unlink(file)
      }
    } catch (e) {
      if (e.code === "EEXIST") return null
      throw e
    }
  }
}
export async function advanceJob(job, store, driver) {
  const release = await store.lock(job.id)
  if (!release) return { phase: "uncertain" }
  try {
    let record = await store.load(job.id)
    if (record && record.binding !== job.binding)
      throw Error("WORKER_BINDING_CHANGED")
    if (!record) {
      record = {
        binding: job.binding,
        index: 0,
        status: "pending",
        state: {},
        createdAt: Date.now(),
      }
      await store.save(job.id, record)
    }
    if (record.status === "complete")
      return { phase: "complete", relationshipId: record.state.relationshipId }
    if (["started", "uncertain", "blocked"].includes(record.status))
      return { phase: record.status === "blocked" ? "blocked" : "uncertain" }
    if (Date.now() - record.createdAt >= 1800000) {
      record.status = "blocked"
      await store.save(job.id, record)
      return { phase: "blocked" }
    }
    record.status = "started"
    await store.save(job.id, record)
    try {
      record.state = await driver.run(
        steps[record.index],
        job,
        record.state,
        async (state) => {
          record.state = state
          await store.save(job.id, record)
        },
      )
      if (
        !record.state ||
        typeof record.state !== "object" ||
        Array.isArray(record.state)
      )
        throw Error("WORKER_RESULT_INVALID")
      record.index++
      record.status = record.index === steps.length ? "complete" : "pending"
      if (
        record.status === "complete" &&
        (!/^[a-z0-9-]{1,160}$/i.test(record.state.relationshipId ?? "") ||
          record.state.relationshipId === job.sourceRelationshipId ||
          record.state.relationshipId !== job.targetRelationshipId)
      )
        throw Error("WORKER_RESULT_INVALID")
      await store.save(job.id, record)
      return record.status === "complete"
        ? { phase: "complete", relationshipId: record.state.relationshipId }
        : { phase: "pending" }
    } catch (e) {
      record.status =
        e.code === "WORKER_SECURITY_BLOCKED" ? "blocked" : "uncertain"
      record.issueCode =
        e.code === "WORKER_SECURITY_BLOCKED"
          ? "WORKER_SECURITY_BLOCKED"
          : "WORKER_ACTION_OUTCOME_UNKNOWN"
      record.failedStep = steps[record.index]
      record.updatedAt = new Date().toISOString()
      await store.save(job.id, record)
      return { phase: record.status }
    }
  } finally {
    await release()
  }
}
