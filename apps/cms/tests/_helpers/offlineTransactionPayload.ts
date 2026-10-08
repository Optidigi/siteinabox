import { NodePgSession, NodePgTransaction } from "drizzle-orm/node-postgres"
import { PgDialect } from "drizzle-orm/pg-core"
import { Pool } from "pg"
import { createInitializedTestPayload } from "./testPayload"

/**
 * Offline call-routing fixture with the installed Payload/Postgres adapter and
 * a public Drizzle transaction object. No SQL transaction or connection opens;
 * callers must spy on each Local API method they exercise. This proves request
 * propagation and real guard behavior, never database persistence or rollback.
 */
export const createOfflineTransactionPayload = async () => {
  const payload = await createInitializedTestPayload()
  const sessions = payload.db.sessions
  if (!sessions) throw new Error("Expected initialized Postgres adapter sessions")
  const dialect = new PgDialect()
  const pool = new Pool({ connectionString: "postgresql://fixture:fixture@localhost/fixture" })
  const session = new NodePgSession(pool, dialect, undefined)
  const transaction = new NodePgTransaction(dialect, session, undefined)
  sessions["offline-unit-fixture"] = { db: transaction, resolve: async () => {}, reject: async () => {} }
  // These tests invoke no SQL. Close the unused pool so an accidental SQL call
  // fails instead of connecting; the public transaction object remains typed.
  await pool.end()
  return payload
}
