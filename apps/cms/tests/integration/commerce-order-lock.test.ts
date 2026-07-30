import { beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import { Pool } from "pg"

import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { getTestPayload } from "./_helpers"

let payload: Payload

beforeAll(async () => {
  payload = await getTestPayload()
}, 30_000)

describe("commerce order advisory lock", () => {
  it("serializes reversal and activation work for one order", async () => {
    const events: string[] = []
    let releaseReversal!: () => void
    let reversalLocked!: () => void
    const reversalHasLock = new Promise<void>((resolve) => {
      reversalLocked = resolve
    })
    const reversalMayFinish = new Promise<void>((resolve) => {
      releaseReversal = resolve
    })

    const reversal = withCommerceOrderLock(payload, 91_001, async () => {
      events.push("reversal:locked")
      reversalLocked()
      await reversalMayFinish
      events.push("reversal:committed")
    })
    await reversalHasLock
    const activation = withCommerceOrderLock(payload, 91_001, async () => {
      events.push("activation:locked")
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(events).toEqual(["reversal:locked"])

    releaseReversal()
    await Promise.all([reversal, activation])
    expect(events).toEqual([
      "reversal:locked",
      "reversal:committed",
      "activation:locked",
    ])
  })

  it("lets a post-activation reversal acquire the same order lock only afterward", async () => {
    const events: string[] = []
    let releaseActivation!: () => void
    let activationLocked!: () => void
    const activationHasLock = new Promise<void>((resolve) => {
      activationLocked = resolve
    })
    const activationMayFinish = new Promise<void>((resolve) => {
      releaseActivation = resolve
    })

    const activation = withCommerceOrderLock(payload, 91_002, async () => {
      events.push("activation:locked")
      activationLocked()
      await activationMayFinish
      events.push("activation:committed")
    })
    await activationHasLock
    const reversal = withCommerceOrderLock(payload, 91_002, async () => {
      events.push("reversal:locked")
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(events).toEqual(["activation:locked"])

    releaseActivation()
    await Promise.all([activation, reversal])
    expect(events).toEqual([
      "activation:locked",
      "activation:committed",
      "reversal:locked",
    ])
  })

  it("does not deadlock when lock waiters outnumber a saturated application pool", async () => {
    const connectionString = process.env.DATABASE_URI
    expect(connectionString).toBeTruthy()
    const applicationPool = new Pool({ connectionString, max: 2 })
    const dedicatedLockPool = new Pool({ connectionString, max: 2 })
    const events: string[] = []
    let releaseFirst!: () => void
    let firstLocked!: () => void
    const firstHasLock = new Promise<void>((resolve) => {
      firstLocked = resolve
    })
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    try {
      const first = withCommerceOrderLock(payload, 91_003, async () => {
        events.push("first:locked")
        firstLocked()
        const client = await applicationPool.connect()
        client.release()
        await firstMayFinish
        events.push("first:completed")
      }, dedicatedLockPool)
      await firstHasLock

      const sameOrderWaiter = withCommerceOrderLock(payload, 91_003, async () => {
        const client = await applicationPool.connect()
        client.release()
        events.push("same-order:completed")
      }, dedicatedLockPool)
      const otherOrder = withCommerceOrderLock(payload, 91_004, async () => {
        const [firstClient, secondClient] = await Promise.all([
          applicationPool.connect(),
          applicationPool.connect(),
        ])
        firstClient.release()
        secondClient.release()
        events.push("other-order:completed")
      }, dedicatedLockPool)

      await expect(Promise.race([
        otherOrder.then(() => "completed"),
        new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 2_000)),
      ])).resolves.toBe("completed")
      releaseFirst()
      await Promise.all([first, sameOrderWaiter])
      expect(events).toEqual([
        "first:locked",
        "other-order:completed",
        "first:completed",
        "same-order:completed",
      ])
    } finally {
      await Promise.all([applicationPool.end(), dedicatedLockPool.end()])
    }
  }, 10_000)
})
