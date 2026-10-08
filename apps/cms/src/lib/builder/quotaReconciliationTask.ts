import type { TaskConfig } from "payload"

export const reconcileBuilderOperationsTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; settled: number; quarantined: number }
}> = {
  slug: "reconcile-builder-operations",
  label: "Reconcile interrupted builder operations",
  concurrency: { key: () => "reconcile-builder-operations", exclusive: true, supersedes: true },
  schedule: [{ cron: "0 * * * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "examined", type: "number", required: true },
    { name: "settled", type: "number", required: true },
    { name: "quarantined", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const { BuilderQuotaService } = await import("./quota")
    const result = await new BuilderQuotaService(req.payload).reconcile(20)
    if (result.quarantined) req.payload.logger.warn(`[builder-quota] quarantined=${result.quarantined}; provider completion proof required before releasing technical slots`)
    return { output: result }
  },
}
