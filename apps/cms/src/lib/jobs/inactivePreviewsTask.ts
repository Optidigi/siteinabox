import type { TaskConfig } from "payload"

export const inactivePreviewsTask: TaskConfig<{
  input: { afterId?: number }
  output: { examined: number; notices: number; expired: number; unknown: number; nextAfterId: number | null }
}> = {
  slug: "inactive-previews", label: "Review inactive unpaid previews",
  schedule: [{ cron: "0 30 2 * * *", queue: "default" }],
  inputSchema: [{ name: "afterId", type: "number", min: 0 }],
  outputSchema: [
    ...["examined", "notices", "expired", "unknown"].map((name) => ({ name, type: "number" as const, required: true })),
    { name: "nextAfterId", type: "number" },
  ],
  handler: async ({ req, input }) => {
    const { processInactivePreviews } = await import("@/lib/preview/inactivePreviews")
    const result = await processInactivePreviews(req.payload, { afterId: input.afterId })
    if (result.nextAfterId !== null) await req.payload.jobs.queue({ task: "inactive-previews", input: { afterId: result.nextAfterId } })
    return { output: result }
  },
}
