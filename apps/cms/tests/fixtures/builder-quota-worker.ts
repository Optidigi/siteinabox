// Disposable-PG subprocess fixture. Never imports the drop/migrate test helper.
import { getPayload } from "payload"
import { z } from "zod"
import config from "@/payload.config"
import { BuilderQuotaService, builderOperationKey } from "@/lib/builder/quota"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"

const uri = new URL(process.env.DATABASE_URI ?? "")
if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Quota worker fixture requires isolated test PG, disabled jobs and mock Sitegen")
const mode = z.enum(["reserve", "reconcile"]).parse(process.argv[2])
const email = z.email().parse(process.argv[3]), operationId = z.uuid().parse(process.argv[4])
const payload = await getPayload({ config })
const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, enabled: true, operationTimeoutMs: 2000 })
const eligible = async () => undefined
const emit = (data: unknown) => process.stdout.write(`quota-worker:${JSON.stringify(data)}\n`)

if (mode === "reserve") {
  const admission = await service.reserve(email, { operationId, message: "Synthetic worker restart fixture" }, eligible)
  if (admission.status !== "reserved") throw new Error("Expected fresh worker reservation")
  await service.claim(admission.lease, eligible)
  const execution = new ReservedBuilderExecution(service, admission.lease, eligible)
  // A pure never-resolving IO fixture represents a remote request whose
  // completion cannot be inferred from local process death. No paid API IO.
  void execution.modelCall({ model: "openai/gpt-5.6-luna", reasoningEffort: "low", inputBytes: 100, maxOutputTokens: 100, maxSteps: 1 }, () => {
    emit({ phase: "dispatched", operationKey: admission.lease.operationKey })
    return new Promise<string>(() => undefined)
  }, () => null).catch(() => undefined)
  setInterval(() => undefined, 1000)
} else {
  const key = builderOperationKey(email, operationId), before = await service.operation(key)
  if (!before) throw new Error("Missing durable crashed-worker operation")
  const waitMs = Math.max(0, Date.parse(before.deadlineAt) - Date.now() + 20)
  if (waitMs > 2200) throw new Error("Worker fixture deadline outside its expected bound")
  if (waitMs) await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
  const first = await service.reconcile(20), second = await service.reconcile(20)
  const operation = await service.operation(key), account = await service.account(email), global = await service.global()
  emit({ phase: "reconciled", first, second, operation, account, global })
  await payload.destroy()
}
