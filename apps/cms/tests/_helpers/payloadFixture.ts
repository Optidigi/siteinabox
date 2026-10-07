import type { Payload } from "payload"
import { vi } from "vitest"
import { createTestPayload } from "./testPayload"

export type PayloadFixtureMethod<K extends keyof Payload> = Payload[K] extends (...args: infer A) => infer R ? (...args: A) => R : never
type FixtureMethods = { [K in "find" | "findByID" | "create" | "update" | "count" | "delete"]?: PayloadFixtureMethod<K> }

/** Real Local API instances with only explicitly supplied, installed method contracts replaced. */
export function createPayloadFixture(methods: FixtureMethods): Payload {
  const payload = createTestPayload()
  if (methods.find) vi.spyOn(payload, "find").mockImplementation(methods.find)
  if (methods.findByID) vi.spyOn(payload, "findByID").mockImplementation(methods.findByID)
  if (methods.create) vi.spyOn(payload, "create").mockImplementation(methods.create)
  if (methods.update) vi.spyOn(payload, "update").mockImplementation(methods.update)
  if (methods.count) vi.spyOn(payload, "count").mockImplementation(methods.count)
  if (methods.delete) vi.spyOn(payload, "delete").mockImplementation(methods.delete)
  return payload
}
