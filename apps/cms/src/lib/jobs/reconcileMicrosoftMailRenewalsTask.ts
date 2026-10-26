import type { TaskConfig } from "payload"

export const reconcileMicrosoftMailRenewalsTask: TaskConfig<{ input: Record<string, never>; output: { examined: number } }> = {
  slug: "reconcile-microsoft-mail-renewals", label: "Reconcile prepaid email renewals",
  schedule: [{ cron: "0 0 * * * *", queue: "default" }], retries: 0,
  concurrency: { key: () => "reconcile-microsoft-mail-renewals", exclusive: true, supersedes: true },
  inputSchema: [], outputSchema: [{ name: "examined", type: "number", required: true }],
  handler: async ({ req }) => { const { reconcileMicrosoftMailRenewals } = await import("@/lib/microsoftMailProvisioning/renewal"); return { output: await reconcileMicrosoftMailRenewals(req.payload) } },
}
