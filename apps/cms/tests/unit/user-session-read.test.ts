import { describe, expect, it } from "vitest"
import type { CollectionAfterReadHook } from "payload"
import { Users } from "@/collections/Users"
import { cast } from "../_helpers/cast"

const redact = Users.hooks?.afterRead?.[0] as CollectionAfterReadHook
const input = (api: string, overrideAccess: boolean) => cast<Parameters<CollectionAfterReadHook>[0]>({
  doc: { id: 1, name: "Synthetic user", sessions: [{ id: "existing-session" }] },
  overrideAccess,
  req: { payloadAPI: api, user: null, query: { overrideAccess: "true" }, context: { internal: true } },
})

describe("session privacy and trusted authentication lookup", () => {
  it("preserves sessions for Payload's privileged JWT lookup with REST request provenance", async () => {
    const result = await redact(input("REST", true))
    expect(result.sessions).toEqual([{ id: "existing-session" }])
  })
  it.each(["REST", "GraphQL", "unknown"])("strips sessions from %s serialization despite client-like flags", async api => {
    const result = await redact(input(api, false))
    expect(result).toEqual({ id: 1, name: "Synthetic user" })
  })
  it("retains the existing Local API behavior", async () => {
    expect((await redact(input("local", false))).sessions).toEqual([{ id: "existing-session" }])
  })
})
