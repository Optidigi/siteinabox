"use server"

import { getPayload } from "payload"
import config from "@/payload.config"
import { decryptMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupCredentialCrypto"
import { consumeMicrosoftMailSetupToken } from "@/lib/microsoftMailProvisioning/setupTokenStore"

export async function revealMicrosoftMailboxSetupAction(token: string) {
  const encryptionKey = process.env.MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY?.trim()
  if (!encryptionKey) return { ok: false as const, code: "SETUP_SERVICE_TEMPORARILY_UNAVAILABLE" }
  const payload = await getPayload({ config })
  const claimed = await consumeMicrosoftMailSetupToken({ payload, token })
  if (!claimed) return { ok: false as const, code: "SETUP_LINK_INVALID_EXPIRED_OR_USED" }
  try {
    const password = decryptMicrosoftMailSetupCredential(claimed.encryptedPassword, encryptionKey)
    return { ok: true as const, userPrincipalName: claimed.userPrincipalName, password }
  } catch {
    return { ok: false as const, code: "SETUP_SERVICE_TEMPORARILY_UNAVAILABLE" }
  }
}
