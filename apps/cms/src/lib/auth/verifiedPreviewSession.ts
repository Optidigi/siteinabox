import "server-only"
import { getPayload } from "payload"
import { previewAuth } from "@/lib/preview/betterAuth"
import config from "@/payload.config"
import { verifiedCustomerClaims, resolveVerifiedCustomerAccount } from "./verifiedCustomer"
import { assertCustomerAccess } from "./customerWorkspace"

/** One server authority for private preview/builder routes and actions. */
export async function getVerifiedPreviewCustomer(requestHeaders: Headers) {
  const session = await previewAuth.api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } })
  if (!session) return null
  const claims = verifiedCustomerClaims(session)
  const payload = await getPayload({ config })
  const account = await resolveVerifiedCustomerAccount(payload, session)
  const authority = { accountId: account.id, previewSessionId: claims.previewSessionId }
  await assertCustomerAccess(payload, authority, { intent: "read" })
  return { account, authority, payload, session }
}
