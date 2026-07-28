import type { Payload } from "payload"

type ExpirableMigrationCheckoutSecret = {
  id: string | number
  state: "pending_order" | "attached"
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
