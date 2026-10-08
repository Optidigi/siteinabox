// Server-only store is loaded at issuance, never during Payload CLI config load.
export async function issuePayloadSessionCookie(payloadUserId: string | number, request: Request, betterAuthSessionId: string): Promise<string> {
  const { issueBoundPayloadSessionCookie } = await import("@/lib/auth/customerSessionBridge")
  return issueBoundPayloadSessionCookie(payloadUserId, request, betterAuthSessionId)
}
