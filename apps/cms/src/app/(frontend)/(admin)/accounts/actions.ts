"use server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { domainToASCII } from "node:url"

export async function saveCustomerPolicy(form: FormData) {
  const { user } = await requireRole(["super-admin"])
  const id = Number(form.get("tenantId"))
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid customer.")
  const payload = await getPayload({ config })
  const services = [form.get("website") === "on" ? "website" : null, form.get("email") === "on" ? "email" : null].filter((v): v is "website" | "email" => v !== null)
  if (!services.length) throw new Error("Enable at least one service.")
  const mode = form.get("platformExempt") === "on" ? "exempt" : "standard"
  const reason = String(form.get("reason") ?? "").trim()
  if (mode === "exempt" && !reason) throw new Error("Give a reason for the platform pricing exemption.")
  const expires = String(form.get("expiresAt") ?? "").trim()
  const domain = domainToASCII(String(form.get("mailDomain") ?? "").trim().toLowerCase())
  if (domain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new Error("Invalid email domain.")
  await withCommerceOrderLock(payload, `mail-service:${id}`, () => withCommerceOrderLock(payload, `customer-policy:${id}`, async () => {
    const current = await payload.findByID({ collection: "tenants", id, depth: 0, overrideAccess: true })
    const found = await payload.find({ collection: "microsoft-mail-services", where: { tenant: { equals: id } }, limit: 1, overrideAccess: true })
    const service = found.docs[0]
    const pending = await payload.find({ collection: "orders", where: { and: [
      { tenant: { equals: id } }, { orderKind: { in: ["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"] } }, { state: { in: ["accepted", "fulfillment_pending"] } },
    ] }, limit: 1, depth: 0, overrideAccess: true })
    if (pending.docs.length && (!services.includes("email") || domain && service?.domain !== domain)) throw new Error("Complete the pending email order before changing its domain or disabling email.")
    if (expires && !Number.isFinite(Date.parse(expires))) throw new Error("Invalid exemption end date.")
    if (!services.includes("website") && current.activeSnapshot) throw new Error("Retire the published website before removing its service.")
    if (!services.includes("email") && service && ["active", "provisioning", "attention"].includes(service.status)) throw new Error("End the paid email service before disabling customer access.")
    if (domain && service && service.domain !== domain && service.status !== "draft") throw new Error("An active email domain cannot be reassigned.")
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("The account transaction could not start.")
    const req = { transactionID, user }
    try {
      await payload.update({ collection: "tenants", id, data: {
        enabledServices: services, emailPaymentMethod: form.get("externalEmailBilling") === "on" ? "manual" : "mollie",
        platformPricing: { mode, reason, expiresAt: expires ? new Date(expires).toISOString() : null },
      }, req, overrideAccess: true, context: { tenantCommercialPolicyMutation: true } })
      if (domain && services.includes("email")) {
        const data = { tenant: id, domain, domainAuthorizedAt: new Date().toISOString(), domainAuthorizedBy: user.id }
        if (service) await payload.update({ collection: "microsoft-mail-services", id: service.id, data, req, overrideAccess: true, context: { microsoftMailServiceMutation: true } })
        else await payload.create({ collection: "microsoft-mail-services", data: { ...data, status: "draft" }, req, overrideAccess: true, context: { microsoftMailServiceMutation: true } })
      }
      if ((current.platformPricing?.mode ?? "standard") !== mode || (current.platformPricing?.expiresAt ?? null) !== (expires ? new Date(expires).toISOString() : null)) {
        const agreements = await payload.find({ collection: "billing-agreements", where: { and: [{ tenant: { equals: id } }, { state: { in: ["active", "past_due", "pending_first_payment", "mandate_pending"] } }] }, limit: 100, depth: 0, overrideAccess: true, req })
        for (const agreement of agreements.docs) await payload.update({ collection: "billing-agreements", id: agreement.id,
          data: { reconciliationRequired: true, adminExceptionCode: "customer_platform_pricing_changed", adminExceptionAt: new Date().toISOString() },
          req, overrideAccess: true, context: { billingAgreementLifecycleMutation: true } })
      }
      await payload.db.commitTransaction(transactionID)
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  }))
  revalidatePath(`/accounts/${id}`)
  revalidatePath("/accounts")
}

export async function createCustomerWorkspace(form: FormData) {
  await requireRole(["super-admin"])
  const payload = await getPayload({ config })
  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase()
  if (name.length < 2 || !/^[a-z0-9-]+$/.test(slug)) throw new Error("Enter a customer name and URL-safe identifier.")
  const tenant = await payload.create({ collection: "tenants", data: { name, slug, domain: null, status: "active", enabledServices: ["email"] }, overrideAccess: true })
  redirect(`/accounts/${tenant.id}`)
}
