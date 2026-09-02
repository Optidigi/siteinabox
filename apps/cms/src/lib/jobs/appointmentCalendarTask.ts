import type { TaskConfig } from "payload"

export const processAppointmentCalendarEventsTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; synced: number; failed: number; skipped: number }
}> = {
  slug: "process-appointment-calendar-events",
  label: "Synchronise appointment calendar events",
  schedule: [{ cron: "0 */2 * * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "examined", type: "number" },
    { name: "synced", type: "number" },
    { name: "failed", type: "number" },
    { name: "skipped", type: "number" },
  ],
  handler: async ({ req }) => {
    const { processAppointmentCalendarEvents } = await import("@/lib/appointments/calendar")
    const result = await processAppointmentCalendarEvents({ payload: req.payload, limit: 100 })
    req.payload.logger.info(`[appointment-calendar] examined=${result.examined} synced=${result.synced} failed=${result.failed} skipped=${result.skipped}`)
    return { output: result }
  },
}
