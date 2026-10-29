"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireMailWorkspace } from "./workspaceAccess"
import { parseMicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
import { createMicrosoftMailProvisioningKey } from "@/lib/microsoftMailProvisioning/state"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { prepareMailQuote, acceptMailOrder, createMailPayment } from "@/lib/microsoftMailProvisioning/commerce"
import { redirect } from "next/navigation"
import { fundSponsoredMailOrder } from "@/lib/microsoftMailProvisioning/commerce"
import { loadMailService } from "@/lib/microsoftMailProvisioning/commerce"
import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { mailRenewalRequest } from "@/lib/microsoftMailProvisioning/renewalRequest"

const mcaDocumentUrl = "https://aka.ms/customeragreement"
const consentCopyVersion = "siteinabox-m365-mail-consent-2026-10-26-v1"

const stableJson = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

type CustomerMailRequestActionState =
  | { ok: true; message: string; requestId: string }
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

  const signatoryFirstName = String(formData.get("signatoryFirstName") ?? "").trim()
  const signatoryLastName = String(formData.get("signatoryLastName") ?? "").trim()
  const signatoryEmail = String(formData.get("signatoryEmail") ?? "").trim().toLowerCase()
  if (!signatoryFirstName || !signatoryLastName || signatoryFirstName.length > 128 || signatoryLastName.length > 128 || !z.string().email().safeParse(signatoryEmail).success) {
    return { ok: false, message: "Complete the agreement contact details." }
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
  return withCommerceOrderLock(payload, `mail-service:${ctx.tenant.id}`, async () => {
  let quote: Awaited<ReturnType<typeof prepareMailQuote>>
  try { quote = await prepareMailQuote(payload, ctx.tenant, parsed.value) }
  catch { return { ok: false, message: "We could not prepare your email order. Check the details or contact Siteinabox." } }

  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  const idempotencyKey = `${createMicrosoftMailProvisioningKey({
    tenantId: parsed.value.tenantId,
    domain: parsed.value.domain,
    mailboxAddresses: parsed.value.mailboxUsers.map((mailbox) => mailbox.userPrincipalName),
    product: parsed.value.product,
  })}:live`
  const existing = await store.findByIdempotencyKey(idempotencyKey)
  const consentAt = new Date().toISOString()
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
    if (stableJson(existing.request) !== stableJson(parsed.value)) {
      return { ok: false, message: "A request for these mailboxes already exists with different details. Contact Siteinabox support to change it." }
    }
    if (existing.data.commerceOrderId) {
      revalidatePath(basePath)
      return { ok: true, message: "Your request is already saved. You can follow its progress below.", requestId: String(existing.id) }
    }
    const updated = await store.update(existing.id, {
      data: { ...existing.data, customerConsent: consentRecord, quote, mailServiceId: quote.serviceId },
      updatedAt: consentAt,
    })
    revalidatePath(basePath)
    revalidatePath("/operations/microsoft-mail")
      return { ok: true, message: "Your request has been received.", requestId: String(updated.id) }
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
    data: { customerConsent: consentRecord, requestSource: user.role === "super-admin" ? "operator_customer_ui" : "customer_dashboard", quote, mailServiceId: quote.serviceId },
    actionUrl: null,
    issueCode: null,
    createdAt: consentAt,
    updatedAt: consentAt,
  })

  revalidatePath(basePath)
  revalidatePath("/operations/microsoft-mail")
  return { ok: true, message: "Your request has been received.", requestId: String(run.id) }
  })
}

export async function confirmCustomerMailOrder(_previous: { message: string } | null, formData: FormData): Promise<{ message: string } | null> {
  const { user, ctx, basePath } = await requireMailWorkspace(formData.get("tenantId"))
  if (ctx.mode !== "tenant" || ctx.tenant.status !== "active") return { message: user.language === "nl" ? "Bestellen is nu niet beschikbaar." : "Ordering is unavailable." }
  const payload = await getPayload({ config })
  let destination = basePath
  try {
    const runId = Number(formData.get("runId"))
    if (!Number.isSafeInteger(runId) || runId < 1) throw new Error("Invalid email request.")
    const order = await acceptMailOrder(payload, { runId, tenantId: ctx.tenant.id, actor: user, legalAccepted: formData.get("acceptOrderTerms") === "on", legalVersion: String(formData.get("legalVersion") ?? "") })
    await fundSponsoredMailOrder(payload, order, user)
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
