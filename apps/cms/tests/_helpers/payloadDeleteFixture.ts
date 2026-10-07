import type { Payload } from "payload"

type DeleteOverloads = Payload["delete"] extends {
  (...args: infer OneArgs): infer OneResult
  (...args: infer ManyArgs): infer ManyResult
} ? { oneArgs: OneArgs; oneResult: OneResult; manyArgs: ManyArgs; manyResult: ManyResult } : never
export type PayloadDeleteOptions = DeleteOverloads["oneArgs"][0] | DeleteOverloads["manyArgs"][0]
type DeleteOutcome = Awaited<DeleteOverloads["oneResult"] | DeleteOverloads["manyResult"]>

/** Preserve both installed overloads; model each collection's real where/id response. */
export function payloadDeleteFixture(handler: (options: PayloadDeleteOptions) => Promise<DeleteOutcome>) {
  function remove(...args: DeleteOverloads["oneArgs"]): DeleteOverloads["oneResult"]
  function remove(...args: DeleteOverloads["manyArgs"]): DeleteOverloads["manyResult"]
  function remove(options: PayloadDeleteOptions): Promise<DeleteOutcome> { return handler(options) }
  return remove
}
