import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"

export const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`

export async function fileInventory(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await fileInventory(path, root))
    else if (entry.isFile()) {
      const contents = await readFile(path)
      files.push({ path: relative(root, path), sha256: sha256(contents) })
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}
