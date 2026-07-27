import type { Payload, TaskConfig } from "payload"

export const queueDomainMigrationPreparation = (
  payload: Payload,
  migrationId: string | number,
) => payload.jobs.queue({
  task: "prepare-domain-migration",
  input: { migrationId: String(migrationId) },
  queue: "default",
  overrideAccess: true,
})

export const prepareDomainMigrationTask: TaskConfig<{
  input: { migrationId: string }
  output: { status: string; migrationId: string; message: string }
}> = {
  slug: "prepare-domain-migration",
  label: "Prepare and execute an automatic domain migration",
  concurrency: {
    key: ({ input }) => `prepare-domain-migration:${input.migrationId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  inputSchema: [{ name: "migrationId", type: "text", required: true }],
  outputSchema: [
    { name: "status", type: "text", required: true },
    { name: "migrationId", type: "text", required: true },
    { name: "message", type: "text", required: true },
  ],
  handler: async ({ input, req }) => {
    const { commerceProviderWritesAllowed } = await import(
      "@/lib/commerce/releaseGate"
    )
    if (!commerceProviderWritesAllowed()) {
      return {
        output: {
          status: "release_blocked",
          migrationId: input.migrationId,
          message: "Domain migration provider writes are blocked by the staged release gate.",
        },
      }
    }
    const { prepareDomainMigration } = await import("@/lib/domains/migration")
    const result = await prepareDomainMigration(req.payload, input.migrationId)
    return {
      output: {
        status: result.status,
        migrationId: String(result.migrationId),
        message: result.message,
      },
    }
  },
}
