import { errLike } from "../_helpers/cast"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"
import {
  readManifest,
  writeManifest,
  upsertEntry,
  withManifestLock,
} from "@/lib/projection/manifest"

// Audit finding #12 (P2, T8 / touches T3) — manifest.json read-modify-write race.
//
// Today: readManifest → upsertEntry → writeManifest runs unsynchronised in every
// page/media/settings afterChange. writeAtomic only protects the file write
// itself, not the read-modify-write composition. Two concurrent publishes
// interleave: both read v=N, both compute v=N+1 with only their own change
// merged, the slower writer wins and the other's entry is lost.
//
// Investigation (recorded in batch report): single-instance VPS deployment per
// docker-compose.yml; one Node process per container. No multi-replica writers.
// Manifest readers in this repo are all writers (projectToDisk, deleteFileFromDisk,
// tenantLifecycle.createTenantDir); the only out-of-process reader is the separate
// generated-Astro-frontend repo (out-of-scope per THREAT-MODEL §1) which only
// reads the file. Therefore: in-process per-tenant mutex covers all writer
// concurrency; atomic rename ensures any out-of-process reader sees pre- or
// post-write state, never partial JSON.
//
// Fix shape:
//   - Add `withManifestLock(dataDir, tenantId, fn)` — keyed-by-(dataDir, tenantId)
//     async mutex. fn() runs serialized; lock is released even on throw.
//   - Callers (projectPageToDisk / projectSettingsToDisk / projectMediaToDisk /
//     deletePageFile / deleteMediaFile) wrap the read-modify-write in
//     withManifestLock. The function signature is what the tests bind to.
//   - writeManifest still uses writeAtomic (already the case via the existing
//     atomicWrite helper). The atomicity guarantee is preserved across the lock.
//
// Mechanism choice: in-process mutex (option 1 from dispatch). Rationale:
// single-Node-process per container; atomic rename already protects against
// cross-process reader corruption; full DB-backed manifest (option 3) is
// architectural and out of P2 scope.

let tmp: string
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-race-"))
})
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true })
})

// -----------------------------------------------------------------------------
// Sub-fix B core: per-(dataDir, tenant) mutex serializes writes
// -----------------------------------------------------------------------------

