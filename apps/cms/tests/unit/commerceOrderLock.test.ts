import { describe, expect, it, vi } from "vitest"

import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { asPayload } from "../_helpers/mockPayload"

describe("commerce order advisory lock", () => {
  it("fails closed when the dedicated lock pool cannot provide a client", async () => {
    const connectionError = new Error("simulated lock pool saturation")
    const pool = {
      connect: vi.fn(async () => {
        throw connectionError
      }),
    }

    await expect(withCommerceOrderLock(
      asPayload({}),
      41,
      async () => "must not run",
      pool,
    )).rejects.toThrow("simulated lock pool saturation")
  })

  it("evicts and releases the checked-out client when unlock fails", async () => {
    const unlockError = new Error("simulated advisory unlock failure")
    const release = vi.fn()
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockRejectedValueOnce(unlockError)
    const payload = asPayload({
      db: {},
    })
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    }

    await expect(withCommerceOrderLock(
      payload,
      42,
      async () => "completed",
      pool,
    )).rejects.toThrow("simulated advisory unlock failure")

    expect(release).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledWith(unlockError)
  })
})
