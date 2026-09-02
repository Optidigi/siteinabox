import type { TaskConfig } from "payload"

export const processAppointmentNotificationsTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; sent: number; failed: number; skipped: number; templateVersion: string }
}> = {
  slug: "process-appointment-notifications",
  label: "Process appointment email notifications",
  schedule: [{ cron: "0 */5 * * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "examined", type: "number" },
    { name: "sent", type: "number" },
    { name: "failed", type: "number" },
    { name: "skipped", type: "number" },
    { name: "templateVersion", type: "text" },
  ],
  handler: async ({ req }) => {
    const { processAppointmentNotifications } = await import("@/lib/jobs/appointmentNotifications")
    const result = await processAppointmentNotifications({ payload: req.payload, limit: 100 })
    req.payload.logger.info(`[appointment-notifications] examined=${result.examined} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`)
    return { output: result }
  },
}
