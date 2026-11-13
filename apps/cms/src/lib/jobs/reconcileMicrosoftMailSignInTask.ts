import type { TaskConfig } from "payload"

export const reconcileMicrosoftMailSignInTask: TaskConfig<{ input: Record<string, never>; output: { examined: number; changed: number } }> = {
  slug: "reconcile-microsoft-mail-sign-in", label: "Apply and monitor email sign-in settings",
  schedule: [{ cron: "0 */10 * * * *", queue: "default" }], retries: 0,
  concurrency: { key: () => "reconcile-microsoft-mail-sign-in", exclusive: true, supersedes: true },
  inputSchema: [], outputSchema: [{ name: "examined", type: "number", required: true }, { name: "changed", type: "number", required: true }],
  handler: async ({ req }) => { const { reconcileMicrosoftMailSignInPolicies } = await import("@/lib/microsoftMailProvisioning/signInPolicyReconcile"); return { output: await reconcileMicrosoftMailSignInPolicies(req.payload) } },
}
