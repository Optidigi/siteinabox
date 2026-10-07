import { describe, expect, it, vi } from "vitest"

import { createGeneratedPayloadStore, type GeneratedFixtureCollections } from "../_helpers/generatedPayloadStore"
import { validOrder, validPaymentAttempt } from "../_helpers/commerceBuilders"
import { createArgs } from "../_helpers/payloadApi"

describe("mutable Payload test store", () => {
  it("supports find, findByID, create and conditional optimistic updates", async () => {
    const collections: GeneratedFixtureCollections = {
      orders: [validOrder({ id: 1, state: "accepted", contractingPartyProfileVersion: 2 })],
    }
    const store = await createGeneratedPayloadStore({ collections, nextId: 2 })

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
          { contractingPartyProfileVersion: { equals: 1 } },
        ],
      },
      data: { paymentStatus: "paid", contractingPartyProfileVersion: 3 },
    })).resolves.toMatchObject({ totalDocs: 0 })
    await expect(store.update({
      collection: "orders",
      where: {
        and: [
          { id: { equals: 1 } },
          { contractingPartyProfileVersion: { equals: 2 } },
        ],
      },
      data: { paymentStatus: "paid", contractingPartyProfileVersion: 3 },
    })).resolves.toMatchObject({ totalDocs: 1 })
    await expect(store.create(createArgs("orders", validOrder({ id: 2, state: "accepted", contractingPartyProfileVersion: 1 })))).resolves.toMatchObject({ id: 2 })
  })

  it("injects a race before enforcing a configured unique tuple", async () => {
    const beforeCreate = vi.fn((
      _args: unknown,
      collections: GeneratedFixtureCollections,
    ) => {
      collections["payment-attempts"]!.push(validPaymentAttempt({
        id: 9,
        order: 1,
        purpose: "first_payment",
        attemptNumber: 1,
      }))
    })
    const store = await createGeneratedPayloadStore({
      collections: { "payment-attempts": [] },
      unique: [{
        collection: "payment-attempts",
        fields: ["order", "purpose", "attemptNumber"],
      }],
      hooks: { beforeCreate },
    })

    await expect(store.create(createArgs("payment-attempts", validPaymentAttempt({ order: 1, purpose: "first_payment", attemptNumber: 1 })))).rejects.toThrow("duplicate key")
    expect(beforeCreate).toHaveBeenCalledOnce()
  })

  it("restores collection state on explicit transaction rollback", async () => {
    const store = await createGeneratedPayloadStore({
      collections: { orders: [validOrder({ id: 1, state: "accepted" })] },
    })

    await store.beginTransaction()
    await store.update({
      collection: "orders",
      id: 1,
      data: { paymentStatus: "paid" },
    })
    await store.rollbackTransaction("test-transaction")

    expect(store.collections.orders).toEqual([validOrder({ id: 1, state: "accepted" })])
  })
})
