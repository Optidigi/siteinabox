import "server-only"

import crypto from "node:crypto"
import type { Payload } from "payload"
import { findCommunicationPreferenceBySubjectKey, mutateCommunicationPreference } from "@/lib/legal/communicationPreferences"
import { verifyEmailPreferenceToken, type EmailPreferenceTokenAction } from "@/lib/email/preferenceTokens"

export async function unsubscribeMarketing(input: {
  payload: Payload
  token: string
  requiredAction: EmailPreferenceTokenAction
  source: "email-unsubscribe" | "list-unsubscribe"
  requestId?: string
  ipAddress?: string
  userAgent?: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const claims = verifyEmailPreferenceToken(input.token, {
    requiredAction: input.requiredAction,
    nowSeconds: Math.floor(now.getTime() / 1000),
  })
  const preference = await findCommunicationPreferenceBySubjectKey(input.payload, claims.subjectKey)
  // Return the same outcome when the preference disappeared, avoiding account discovery.
  if (!preference || typeof preference.email !== "string") return { ok: true as const }
  const nonceHash = crypto.createHash("sha256").update(claims.nonce).digest("hex")
  await mutateCommunicationPreference({
    payload: input.payload,
    email: preference.email,
    mutation: { type: "marketing", enabled: false },
    tenantId: claims.tenantId,
    now,
    evidence: {
      eventKey: `${input.source}:${nonceHash}`,
      statementVersion: "marketing-unsubscribe-2026-07-12.1",
      statementText: "Ik wil geen marketing-e-mails meer ontvangen van Site in a Box.",
      source: input.source,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  })
  return { ok: true as const }
}

export function emailPreferenceRequestEvidence(request: Request) {
  return {
    requestId: request.headers.get("x-request-id") ?? undefined,
    ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") ?? undefined,
  }
}
