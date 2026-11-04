import { privateFile } from "./server.mjs"
import { WorkerStore, steps } from "./worker.mjs"
try {
  const config = JSON.parse(
    (await privateFile(process.argv[2])).toString("utf8"),
  )
  const key = await privateFile(config.keyFile),
    factorKey = await privateFile(config.factorKeyFile)
  const store = new WorkerStore(
    config.stateRoot,
    key,
    factorKey,
    config.backupRoot,
  )
  key.fill(0)
  factorKey.fill(0)
  const record = await store.load(process.argv[3])
  if (!record || !Number.isSafeInteger(record.index)) throw Error()
  console.log(
    JSON.stringify({
      jobId: process.argv[3],
      phase: record.status,
      step: steps[record.index] ?? "complete",
      issueCode: record.issueCode ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt ?? null,
    }),
  )
} catch {
  console.error("WORKER_STATUS_UNAVAILABLE")
  process.exitCode = 1
}
