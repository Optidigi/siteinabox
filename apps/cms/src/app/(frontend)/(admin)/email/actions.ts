"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { validMicrosoftMailSignatoryName } from "@/lib/microsoftMailProvisioning/consentIdentity"
import { randomUUID } from "node:crypto"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireMailWorkspace } from "./workspaceAccess"
import { parseMicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
import { createMicrosoftMailProvisioningKey } from "@/lib/microsoftMailProvisioning/state"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { prepareMailQuote, acceptMailOrder, createMailPayment } from "@/lib/microsoftMailProvisioning/commerce"
import { redirect } from "next/navigation"
import { fundPrepaidMailOrder } from "@/lib/microsoftMailProvisioning/commerce"
import { loadMailService } from "@/lib/microsoftMailProvisioning/commerce"
import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { mailRenewalRequest } from "@/lib/microsoftMailProvisioning/renewalRequest"
import { relationshipId } from "@/lib/relationshipId"
import { consumeMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupTokenStore"
import { decryptMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupCredentialCrypto"

const mcaDocumentUrl = "https://aka.ms/customeragreement"
const consentCopyVersion = "siteinabox-m365-mail-consent-2026-10-26-v1"

const stableJson = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

type CustomerMailRequestActionState =
  | { ok: true; message: string; requestId: string; preparationId: string }
  | { ok: false; message: string }
  | null

export async function submitCustomerMicrosoftMailRequest(
  _previousState: CustomerMailRequestActionState,
  formData: FormData,
): Promise<CustomerMailRequestActionState> {
  const { user, ctx, basePath } = await requireMailWorkspace(formData.get("tenantId"))
  if (ctx.mode !== "tenant" || ctx.tenant.status !== "active") {
    return { ok: false, message: "Email ordering isn't available for this workspace." }
  }
  if (formData.get("acceptMca") !== "on" || formData.get("authorizeService") !== "on") {
    return { ok: false, message: "Confirm the agreement and setup authorization to continue." }
  }
  if (!user.email?.trim()) return { ok: false, message: "Your account needs a verified email address before ordering email." }
  const legalLocale = formData.get("legalLocale")
  if (formData.get("acceptOrderTerms") !== "on" || legalLocale !== "nl" && legalLocale !== "en" || !String(formData.get("legalVersion") ?? "").trim()) return { ok: false, message: "Review and accept the terms, legal language and displayed annual price before ordering." }
  const expectedGrossMinor = Number(formData.get("expectedGrossMinor"))
  const expectedAmountDueMinor = Number(formData.get("expectedAmountDueMinor"))
  if (!Number.isSafeInteger(expectedGrossMinor) || expectedGrossMinor <= 0 || !Number.isSafeInteger(expectedAmountDueMinor) || expectedAmountDueMinor < 0) return { ok: false, message: "Refresh the displayed price before ordering." }


  const signatoryFirstName = String(formData.get("signatoryFirstName") ?? "").trim()
  const signatoryLastName = String(formData.get("signatoryLastName") ?? "").trim()
  const signatoryEmail = String(formData.get("signatoryEmail") ?? "").trim().toLowerCase()
  if (!validMicrosoftMailSignatoryName(signatoryFirstName) || !validMicrosoftMailSignatoryName(signatoryLastName) || !z.string().email().safeParse(signatoryEmail).success) {
    return { ok: false, message: "Enter the agreement signatory’s real first and last name and valid email." }
  }

  const payload = await getPayload({ config })
  let mailboxUsers: unknown
  try {
    mailboxUsers = JSON.parse(String(formData.get("mailboxUsers") ?? "[]")) as unknown
  } catch {
    return { ok: false, message: "Check the mailbox names and setup email addresses." }
  }
  const providerContactEmail = process.env.PAX8_ORDER_EMAIL?.trim().toLowerCase()
  if (!providerContactEmail) {
    return { ok: false, message: "Email ordering is temporarily unavailable. Please try again later." }
  }
  const parsed = parseMicrosoftMailProvisioningRequest({
    tenantId: ctx.tenant.id,
    domain: String(formData.get("domain") ?? ""),
    tenantPrefix: String(formData.get("tenantPrefix") ?? ""),
    customer: {
      companyName: String(formData.get("companyName") ?? ""),
      website: String(formData.get("website") ?? ""),
      phone: String(formData.get("companyPhone") ?? ""),
      address: {
        street: String(formData.get("street") ?? ""),
        city: String(formData.get("city") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        country: String(formData.get("country") ?? "NL").trim().toUpperCase(),
      },
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      primaryContact: {
        firstName: "Siteinabox",
        lastName: "Operations",
        email: providerContactEmail,
        phone: String(formData.get("companyPhone") ?? ""),
      },
    },
    mailboxUsers,
    infoSharedMailbox: formData.get("infoSharedMailbox") === "on",
    retainInfoForward: false,
    infoForwardTo: "",
    infoAliasTarget: String(formData.get("infoAliasTarget") ?? "").trim().toLowerCase(),
  })
  if (!parsed.ok) return { ok: false, message: parsed.issues.map((issue) => issue.message).join(" ") }
  const prepared = await withCommerceOrderLock<CustomerMailRequestActionState>(payload, `mail-service:${ctx.tenant.id}`, async () => {
  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  const idempotencyKey = `${createMicrosoftMailProvisioningKey({
    tenantId: parsed.value.tenantId,
    domain: parsed.value.domain,
    mailboxAddresses: parsed.value.mailboxUsers.map((mailbox) => mailbox.userPrincipalName),
    product: parsed.value.product,
  })}:live`
  const existing = await store.findByIdempotencyKey(idempotencyKey)
  if (existing?.data.commerceOrderId) {
    if (stableJson(existing.request) !== stableJson(parsed.value)) return { ok: false, message: "The accepted mailbox order has different details." }
    return { ok: true, message: "Continuing the accepted order.", requestId: String(existing.id), preparationId: String(existing.data.preparationId ?? "") }
  }
  let quote: Awaited<ReturnType<typeof prepareMailQuote>>
  try { quote = await prepareMailQuote(payload, ctx.tenant, parsed.value) }
  catch { return { ok: false, message: "We could not prepare your email order. Check the details or contact Siteinabox." } }
  if (quote.totalGrossMinor !== expectedGrossMinor || (quote.prepaidAuthorizationId ? 0 : quote.totalGrossMinor) !== expectedAmountDueMinor) return { ok: false, message: "The price or prepaid coverage changed. Refresh the form and review the updated amount." }


  const consentAt = new Date().toISOString()
  const preparationId = randomUUID()
  const consentRecord = {
    source: user.role === "super-admin" ? "operator_customer_ui" : "customer_dashboard",
    actorRole: user.role,
    consentCopyVersion,
    mcaDocumentUrl,
    mcaCountry: parsed.value.customer.address.country,
    mcaChannel: "CSP Partner",
    mcaAudience: "Commercial",
    mcaAccepted: true,
    serviceAuthorized: true,
    acceptedAt: consentAt,
    actorUserId: String(user.id),
    actorEmail: user.email.trim().toLowerCase(),
    actorName: user.name?.trim() || user.email.trim(),
    signatoryFirstName,
    signatoryLastName,
    signatoryEmail,
    confirmSignatoryAuthority: true,
    serviceAuthorizationVersion: "siteinabox-microsoft-mail-order-2026-10-26-v1",
  }

  if (existing) {
    if (stableJson(existing.request) !== stableJson(parsed.value) && (existing.state !== "prepared" || existing.data.commerceOrderId)) {
      return { ok: false, message: "A request for these mailboxes already exists with different details. Contact Siteinabox support to change it." }
    }
    if (existing.data.commerceOrderId) {
      revalidatePath(basePath)
      return { ok: true, message: "Your mailbox details are already saved. Continue your order below.", requestId: String(existing.id), preparationId }
    }
    const updated = await store.update(existing.id, {
      request: parsed.value,
      data: { ...existing.data, customerConsent: consentRecord, quote, mailServiceId: quote.serviceId, preparationId },
      updatedAt: consentAt,
    })
    revalidatePath(basePath)
    revalidatePath("/operations/microsoft-mail")
      return { ok: true, message: "Your mailbox details are saved. Review and confirm your order.", requestId: String(updated.id), preparationId }
  }

  const run = await store.create({
    idempotencyKey,
    mode: "live",
    tenantId: parsed.value.tenantId,
    domain: parsed.value.domain,
    tenantPrefix: parsed.value.tenantPrefix,
    request: parsed.value,
    state: "prepared",
    currentStep: null,
    completedSteps: [],
    data: { customerConsent: consentRecord, requestSource: user.role === "super-admin" ? "operator_customer_ui" : "customer_dashboard", quote, mailServiceId: quote.serviceId, preparationId },
    actionUrl: null,
    issueCode: null,
    createdAt: consentAt,
    updatedAt: consentAt,
  })

  revalidatePath(basePath)
  revalidatePath("/operations/microsoft-mail")
  return { ok: true, message: "Your mailbox details are saved. Review and confirm your order.", requestId: String(run.id), preparationId }
  })
  if (!prepared?.ok) return prepared
  let destination = `${basePath}?request=${prepared.requestId}`
  try {
    const order = await acceptMailOrder(payload, { runId: Number(prepared.requestId), tenantId: ctx.tenant.id, actor: user,
      legalAccepted: true, legalLocale, legalVersion: String(formData.get("legalVersion")), preparationId: prepared.preparationId })
    await fundPrepaidMailOrder(payload, order, user)
    if (order.paymentProvider === "mollie" && order.state === "accepted") destination = await createMailPayment(payload, order.id)
  } catch {
    return { ok: false, message: user.language === "nl" ? "De bestelling kon niet worden afgerond. Controleer de actuele prijs en voorwaarden." : "The order could not be completed. Review the current price and agreements." }
  }
  revalidatePath(basePath)
  redirect(destination)
}

export async function confirmCustomerMailOrder(_previous: { message: string } | null, formData: FormData): Promise<{ message: string } | null> {
  const { user, ctx, basePath } = await requireMailWorkspace(formData.get("tenantId"))
  if (ctx.mode !== "tenant" || ctx.tenant.status !== "active") return { message: user.language === "nl" ? "Bestellen is nu niet beschikbaar." : "Ordering is unavailable." }
  const payload = await getPayload({ config })
  let destination = basePath
  try {
    const runId = Number(formData.get("runId"))
    if (!Number.isSafeInteger(runId) || runId < 1) throw new Error("Invalid email request.")
    const legalLocale = formData.get("legalLocale")
    if (legalLocale !== null && legalLocale !== "nl" && legalLocale !== "en") throw new Error("Unsupported legal language.")
    const order = await acceptMailOrder(payload, { legalLocale: legalLocale ?? undefined, runId, tenantId: ctx.tenant.id, actor: user, legalAccepted: formData.get("acceptOrderTerms") === "on", legalVersion: String(formData.get("legalVersion") ?? "") })
    await fundPrepaidMailOrder(payload, order, user)
    destination = order.paymentProvider === "mollie" && order.state === "accepted" ? await createMailPayment(payload, order.id) : `${basePath}?request=${runId}`
  } catch {
    return { message: user.language === "nl" ? "Je bestelling kon niet worden bevestigd. Vernieuw de prijs of neem contact op met Siteinabox." : "Your order could not be confirmed. Refresh the price or contact Siteinabox." }
  }
  revalidatePath(basePath)
  redirect(destination)
}

export async function refreshCustomerMailQuote(formData: FormData) {
  const { ctx, basePath } = await requireMailWorkspace(formData.get("tenantId"))
  if (ctx.mode !== "tenant") throw new Error("Customer workspace required.")
  const payload = await getPayload({ config })
  return withCommerceOrderLock(payload, `mail-service:${ctx.tenant.id}`, async () => {
  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  const run = await store.get(Number(formData.get("runId")))
  if (!run || run.tenantId !== ctx.tenant.id || run.data.commerceOrderId) throw new Error("This request cannot be repriced.")
  const service = await loadMailService(payload, ctx.tenant.id)
  const request = run.data.isRenewal === true ? mailRenewalRequest(run.request, service.mailboxes, service.quantity ?? 0) : run.request
  const quote = await prepareMailQuote(payload, ctx.tenant, request, process.env, run.data.isRenewal === true)
  await store.update(run.id, { request, data: { ...run.data, quote }, updatedAt: new Date().toISOString() })
  revalidatePath(basePath)
  })
}

/** Authenticated owner/operator access shares the one-use claim with emailed links. */
export async function revealCustomerMailboxCredential(input: { tenantId: number; runId: number; userPrincipalName: string }) {
  const { user, ctx } = await requireMailWorkspace(String(input.tenantId))
  const unavailable = { ok: false as const, message: user.language === "nl" ? "De instelgegevens zijn niet beschikbaar, verlopen of al geopend." : "Setup details are unavailable, expired or already opened." }
  if (ctx.mode !== "tenant" || ctx.tenant.status !== "active" || !Number.isSafeInteger(input.runId) || input.runId < 1 || !z.string().email().max(320).safeParse(input.userPrincipalName).success) return unavailable
  const encryptionKey = process.env.MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY?.trim()
  if (!encryptionKey) return unavailable
  const payload = await getPayload({ config })
  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  const run = await store.get(input.runId)
  if (!run || run.mode !== "live" || run.tenantId !== ctx.tenant.id || run.state !== "ready" || !run.data.commerceOrderId || !run.request.mailboxUsers.some(mailbox => mailbox.userPrincipalName === input.userPrincipalName)) return unavailable
  const order = await payload.findByID({ collection: "orders", id: Number(run.data.commerceOrderId), depth: 0, overrideAccess: true })
  if (relationshipId(order.tenant) !== String(ctx.tenant.id) || order.paymentStatus !== "paid" || order.state !== "fulfilled") return unavailable
  const service = await loadMailService(payload, ctx.tenant.id)
  if (service.status !== "active") return unavailable
  const claimed = await consumeMicrosoftMailSetupCredential({ payload, runId: input.runId, userPrincipalName: input.userPrincipalName })
  if (!claimed) return unavailable
  const password = decryptMicrosoftMailSetupCredential(claimed.encryptedPassword, encryptionKey)
  payload.logger.info({ event: "microsoft_mail_setup_credential_revealed", tenantId: ctx.tenant.id, runId: input.runId, userPrincipalName: claimed.userPrincipalName, actorId: user.id, actorRole: user.role })
  return { ok: true as const, userPrincipalName: claimed.userPrincipalName, password }
}
