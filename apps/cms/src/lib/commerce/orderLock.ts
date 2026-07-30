import "server-only"

import { createHash } from "node:crypto"
import { Pool, type PoolClient } from "pg"
import type { Payload } from "payload"

const COMMERCE_ORDER_LOCK_NAMESPACE = 0x5349_4142
const DEFAULT_COMMERCE_ORDER_LOCK_POOL_MAX = 4
const COMMERCE_ORDER_LOCK_TIMEOUT_MS = 30_000
const COMMERCE_ORDER_LOCK_RETRY_MS = 25

type CommerceOrderLockPool = {
  connect: () => Promise<Pick<PoolClient, "query" | "release">>
}

let orderLockPool: Pool | undefined

const lockPool = (): CommerceOrderLockPool => {
  if (orderLockPool) return orderLockPool
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) {
    throw new Error("DATABASE_URI is required for commerce order locking.")
  }
  orderLockPool = new Pool({
    connectionString,
    max: DEFAULT_COMMERCE_ORDER_LOCK_POOL_MAX,
    application_name: "siteinabox-commerce-order-lock",
    allowExitOnIdle: true,
    connectionTimeoutMillis: COMMERCE_ORDER_LOCK_TIMEOUT_MS,
  })
  return orderLockPool
}

const advisoryKey = (orderId: string | number): number =>
  createHash("sha256")
    .update(String(orderId))
    .digest()
    .readInt32BE(0)

export async function withCommerceOrderLock<T>(
  _payload: Payload,
  orderId: string | number,
  operation: () => Promise<T>,
  pool: CommerceOrderLockPool = lockPool(),
): Promise<T> {
  const key = advisoryKey(orderId)
  const deadline = Date.now() + COMMERCE_ORDER_LOCK_TIMEOUT_MS

  while (true) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for commerce order lock ${orderId}.`)
    }
    const client = await pool.connect()
    let locked = false
    let released = false
    try {
      const result = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
        [COMMERCE_ORDER_LOCK_NAMESPACE, key],
      )
      locked = result.rows[0]?.acquired === true
      if (!locked) {
        client.release()
        released = true
        if (Date.now() >= deadline) {
          throw new Error(`Timed out waiting for commerce order lock ${orderId}.`)
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, COMMERCE_ORDER_LOCK_RETRY_MS)
        })
        continue
      }

      try {
        return await operation()
      } finally {
        let unlockError: Error | undefined
        try {
          await client.query(
            "SELECT pg_advisory_unlock($1::integer, $2::integer)",
            [COMMERCE_ORDER_LOCK_NAMESPACE, key],
          )
        } catch (error) {
          unlockError = error instanceof Error
            ? error
            : new Error("Commerce order advisory unlock failed.")
          throw unlockError
        } finally {
          client.release(unlockError)
        }
      }
    } catch (error) {
      if (!locked && !released) {
        client.release(error instanceof Error ? error : undefined)
      }
      throw error
    }
  }
}
