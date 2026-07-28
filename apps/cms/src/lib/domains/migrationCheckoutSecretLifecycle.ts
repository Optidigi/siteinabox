import type { Payload } from "payload"

type ExpirableMigrationCheckoutSecret = {
  id: string | number
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
  for (const value of result.docs as ExpirableMigrationCheckoutSecret[]) {
    await payload.update({
      collection: "migration-checkout-secrets",
      id: value.id,
      data: {
        encryptedInput: null,
        state: "expired",
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { migrationCheckoutSecretLifecycle: true },
    })
  }
  return result.docs.length
}
