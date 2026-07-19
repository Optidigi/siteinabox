import type { PayloadLikeFindClient } from "@/lib/queries/paginate"

export function asFindClient<T extends { find: (...args: never[]) => unknown }>(value: T): PayloadLikeFindClient {
  return value as unknown as PayloadLikeFindClient
}
