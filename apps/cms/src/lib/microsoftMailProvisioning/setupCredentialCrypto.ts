import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const keyBytes = (key: string): Buffer => {
  const trimmed = key.trim()
  const keyBytes = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64")
  if (keyBytes.length !== 32) throw new Error("MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters).")
  return keyBytes
}

export function encryptMicrosoftMailSetupCredential(value: string, key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptMicrosoftMailSetupCredential(value: string, key: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = value.split(".")
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra) {
    throw new Error("Mailbox setup credential envelope is invalid.")
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(ivEncoded, "base64url"))
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    throw new Error("Mailbox setup credential could not be decrypted.")
  }
}
