import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"

type ExpirableMigrationCheckoutSecret = {
  id: string | number
  state: "pending_order" | "attached"
  generationRun: Parameters<typeof relationshipId>[0]
  domainNameAscii: string
  encryptedInput: string | null
  expiresAt: string
  updatedAt: string
}

export async function expireStaleMigrationCheckoutSecrets(
  payload: Payload,
  now = new Date(),
): Promise<number> {
  const result = await payload.find({
    collection: "migration-checkout-secrets",
    where: {
      and: [
        { state: { in: ["pending_order", "attached"] } },
        { expiresAt: { less_than_equal: now.toISOString() } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  let expired = 0
  for (const value of result.docs as ExpirableMigrationCheckoutSecret[]) {
    if (value.encryptedInput) {
      const generationRunId = relationshipId(value.generationRun)
      if (generationRunId) {
        try {
          const [
            { openCheckoutMigrationInput },
            { revokeCloudflareSourceAuthorization },
          ] = await Promise.all([
            import("@/lib/domains/migrationSecrets"),
            import("@/lib/domains/cloudflareSourceOAuth"),
          ])
          const opened = openCheckoutMigrationInput(
            value.encryptedInput,
            generationRunId,
            value.domainNameAscii,
          )
          if (
            opened.schemaVersion === 2 &&
            opened.sourceRefreshCredential.kind === "cloudflare_oauth"
          ) {
            await revokeCloudflareSourceAuthorization(
              payload,
              opened.sourceRefreshCredential,
              { now },
            )
          }
        } catch {
          // The encrypted checkout authority is cleared below. Any delegated
          // grant remains durably owned by its authorization record and its
          // cleanup job continues bounded revocation retries.
        }
      }
    }
    const update = await payload.update({
      collection: "migration-checkout-secrets",
      where: {
        and: [
          { id: { equals: value.id } },
          { state: { equals: value.state } },
          { updatedAt: { equals: value.updatedAt } },
          { expiresAt: { equals: value.expiresAt } },
          { expiresAt: { less_than_equal: now.toISOString() } },
        ],
      },
      data: {
        encryptedInput: null,
        state: "expired",
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { migrationCheckoutSecretLifecycle: true },
    })
    if (Array.isArray(update.docs) && update.docs.length === 1) expired += 1
  }
  return expired
}
