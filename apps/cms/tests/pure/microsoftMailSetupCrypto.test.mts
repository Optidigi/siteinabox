import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decryptMicrosoftMailSetupCredential, encryptMicrosoftMailSetupCredential } from "../../src/lib/microsoftMailProvisioning/setupCredentialCrypto.ts"

const key = Buffer.alloc(32, 7).toString("base64")

describe("one-time setup credential envelope", () => {
  it("encrypts with randomized AES-GCM IVs and rejects tampering", () => {
    const first = encryptMicrosoftMailSetupCredential("temporary-password", key)
    const second = encryptMicrosoftMailSetupCredential("temporary-password", key)
    assert.notEqual(first, second)
    assert.equal(decryptMicrosoftMailSetupCredential(first, key), "temporary-password")
    assert.throws(() => decryptMicrosoftMailSetupCredential(`${first.slice(0, -2)}AA`, key), /could not be decrypted/)
  })

  it("accepts a 32-byte hex key and rejects malformed keys", () => {
    const hexKey = "ab".repeat(32)
    const encrypted = encryptMicrosoftMailSetupCredential("value", hexKey)
    assert.equal(decryptMicrosoftMailSetupCredential(encrypted, hexKey), "value")
    assert.throws(() => encryptMicrosoftMailSetupCredential("value", "too-short"), /32 bytes/)
  })
})
