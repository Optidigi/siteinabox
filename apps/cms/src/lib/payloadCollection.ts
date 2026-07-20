import type { Payload, PayloadRequest, Where } from "payload"
import type { Config } from "@/payload-types"

export type CollectionSlug = keyof Config["collections"]
export type CollectionDoc<T extends CollectionSlug> = Config["collections"][T]

export async function findOneDoc<T extends CollectionSlug>(
  payload: Payload,
  collection: T,
  where: Where,
  req?: Partial<PayloadRequest>,
): Promise<CollectionDoc<T> | null> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true, req })
  return (result.docs[0] as CollectionDoc<T> | undefined) ?? null
}
