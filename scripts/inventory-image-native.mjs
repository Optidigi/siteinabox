import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { isAbsolute } from "node:path"

const nativeName = (name) => /\.node$|\.so(?:\.\d+)*$|\.(?:a|wasm)$/.test(name)
const bundleName = (name) => /(?:^|\/)dist-runtime\/.*\.(?:mjs|cjs|js)$/.test(name)
const safeName = (name) => name.replace(/^\.\//, "")
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'"
const marker = Buffer.from("\xff Go buildinf:", "latin1")

/** Read flattened Docker-export members through tar pipes; never extract host files. */
export function inventoryImageNative(archive) {
  if (!isAbsolute(archive)) throw new Error("Native archive inventory requires an absolute owned archive path")
  const env = Object.fromEntries(["PATH", "LD_LIBRARY_PATH"].filter((key) => process.env[key]).map((key) => [key, process.env[key]]))
  env.LANG = "C"
  const list = execFileSync("tar", ["--list", "--verbose", "--numeric-owner", "--full-time", "--quoting-style=escape", "--file", archive],
    { env, encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
  const selected = []
  const lines = list.trim().split("\n")
  if (lines.length > 100000) throw new Error("Native archive inventory exceeds its entry bound")
  for (const line of lines) {
    if (!line.startsWith("-")) continue // Links/devices are not followed or executed.
    const match = line.match(/^([-rwxstST]{10})\s+\S+\s+\d+\s+\d{4}-\d{2}-\d{2}\s+\S+\s+(.+)$/)
    if (!match) throw new Error("Unsupported native archive member metadata")
    const name = safeName(match[2])
    const executable = [match[1][3], match[1][6], match[1][9]].some((mode) => /[xst]/.test(mode))
    if (!executable && !nativeName(name) && !bundleName(name)) continue
    if (!name || name.startsWith("/") || name.split("/").includes("..") || /[\\\0\r\n]/.test(name)) throw new Error("Unsupported native archive member path")
    selected.push(match[2])
  }
  if (!selected.length) return { files: [], goTargets: [], bundledScripts: [] }
  const command = quote(process.execPath) + " " + quote(fileURLToPath(import.meta.url)) + ' --member "$TAR_FILENAME"'
  const output = execFileSync("tar", ["--extract", "--to-command", command, "--null", "--files-from", "-", "--file", archive],
    { env, input: selected.join("\0") + "\0", encoding: "utf8", timeout: 300000, maxBuffer: 64 * 1024 * 1024 })
  const records = output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
  if (records.length !== selected.length) throw new Error("Incomplete native archive member inventory")
  return { files: records.filter((entry) => entry.native).map(({ native, go, bundle, ...entry }) => entry),
    goTargets: records.filter((entry) => entry.go).map((entry) => entry.path).sort(),
    bundledScripts: records.filter((entry) => entry.bundle).map(({ native, go, bundle, format, ...entry }) => entry) }
}

async function member(name) {
  name = safeName(name)
  if (!name || name.startsWith("/") || name.split("/").includes("..") || /[\\\0\r\n]/.test(name)) throw new Error("Unsafe native member path")
  const hash = createHash("sha256")
  let prefix = Buffer.alloc(0); let suffix = Buffer.alloc(0); let size = 0; let go = false
  for await (const chunk of process.stdin) {
    hash.update(chunk); size += chunk.length
    if (size > 512 * 1024 * 1024) throw new Error("Native member exceeds its completeness bound")
    if (prefix.length < 4) prefix = Buffer.concat([prefix, chunk]).subarray(0, 4)
    const boundary = Buffer.concat([suffix, chunk])
    if (boundary.includes(marker)) go = true
    suffix = boundary.subarray(Math.max(0, boundary.length - marker.length))
  }
  const elf = prefix.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
  return { path: name, size, sha256: hash.digest("hex"), format: elf ? "elf" : "other",
    native: elf || nativeName(name), go: elf && go, bundle: bundleName(name) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "--member" || process.argv.length !== 4) throw new Error("Only an explicit archive member pipe is supported")
  console.log(JSON.stringify(await member(process.argv[3])))
}
