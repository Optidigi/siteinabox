import type { Payload, CollectionSlug, RequiredDataFromCollectionSlug } from "payload"
declare const payload: Payload
type UpdateOptions<C extends CollectionSlug> = Parameters<typeof payload.update<C, never>>[0]

type CreateExtra = Pick<Parameters<Payload["create"]>[0], "depth" | "overrideAccess" | "context" | "req" | "user">
type UpdateExtra<C extends CollectionSlug> = Omit<UpdateOptions<C>, "collection" | "id" | "data" | "where" | "draft">

export function createArgs<C extends CollectionSlug>(collection: C, data: RequiredDataFromCollectionSlug<NoInfer<C>>, extra: CreateExtra = {}) {
  return { collection, data, ...extra }
}

export function updateArgs<C extends CollectionSlug>(collection: C, id: string | number, data: UpdateOptions<NoInfer<C>>["data"], extra: UpdateExtra<C> = {}) {
  return { collection, id, data, ...extra }
}

export function relationId(doc: { id: string | number }): number {
  return typeof doc.id === "number" ? doc.id : Number(doc.id)
}

export function asDocRecord<T extends object>(value: T): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const key of Object.keys(value)) {
    const field: unknown = Reflect.get(value, key)
    record[key] = field
  }
  return record
}
