import type { Payload, TaskConfig } from "payload"

export const queueDomainRenewal = (
  payload: Payload,
  managedDomainId: string | number,
) => payload.jobs.queue({
  task: "renew-domain",
  input: { managedDomainId: String(managedDomainId) },
  queue: "default",
  overrideAccess: true,
})

export const renewDomainTask: TaskConfig<{
  input: { managedDomainId: string }
  output: { status: string; managedDomainId: string; cycleId: string }
}> = {
  slug: "renew-domain",
  label: "Reconcile and renew a managed domain",
  concurrency: {
    key: ({ input }) => `renew-domain:${input.managedDomainId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  inputSchema: [{ name: "managedDomainId", type: "text", required: true }],
  outputSchema: [
    { name: "status", type: "text", required: true },
    { name: "managedDomainId", type: "text", required: true },
    { name: "cycleId", type: "text", required: true },
  ],
  handler: async ({ input, req }) => {
    const { reconcileManagedDomainRenewal } = await import("@/lib/domains/renewal")
    const result = await reconcileManagedDomainRenewal(req.payload, input.managedDomainId)
    return {
      output: {
        status: result.status,
        managedDomainId: input.managedDomainId,
        cycleId: result.cycleId == null ? "" : String(result.cycleId),
      },
    }
  },
}
