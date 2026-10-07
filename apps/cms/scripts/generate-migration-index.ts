import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { writeMigrationIndex } from "payload"

// A migration helper also lives in this directory. Give Payload's owning
// generator only the timestamped migration modules, never that helper.
const migrationsDir = resolve("src/migrations")
const temporary = await mkdtemp(join(tmpdir(), "payload-migration-index-"))
try {
  const files = (await readdir(migrationsDir)).filter((name) => /^\d{8}_.*\.ts$/.test(name)).sort()
  if (files.length === 0) throw new Error("No timestamped migrations found.")
  for (const name of files) await symlink(join(migrationsDir, name), join(temporary, name))
  writeMigrationIndex({ migrationsDir: temporary })
  await writeFile(join(migrationsDir, "index.ts"), await readFile(join(temporary, "index.ts")))
  console.log(`Payload generated an index for ${files.length} migrations.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
