import type { TaskConfig } from "payload"

export const purgeExpiredCheckoutProgressDraftsTask: TaskConfig<{
  input: Record<string, never>
  output: { deleted: number; cutoffISO: string }
}> = {
  slug: "purge-expired-checkout-progress-drafts",
  label: "Purge expired checkout progress drafts",
  schedule: [{ cron: "0 15 2 * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "deleted", type: "number", required: true },
    { name: "cutoffISO", type: "text", required: true },
  ],
  handler: async ({ req }) => {
    const { purgeExpiredCheckoutProgressDrafts } = await import(
      "@/lib/checkout/checkoutProgress"
    )
    const result = await purgeExpiredCheckoutProgressDrafts({ payload: req.payload })
    req.payload.logger.info(
      `[purge-expired-checkout-progress-drafts] deleted=${result.deleted} cutoff=${result.cutoffISO}`,
    )
    return { output: result }
  },
}
