import { privateFile, startWorker } from "./server.mjs"
let worker
try {
  const configPath = process.argv[2]
  const job = JSON.parse((await privateFile(process.argv[3])).toString("utf8"))
  const approval = JSON.parse(
    (await privateFile(process.argv[4])).toString("utf8"),
  )
  worker = await startWorker(configPath)
  const result = await worker.rehearse(job, approval)
  console.log(
    JSON.stringify({ event: "mail_authority_rehearsal_result", ...result }),
  )
  if (result.phase !== "complete") process.exitCode = 1
} catch {
  console.error("WORKER_REHEARSAL_FAILED")
  process.exitCode = 1
} finally {
  await worker?.close()
}
