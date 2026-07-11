import type { TaskConfig } from "payload"
import { processLegalRequirementNotifications } from "@/lib/jobs/sendLegalRequirementNotifications"

export const sendLegalRequirementNotificationsTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; sent: number; failed: number; skipped: number }
}> = {
  slug: "send-legal-requirement-notifications",
  label: "Send legal reacceptance notifications",
  schedule: [{ cron: "0 */5 * * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "examined", type: "number" },
    { name: "sent", type: "number" },
    { name: "failed", type: "number" },
    { name: "skipped", type: "number" },
  ],
  handler: async ({ req }) => {
    try {
      const { syncLegalDocuments } = await import("@/lib/legal/legalDocuments")
      await syncLegalDocuments({
        payload: req.payload,
        sourceCommit: process.env.SIAB_GIT_SHA,
        manifestUrl: process.env.SIAB_LEGAL_MANIFEST_URL || null,
      })
    } catch (error) {
      req.payload.logger.error(`[legal-notifications] legal release sync retry failed: ${error instanceof Error ? error.message : "unknown error"}`)
    }
    const result = await processLegalRequirementNotifications({ payload: req.payload, limit: 100 })
    req.payload.logger.info(`[legal-notifications] examined=${result.examined} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`)
    return { output: result }
  },
}
