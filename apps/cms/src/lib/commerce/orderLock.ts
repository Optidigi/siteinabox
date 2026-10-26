import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
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

type LockSession = { pool: CommerceOrderLockPool; client: Pick<PoolClient, "query" | "release">; active: boolean; broken?: Error }
const lockSession = new AsyncLocalStorage<LockSession>()
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
  // Nested service/order/run/token locks share one PostgreSQL session. Holding
  // another pool connection per level can deadlock independent customer jobs.
  const inherited = lockSession.getStore()
  if (inherited?.active && inherited.pool === pool) return acquireOnSession(inherited, orderId, operation)
  const deadline = Date.now() + COMMERCE_ORDER_LOCK_TIMEOUT_MS
  // Do not occupy a scarce connection while waiting for another root's lock.
  while (Date.now() < deadline) {
    const client = await pool.connect()
    const session: LockSession = { pool, client, active: true }
    let acquired = false
    try {
      const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired", [COMMERCE_ORDER_LOCK_NAMESPACE, advisoryKey(orderId)])
      acquired = result.rows[0]?.acquired === true
      if (acquired) return await lockSession.run(session, async () => {
        try { return await operation() }
        finally { await releaseSessionLock(session, orderId) }
      })
    } finally { session.active = false; client.release(session.broken) }
    await new Promise<void>(resolve => setTimeout(resolve, COMMERCE_ORDER_LOCK_RETRY_MS))
  }
  throw new Error(`Timed out waiting for commerce order lock ${orderId}.`)
}

async function acquireOnSession<T>(session: LockSession, orderId: string | number, operation: () => Promise<T>): Promise<T> {
  const key = advisoryKey(orderId)
  const deadline = Date.now() + COMMERCE_ORDER_LOCK_TIMEOUT_MS
  let acquired = false
  try {
    while (!acquired) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for commerce order lock ${orderId}.`)
      const result = await session.client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired", [COMMERCE_ORDER_LOCK_NAMESPACE, key])
      acquired = result.rows[0]?.acquired === true
      if (!acquired) await new Promise<void>(resolve => setTimeout(resolve, COMMERCE_ORDER_LOCK_RETRY_MS))
    }
    return await operation()
  } finally { if (acquired) await releaseSessionLock(session, orderId) }
}

async function releaseSessionLock(session: LockSession, orderId: string | number) {
  try { await session.client.query("SELECT pg_advisory_unlock($1::integer, $2::integer)", [COMMERCE_ORDER_LOCK_NAMESPACE, advisoryKey(orderId)]) }
  catch (error) {
    session.broken = error instanceof Error ? error : new Error("Commerce order advisory unlock failed.")
    throw session.broken
  }
}
