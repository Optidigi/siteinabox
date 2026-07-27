import type { Payload, TaskConfig } from "payload"

export const queueDomainTransferOutPreparation = (
  payload: Payload,
  managedDomainId: string | number,
) => payload.jobs.queue({
  task: "prepare-domain-transfer-out",
  input: { managedDomainId: String(managedDomainId) },
  queue: "default",
  overrideAccess: true,
})

export const prepareDomainTransferOutTask: TaskConfig<{
  input: { managedDomainId: string }
  output: { status: string; managedDomainId: string }
}> = {
  slug: "prepare-domain-transfer-out",
  label: "Prepare an authorized customer domain transfer-out",
  concurrency: {
    key: ({ input }) => `prepare-domain-transfer-out:${input.managedDomainId}`,
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
  ],
  handler: async ({ input, req }) => {
    const { prepareDomainTransferOutCode } = await import("@/lib/domains/offboarding")
    const domain = await prepareDomainTransferOutCode(
      req.payload,
      input.managedDomainId,
    )
    return {
      output: {
        status: domain.custodyStatus,
        managedDomainId: input.managedDomainId,
      },
    }
  },
}
