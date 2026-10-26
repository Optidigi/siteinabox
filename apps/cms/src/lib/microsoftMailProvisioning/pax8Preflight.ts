import "server-only"
import { MICROSOFT_MAIL_PRODUCT } from "./model.ts"
import { Pax8Client, type Pax8Commitment, type Pax8Company, type Pax8Product, type Pax8ProvisioningField, type Pax8Pricing } from "./pax8.ts"

export const PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID = "1bdd7ebb-f994-421f-ae98-b6a57bd9f947"

export type Pax8MailPreflight = {
  product: Pax8Product
  company: Pax8Company | null
  provisioningFields: Pax8ProvisioningField[]
  commitments: Pax8Commitment[]
  pricing: Pax8Pricing
  quantity: number
  productKey: typeof MICROSOFT_MAIL_PRODUCT
}

export function createPax8MailClient(env: NodeJS.ProcessEnv = process.env): Pax8Client {
  const clientId = env.PAX8_CLIENT_ID?.trim()
  const clientSecret = env.PAX8_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error("PAX8_API_NOT_CONFIGURED")
  return new Pax8Client({ clientId, clientSecret, audience: "https://api.pax8.com" })
}

export async function runPax8MailPreflight(input: {
  client: Pax8Client
  website: string
  quantity: number
  productId?: string
}): Promise<Pax8MailPreflight> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 300) {
    throw new Error("INVALID_ORDER_QUANTITY")
  }
  const productId = input.productId ?? PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID
  const [product, company] = await Promise.all([
    input.client.getProduct(productId),
    input.client.findCompanyByWebsite(input.website),
  ])
  if (product.id !== PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID) {
    throw new Error("UNEXPECTED_PAX8_PRODUCT")
  }
  const [provisioningFields, commitments, pricing] = await Promise.all([
    input.client.getProvisioningFields(product.id),
    input.client.getCommitmentTerms(product.id),
    input.client.getPricing(product.id, company?.id),
  ])
  return {
    product,
    company,
    provisioningFields,
    commitments,
    pricing,
    quantity: input.quantity,
    productKey: MICROSOFT_MAIL_PRODUCT,
  }
}
