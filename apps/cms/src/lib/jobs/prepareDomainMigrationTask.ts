import type { Payload, TaskConfig } from "payload"
import type { DomainMigration } from "@/payload-types"

export const migrationRequiresSafetyContinuation = (
  migration: Pick<
    DomainMigration,
    | "cloudflareZoneState"
    | "providerTransferState"
    | "cutoverWriteState"
    | "rollbackWriteState"
    | "dnssecPhase"
    | "dnssecWriteState"
  >,
): boolean =>
  migration.cloudflareZoneState !== "not_started" ||
  migration.providerTransferState !== "not_started" ||
  migration.cutoverWriteState !== "not_started" ||
  migration.rollbackWriteState !== "not_started" ||
  migration.dnssecWriteState !== "not_started" ||
  !["source_unsigned", "source_secure_preserved"].includes(migration.dnssecPhase)

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
      const migration = await req.payload.findByID({
        collection: "domain-migrations",
        id: input.migrationId,
        depth: 0,
        overrideAccess: true,
      }) as DomainMigration
      if (migrationRequiresSafetyContinuation(migration)) {
        const { prepareDomainMigration } = await import("@/lib/domains/migration")
        const result = await prepareDomainMigration(
          req.payload,
          input.migrationId,
          { forwardProviderWritesAllowed: () => false },
        )
        return {
          output: {
            status: result.status,
            migrationId: String(result.migrationId),
            message: result.message,
          },
        }
      }
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
