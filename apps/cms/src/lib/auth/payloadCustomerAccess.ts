import type { Payload } from "payload"
import { CustomerIdentityError } from "./verifiedCustomer"

export async function assertPayloadCustomerActive(payload: Payload, userId: string | number): Promise<void> {
  const accounts = await payload.find({ collection: "customer-accounts",
    where: { payloadUser: { equals: userId } }, limit: 2, depth: 0, overrideAccess: true })
  if (accounts.docs.some(account => Boolean(account.revokedAt))) {
    throw new CustomerIdentityError("E_CUSTOMER_ACCOUNT_REVOKED")
  }
}

export async function assertPreviewCustomerActive(payload: Payload, identity: { email: string; previewUserId?: string }): Promise<void> {
  const accounts = await payload.find({ collection: "customer-accounts",
    where: { email: { equals: identity.email.trim().toLowerCase() } }, limit: 2, depth: 0, overrideAccess: true })
  for (const account of accounts.docs) {
    if (account.revokedAt) throw new CustomerIdentityError("E_CUSTOMER_ACCOUNT_REVOKED")
    if (identity.previewUserId && account.previewUserId !== identity.previewUserId) {
      throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")
    }
  }
}
