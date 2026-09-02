import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const VERSION = "v1"
const DEFAULT_KEY_ENV = "APPOINTMENT_CALENDAR_ENCRYPTION_KEY"
export const APPOINTMENT_MANAGEMENT_KEY_ENV = "APPOINTMENT_MANAGEMENT_ENCRYPTION_KEY"

const decodeKey = (raw: string): Buffer => {
  const normalized = raw.trim().replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const key = Buffer.from(padded, "base64")
  if (key.length !== 32) throw new Error("Appointment secret key must decode to exactly 32 bytes.")
  return key
}

const encryptionKey = (keyEnv: string, env: NodeJS.ProcessEnv = process.env): Buffer => {
  const raw = env[keyEnv]
  if (!raw || (raw.startsWith("<") && raw.endsWith(">"))) {
    throw new Error(`${keyEnv} is required for appointment secrets.`)
  }
  return decodeKey(raw)
}

const encode = (value: Uint8Array): string => Buffer.from(value).toString("base64url")
const decode = (value: string): Buffer => Buffer.from(value, "base64url")

export function sealAppointmentSecret(
  value: string,
  purpose: string,
  env: NodeJS.ProcessEnv = process.env,
  keyEnv = DEFAULT_KEY_ENV,
): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(keyEnv, env), iv)
  cipher.setAAD(Buffer.from(purpose, "utf8"))
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return [VERSION, encode(iv), encode(cipher.getAuthTag()), encode(ciphertext)].join(".")
}

export function openAppointmentSecret(
  value: string,
  purpose: string,
  env: NodeJS.ProcessEnv = process.env,
  keyEnv = DEFAULT_KEY_ENV,
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".")
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Appointment calendar secret has an unsupported format.")
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(keyEnv, env), decode(encodedIv))
  decipher.setAAD(Buffer.from(purpose, "utf8"))
  decipher.setAuthTag(decode(encodedTag))
  return Buffer.concat([decipher.update(decode(encodedCiphertext)), decipher.final()]).toString("utf8")
}
