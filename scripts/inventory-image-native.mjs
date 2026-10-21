import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { isAbsolute } from "node:path"

const nativeName = (name) => /\.node$|\.so(?:\.\d+)*$|\.(?:a|wasm)$/.test(name)
const bundleName = (name) => /(?:^|\/)dist-runtime\/.*\.(?:mjs|cjs|js)$/.test(name)
const safeName = (name) => name.replace(/^\.\//, "")
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'"
const marker = Buffer.from("\xff Go buildinf:", "latin1")

// GNU tar's escape representation uses octal UTF-8 bytes under LANG=C.
// Decode only that representation; controls, backslashes and traversal remain
// unsupported. Never pass the displayed escape text back as a member name.
function decodeTarName(displayed) {
  const parts = displayed.split(/(\\[0-7]{3})/).map((part) => {
    if (/^\\[0-7]{3}$/.test(part)) {
      const byte = Number.parseInt(part.slice(1), 8)
      if (byte > 255) throw new Error("Unsupported native archive member path")
      return Buffer.from([byte])
    }
    if (part.includes("\\")) throw new Error("Unsupported native archive member path")
    return Buffer.from(part, "utf8")
  })
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))
}

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
    const decoded = decodeTarName(match[2])
    const name = safeName(decoded)
    if (!name || name.startsWith("/") || name.split("/").includes("..") || /[\\\0\r\n]/.test(name)) throw new Error("Unsupported native archive member path")
    selected.push(decoded)
  }
  if (!selected.length) return { files: [], goTargets: [], bundledScripts: [] }
  // Inspect every regular member's magic, independent of mode or suffix. Only
  // native/bundle candidates need the Node hashing process; ordinary files are
  // drained without extraction. Preserve consumed prefix bytes in the hash.
  const inspect = quote(process.execPath) + " " + quote(fileURLToPath(import.meta.url)) + ' --member "$TAR_FILENAME" "$magic"'
  const command = 'magic=$(head -c 4 | od -An -tx1); ' +
    'case "$magic" in " 7f 45 4c 46") ' + inspect + ' ;; *) ' +
    'case "$TAR_FILENAME" in *.node|*.so|*.so.*|*.a|*.wasm|*/dist-runtime/*.mjs|*/dist-runtime/*.cjs|*/dist-runtime/*.js) ' + inspect +
    " ;; *) cat >/dev/null; printf '{}\\n' ;; esac ;; esac"
  const output = execFileSync("tar", ["--extract", "--to-command", command, "--null", "--files-from", "-", "--file", archive],
    { env, input: selected.join("\0") + "\0", encoding: "utf8", timeout: 300000, maxBuffer: 64 * 1024 * 1024 })
  const records = output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
  if (records.length !== selected.length) throw new Error("Incomplete native archive member inventory")
  return { files: records.filter((entry) => entry.native).map(({ native, go, bundle, ...entry }) => entry),
    goTargets: records.filter((entry) => entry.go).map((entry) => entry.path).sort(),
    bundledScripts: records.filter((entry) => entry.bundle).map(({ native, go, bundle, format, ...entry }) => entry) }
}

async function member(name, prefixHex) {
  name = safeName(name)
  if (!name || name.startsWith("/") || name.split("/").includes("..") || /[\\\0\r\n]/.test(name)) throw new Error("Unsafe native member path")
  const hash = createHash("sha256")
  if (!/^(?: [a-f0-9]{2}){0,4}$/.test(prefixHex)) throw new Error("Invalid inspected native prefix")
  let prefix = Buffer.from(prefixHex.replaceAll(" ", ""), "hex")
  hash.update(prefix)
  let suffix = prefix; let size = prefix.length; let go = false
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
  if (process.argv[2] !== "--member" || process.argv.length !== 5) throw new Error("Only an explicit archive member pipe is supported")
  console.log(JSON.stringify(await member(process.argv[3], process.argv[4])))
}
