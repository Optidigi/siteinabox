import { describe, expect, it, vi } from "vitest"

import {
  createMutablePayloadStore,
  type MockDoc,
} from "../_helpers/mockPayload"

describe("mutable Payload test store", () => {
  it("supports find, findByID, create and conditional optimistic updates", async () => {
    const collections: Record<string, MockDoc[]> = {
      orders: [{ id: 1, state: "accepted", version: 2 }],
    }
    const store = createMutablePayloadStore({ collections, nextId: 2 })

    await expect(store.find({
      collection: "orders",
      where: { state: { equals: "accepted" } },
    })).resolves.toMatchObject({ totalDocs: 1 })
    await expect(store.findByID({
      collection: "orders",
      id: 1,
    })).resolves.toMatchObject({ state: "accepted" })
    await expect(store.update({
      collection: "orders",
      where: {
        and: [
          { id: { equals: 1 } },
          { version: { equals: 1 } },
        ],
      },
      data: { state: "paid", version: 3 },
    })).resolves.toMatchObject({ totalDocs: 0 })
    await expect(store.update({
      collection: "orders",
      where: {
        and: [
          { id: { equals: 1 } },
          { version: { equals: 2 } },
        ],
      },
      data: { state: "paid", version: 3 },
    })).resolves.toMatchObject({ totalDocs: 1 })
    await expect(store.create({
      collection: "orders",
      data: { state: "accepted", version: 1 },
    })).resolves.toMatchObject({ id: 2 })
  })

  it("injects a race before enforcing a configured unique tuple", async () => {
    const beforeCreate = vi.fn((
      _args: unknown,
      collections: Record<string, MockDoc[]>,
    ) => {
      collections["payment-attempts"]!.push({
        id: 9,
        order: 1,
        purpose: "first_payment",
        attemptNumber: 1,
      })
    })
    const store = createMutablePayloadStore({
      collections: { "payment-attempts": [] },
      unique: [{
        collection: "payment-attempts",
        fields: ["order", "purpose", "attemptNumber"],
      }],
      hooks: { beforeCreate },
    })

    await expect(store.create({
      collection: "payment-attempts",
      data: {
        order: 1,
        purpose: "first_payment",
        attemptNumber: 1,
      },
    })).rejects.toThrow("duplicate key")
    expect(beforeCreate).toHaveBeenCalledOnce()
  })

  it("restores collection state on explicit transaction rollback", async () => {
    const store = createMutablePayloadStore({
      collections: { orders: [{ id: 1, state: "accepted" }] },
    })

    await store.beginTransaction()
    await store.update({
      collection: "orders",
      id: 1,
      data: { state: "paid" },
    })
    await store.rollbackTransaction()

    expect(store.collections.orders).toEqual([{ id: 1, state: "accepted" }])
  })
})
