import type { Payload } from "payload"
import type { CollectionSlug, DataFromCollectionSlug } from "payload"

export function createArgs<C extends CollectionSlug>(
  collection: C,
  data: Record<string, unknown>,
  extra: Omit<Parameters<Payload["create"]>[0], "collection" | "data"> = {},
): Parameters<Payload["create"]>[0] {
  return { collection, data: data as unknown as DataFromCollectionSlug<C>, ...extra } as Parameters<Payload["create"]>[0]
}

export function updateArgs<C extends CollectionSlug>(
  collection: C,
  id: string | number,
  data: Record<string, unknown>,
  extra: Omit<Parameters<Payload["update"]>[0], "collection" | "id" | "data"> = {},
): Parameters<Payload["update"]>[0] {
  return { collection, id, data: data as unknown as Partial<DataFromCollectionSlug<C>>, ...extra } as Parameters<Payload["update"]>[0]
}

export function relationId(doc: { id: string | number }): number {
  return typeof doc.id === "number" ? doc.id : Number(doc.id)
}

export function asDocRecord<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>
}

export function createArgsLoose<C extends CollectionSlug>(
  collection: C,
  data: Record<string, unknown>,
  extra: Omit<Parameters<Payload["create"]>[0], "collection" | "data"> = {},
): Parameters<Payload["create"]>[0] {
  return createArgs(collection, data, extra)
}
