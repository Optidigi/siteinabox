import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"

export async function sha256File(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest("hex")
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex")
}

export function canonicalHash(value) {
  const canonical = input => Array.isArray(input) ? input.map(canonical) : input && typeof input === "object"
    ? Object.fromEntries(Object.keys(input).sort().map(key => [key, canonical(input[key])])) : input
  return sha256Bytes(JSON.stringify(canonical(value)))
}
