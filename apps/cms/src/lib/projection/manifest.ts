import { promises as fs } from "node:fs"
import path from "node:path"
import { writeAtomic } from "@/lib/atomicWrite"

type Entry = { type: "page" | "media" | "settings"; key: string; updatedAt: string }
export type Manifest = { tenantId: string; version: number; updatedAt: string; entries: Entry[] }

const manifestPath = (dataDir: string, tenantId: string) =>
  path.join(dataDir, "tenants", tenantId, "manifest.json")

export async function readManifest(dataDir: string, tenantId: string): Promise<Manifest> {
  try {
    const buf = await fs.readFile(manifestPath(dataDir, tenantId), "utf8")
    const parsed = JSON.parse(buf) as Partial<Manifest>
    const version = parsed.version
    return {
      tenantId: parsed.tenantId ? String(parsed.tenantId) : tenantId,
      version: typeof version === "number" && Number.isInteger(version) ? version : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    }
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (error.code === "ENOENT") {
      return { tenantId, version: 0, updatedAt: new Date(0).toISOString(), entries: [] }
    }
    throw err
  }
}

export async function writeManifest(dataDir: string, m: Manifest): Promise<void> {
  await writeAtomic(manifestPath(dataDir, m.tenantId), JSON.stringify(m, null, 2))
}

export function upsertEntry(m: Manifest, e: Entry): Manifest {
  const filtered = m.entries.filter(x => !(x.type === e.type && x.key === e.key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: [...filtered, e] }
}

export function removeEntry(m: Manifest, type: Entry["type"], key: string): Manifest {
  const filtered = m.entries.filter(x => !(x.type === type && x.key === key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: filtered }
}

// Audit finding #12 (P2, T8) — manifest read-modify-write race.
//
// readManifest → mutate → writeManifest is not atomic at the composition
// level: two concurrent callers both observe v=N, both compute v=N+1 with
// only their own change merged, the slower writer wins, the other's entry
// is permanently lost. writeAtomic only protects the file write itself.
//
// Fix: per-(dataDir, tenantId) in-process async mutex. All writers in the
// same Node process serialize on the same key; the latest baseline is
// observed before each modification.
//
// Cross-process safety relies on the existing writeAtomic (open + fsync +
// rename), which guarantees any out-of-process reader sees pre- or post-
// write state, never partial JSON. The Astro frontends (separate repo, per
// THREAT-MODEL §1) only read; they never write. Single-instance VPS
// deployment per docker-compose.yml means no replica writers exist.
//
// The mutex is hand-rolled rather than depending on async-mutex to keep
// dependencies tight — the surface is one promise-chained map per key.
const locks = new Map<string, Promise<unknown>>()

export async function withManifestLock<T>(
  dataDir: string,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Key on (dataDir, tenantId) so a sibling dataDir (test harness, future
  // worker) cannot block the production tenant's lock and vice versa.
  const key = `${dataDir}::${tenantId}`
  const previous = locks.get(key) ?? Promise.resolve()
  // Chain the new operation onto the existing tail. Catch on the predecessor
  // so a thrown predecessor doesn't prevent the next operation from running
  // (the predecessor's caller already received the throw via its own await).
  const next = previous.catch(() => undefined).then(() => fn())
  // Park the chain head on the map so the next caller waits behind us.
  // Cleanup: when the chain settles, if no later caller has installed itself
  // we can drop the entry to avoid an unbounded map. We only delete when the
  // current entry IS still our `next` — otherwise a later caller already
  // chained on and we mustn't clobber theirs.
  locks.set(key, next)
  next
    .catch(() => undefined)
    .finally(() => {
      if (locks.get(key) === next) locks.delete(key)
    })
  return next
}
