import { createHmac } from "node:crypto"
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export function base32(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 128 ||
    !/^[A-Z2-7]+={0,6}$/.test(value)
  )
    throw Error("FACTOR_INVALID")
  let bits = 0,
    n = 0
  const out = []
  for (const c of value.replace(/=+$/, "")) {
    n = (n << 5) | alphabet.indexOf(c)
    bits += 5
    while (bits >= 8) {
      bits -= 8
      out.push((n >>> bits) & 255)
    }
    n &= (1 << bits) - 1
  }
  if (n !== 0 || out.length < 10 || out.length > 64)
    throw Error("FACTOR_INVALID")
  return Buffer.from(out)
}
export function code(seed, now = Date.now()) {
  if (
    !Buffer.isBuffer(seed) ||
    seed.length < 10 ||
    seed.length > 64 ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    throw Error("FACTOR_INVALID")
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)))
  const h = createHmac("sha1", seed).update(counter).digest(),
    o = h[19] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0")
}
export function parseEnrollment(uri, account) {
  try {
    const u = new URL(uri)
    if (
      u.protocol !== "otpauth:" ||
      u.hostname !== "totp" ||
      u.username ||
      u.password ||
      u.port ||
      u.hash
    )
      throw Error()
    const keys = [...u.searchParams.keys()]
    if (
      new Set(keys).size !== keys.length ||
      keys.some(
        (k) =>
          !["secret", "issuer", "algorithm", "digits", "period"].includes(k),
      )
    )
      throw Error()
    const label = decodeURIComponent(u.pathname.slice(1)),
      i = label.indexOf(":")
    if (
      i < 1 ||
      label.slice(i + 1).toLowerCase() !== account.toLowerCase() ||
      label.slice(0, i) !== u.searchParams.get("issuer") ||
      !["Microsoft", "Microsoft Azure"].includes(u.searchParams.get("issuer"))
    )
      throw Error()
    if (
      (u.searchParams.get("algorithm") ?? "SHA1") !== "SHA1" ||
      (u.searchParams.get("digits") ?? "6") !== "6" ||
      (u.searchParams.get("period") ?? "30") !== "30"
    )
      throw Error()
    base32(u.searchParams.get("secret"))
    return u.searchParams.get("secret")
  } catch {
    throw Error("FACTOR_INVALID")
  }
}
