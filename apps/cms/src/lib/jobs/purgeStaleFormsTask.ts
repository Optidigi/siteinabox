import type { TaskConfig } from "payload"
import { purgeStaleFormSubmissions, resolveRetentionDays } from "./purgeStaleForms"

// Audit-p2 #10 (T11) — Payload task wrapper for the daily purge.
//
// Schedule: daily at 02:00 UTC. The 6-field cron format Payload v3
// expects is `<sec> <min> <hour> <dom> <mon> <dow>`. `0 0 2 * * *` =
// "second 0, minute 0, hour 2, every day". 02:00 is a low-traffic
// window for European tenants (the primary user base) — picks up the
// previous day's stragglers without colliding with the regional
// business-hours peak.
//
// `autoRun` (registered alongside in `payload.config.ts`) is what
// actually fires this; the schedule on the task only tells the
// scheduler when to enqueue a new job into the queue.

export const purgeStaleFormSubmissionsTask: TaskConfig<{
  input: Record<string, never>
  output: { deleted: number; cutoffISO: string; retentionDays: number }
}> = {
  slug: "purge-stale-form-submissions",
  label: "Purge stale form submissions (GDPR retention)",
  schedule: [{ cron: "0 0 2 * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "deleted", type: "number" },
    { name: "cutoffISO", type: "text" },
    { name: "retentionDays", type: "number" },
  ],
  handler: async ({ req }) => {
    const retentionDays = resolveRetentionDays()
    const result = await purgeStaleFormSubmissions({
      payload: req.payload,
      retentionDays,
    })
    req.payload.logger.info(
      `[purge-stale-form-submissions] deleted=${result.deleted} cutoff=${result.cutoffISO} retentionDays=${result.retentionDays}`,
    )
    return { output: result }
  },
}
