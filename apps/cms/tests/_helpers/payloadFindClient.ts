import type { CollectionSlug, DataFromCollectionSlug, PaginatedDocs } from "payload"
import type { PayloadFindArgs, PayloadFindClient } from "@/lib/queries/paginate"

/** Each fixture handler must return the generated document for its collection. */
export function createFindClient<C extends CollectionSlug>(handlers: {
  [S in C]: (args: PayloadFindArgs<S>) => Promise<PaginatedDocs<DataFromCollectionSlug<S>>>
}): PayloadFindClient<C> {
  return {
    find<S extends C>(args: PayloadFindArgs<S>) {
      return handlers[args.collection](args)
    },
  }
}
