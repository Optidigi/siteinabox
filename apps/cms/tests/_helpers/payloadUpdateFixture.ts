import type { Payload } from "payload"

// Extract both installed Local API overloads instead of replacing them with a generic document API.
type UpdateOverloads = Payload["update"] extends {
  (...args: infer ManyArgs): infer ManyResult
  (...args: infer OneArgs): infer OneResult
} ? { manyArgs: ManyArgs; manyResult: ManyResult; oneArgs: OneArgs; oneResult: OneResult } : never
export type PayloadUpdateOptions = UpdateOverloads["manyArgs"][0] | UpdateOverloads["oneArgs"][0]
type UpdateOutcome = Awaited<UpdateOverloads["manyResult"] | UpdateOverloads["oneResult"]>

/** Handlers must preserve the installed where/id return shape for the collections they model. */
export function payloadUpdateFixture(handler: (options: PayloadUpdateOptions) => Promise<UpdateOutcome>) {
  function update(...args: UpdateOverloads["manyArgs"]): UpdateOverloads["manyResult"]
  function update(...args: UpdateOverloads["oneArgs"]): UpdateOverloads["oneResult"]
  function update(options: PayloadUpdateOptions): Promise<UpdateOutcome> { return handler(options) }
  return update
}
