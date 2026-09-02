import type { TaskConfig } from "payload"

export const purgeStaleAppointmentsTask: TaskConfig<{
  input: Record<string, never>
  output: { appointmentsDeleted: number; oauthStatesDeleted: number; tenantsExamined: number; tenantsSkipped: number; nowISO: string }
}> = {
  slug: "purge-stale-appointments",
  label: "Purge stale appointment records",
  schedule: [{ cron: "0 30 2 * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "appointmentsDeleted", type: "number" },
    { name: "oauthStatesDeleted", type: "number" },
    { name: "tenantsExamined", type: "number" },
    { name: "tenantsSkipped", type: "number" },
    { name: "nowISO", type: "text" },
  ],
  handler: async ({ req }) => {
    const { purgeStaleAppointments } = await import("@/lib/jobs/purgeStaleAppointments")
    const result = await purgeStaleAppointments({ payload: req.payload })
    req.payload.logger.info(`[purge-stale-appointments] appointmentsDeleted=${result.appointmentsDeleted} oauthStatesDeleted=${result.oauthStatesDeleted} tenantsExamined=${result.tenantsExamined} tenantsSkipped=${result.tenantsSkipped}`)
    return { output: result }
  },
}