describe("audit-p2 #12 — withManifestLock serializes manifest read-modify-writes", () => {
  it("recovers a malformed projection manifest to an empty entry list", async () => {
    await fs.mkdir(path.join(tmp, "tenants", "t1"), { recursive: true })
    await fs.writeFile(
      path.join(tmp, "tenants", "t1", "manifest.json"),
      JSON.stringify({ version: 1, footer: { items: [] } }),
    )

    const manifest = await readManifest(tmp, "t1")

    expect(manifest).toMatchObject({
      tenantId: "t1",
      version: 1,
      entries: [],
    })
  })

  it("Case 1 — single read-modify-write → manifest correctly updated", async () => {
    await withManifestLock(tmp, "t1", async () => {
      let m = await readManifest(tmp, "t1")
      m = upsertEntry(m, { type: "page", key: "home", updatedAt: "2026-05-09" })
      await writeManifest(tmp, m)
    })
    const m = await readManifest(tmp, "t1")
    expect(m.entries).toHaveLength(1)
    expect(m.entries[0]).toEqual({
      type: "page",
      key: "home",
      updatedAt: "2026-05-09",
    })
  })

  it("Case 2 — two concurrent writes: final manifest contains BOTH entries (no lost update)", async () => {
    // Without the mutex, both readers observe v=0 with empty entries; both
    // compute v=1 with only their own entry; second writer wins → first
    // writer's entry is permanently lost.
    const writeOne = async (key: string) =>
      withManifestLock(tmp, "t1", async () => {
        let m = await readManifest(tmp, "t1")
        // Force interleaving: yield so the other promise can grab the read
        // window if the lock is missing/broken.
        await new Promise((r) => setImmediate(r))
        m = upsertEntry(m, { type: "page", key, updatedAt: `t-${key}` })
        await writeManifest(tmp, m)
      })

    await Promise.all([writeOne("a"), writeOne("b")])

    const final = await readManifest(tmp, "t1")
    const keys = final.entries.map((e) => e.key).sort()
    expect(keys).toEqual(["a", "b"])
    // Version monotonic increments — not skipped, not duplicated.
    expect(final.version).toBe(2)
  })

  it("Case 3 — concurrent reader during write: never observes partial JSON (atomic rename)", async () => {
    // Seed the manifest with v=1.
    await withManifestLock(tmp, "t1", async () => {
      const m = upsertEntry(await readManifest(tmp, "t1"), {
        type: "page",
        key: "seed",
        updatedAt: "0",
      })
      await writeManifest(tmp, m)
    })

    // Kick off a slow write (large entries list) and parallel reads of the
    // raw file. Each raw read must produce parseable JSON — never a half-
    // written buffer. The atomic-rename guarantee is what makes this true.
    const big = Array.from({ length: 500 }, (_, i) => ({
      type: "page" as const,
      key: `k${i}`,
      updatedAt: String(i),
    }))
    const writeP = withManifestLock(tmp, "t1", async () => {
      const m = await readManifest(tmp, "t1")
      const next = { ...m, version: m.version + 1, updatedAt: "now", entries: big }
      await writeManifest(tmp, next)
    })

    const reads: Array<Promise<unknown>> = []
    for (let i = 0; i < 50; i++) {
      reads.push(
        (async () => {
          // Read the raw file bytes and JSON.parse — must always succeed,
          // either to the seed shape or to the post-write shape.
          try {
            const buf = await fs.readFile(
              path.join(tmp, "tenants", "t1", "manifest.json"),
              "utf8",
            )
            return JSON.parse(buf)
          } catch (err: unknown) {
            // ENOENT during the brief moment between mkdir and rename is
            // acceptable (file genuinely doesn't exist yet); partial-JSON
            // SyntaxError is NOT acceptable.
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ok: true }
            throw err
          }
        })(),
      )
    }
    const [, ...readResults] = await Promise.all([writeP, ...reads])
    for (const r of readResults) {
      // Either parsed correctly to a manifest shape OR was a benign ENOENT.
      expect(r).toBeTruthy()
    }
  })

  it("Case 4 — mutex serializes 10 concurrent writes; final manifest has all 10 entries", async () => {
    const writeOne = (key: string) =>
      withManifestLock(tmp, "t1", async () => {
        let m = await readManifest(tmp, "t1")
        // Yield to maximise interleaving opportunity in the absence of a lock.
        await new Promise((r) => setImmediate(r))
        m = upsertEntry(m, { type: "page", key, updatedAt: `t-${key}` })
        await writeManifest(tmp, m)
      })

    await Promise.all(
      Array.from({ length: 10 }, (_, i) => writeOne(`p${i}`)),
    )

    const final = await readManifest(tmp, "t1")
    expect(final.entries).toHaveLength(10)
    expect(final.version).toBe(10)
    const keys = final.entries.map((e) => e.key).sort()
    expect(keys).toEqual([
      "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9",
    ])
  })

  it("Case 5 — atomic rename never leaves a partial file on the target path", async () => {
    // Spy on fs.rename via the writeManifest path: a successful writeManifest
    // produces exactly the target file at the end, with the full content.
    // (This case is covered structurally by the atomicWrite helper which the
    // manifest writer composes; assert the existing invariant holds inside
    // a lock-guarded block too.)
    await withManifestLock(tmp, "t1", async () => {
      let m = await readManifest(tmp, "t1")
      m = upsertEntry(m, { type: "page", key: "home", updatedAt: "x" })
      await writeManifest(tmp, m)
    })
    const dir = await fs.readdir(path.join(tmp, "tenants", "t1"))
    // Target file present; no leftover .tmp.* siblings.
    expect(dir).toContain("manifest.json")
    expect(dir.filter((f) => f.includes(".tmp."))).toEqual([])
  })

  it("Case 6 — failing operation releases the lock so the next write proceeds", async () => {
    // First operation throws; the lock must release. Second operation must
    // run to completion (no deadlock). Without lock release on throw, the
    // second `withManifestLock` would hang forever.
    let firstThrew = false
    try {
      await withManifestLock(tmp, "t1", async () => {
        throw new Error("simulated write failure")
      })
    } catch (e: unknown) {
      firstThrew = true
      expect(errLike(e).message).toBe("simulated write failure")
    }
    expect(firstThrew).toBe(true)

    // Bound the second wait so a deadlock surfaces as a test failure rather
    // than a 30s hang.
    const second = withManifestLock(tmp, "t1", async () => {
      let m = await readManifest(tmp, "t1")
      m = upsertEntry(m, { type: "page", key: "after-error", updatedAt: "x" })
      await writeManifest(tmp, m)
    })
    const guarded = Promise.race([
      second.then(() => "ok"),
      new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error("deadlock: lock not released after throw")), 2000),
      ),
    ])
    await expect(guarded).resolves.toBe("ok")

    const final = await readManifest(tmp, "t1")
    expect(final.entries.map((e) => e.key)).toContain("after-error")
  })

  it("Case 7 — multi-tenant: locks are keyed per tenant; different tenants do NOT serialize against each other", async () => {
    // Hold tenant A's lock for a long time. Tenant B's lock acquisition must
    // resolve quickly (well before A releases) — proving the keys are
    // independent.
    let releaseA!: () => void
    const aHolds = new Promise<void>((r) => (releaseA = r))

    const aP = withManifestLock(tmp, "tA", async () => {
      // Park inside A's critical section until releaseA() is called.
      await aHolds
      let m = await readManifest(tmp, "tA")
      m = upsertEntry(m, { type: "page", key: "a", updatedAt: "x" })
      await writeManifest(tmp, m)
    })

    // Tenant B should complete promptly without waiting for A's release.
    const bStart = Date.now()
    await withManifestLock(tmp, "tB", async () => {
      let m = await readManifest(tmp, "tB")
      m = upsertEntry(m, { type: "page", key: "b", updatedAt: "x" })
      await writeManifest(tmp, m)
    })
    const bElapsed = Date.now() - bStart

    expect(bElapsed, "tenant B must NOT wait for tenant A's lock").toBeLessThan(1000)

    // Now release A and let it complete.
    releaseA()
    await aP

    const a = await readManifest(tmp, "tA")
    const b = await readManifest(tmp, "tB")
    expect(a.entries.map((e) => e.key)).toEqual(["a"])
    expect(b.entries.map((e) => e.key)).toEqual(["b"])
  })

  it("Case 7b — locks are keyed per (dataDir, tenantId): same tenant id under different dataDirs do NOT serialize", async () => {
    // Defense-in-depth: a future test harness or worker that uses a sibling
    // dataDir must not block on the production dataDir's lock.
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-race-2-"))
    try {
      let release!: () => void
      const held = new Promise<void>((r) => (release = r))
      const aP = withManifestLock(tmp, "t1", async () => {
        await held
      })

      const bStart = Date.now()
      await withManifestLock(tmp2, "t1", async () => {
        let m = await readManifest(tmp2, "t1")
        m = upsertEntry(m, { type: "page", key: "z", updatedAt: "x" })
        await writeManifest(tmp2, m)
      })
      const bElapsed = Date.now() - bStart
      expect(bElapsed).toBeLessThan(1000)

      release()
      await aP
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true })
    }
  })
})
