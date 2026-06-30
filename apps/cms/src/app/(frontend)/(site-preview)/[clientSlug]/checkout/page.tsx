import type { Metadata } from "next"
import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { PreviewCheckout } from "@/components/preview/PreviewCheckout"
import { PreviewLoginShell } from "@/components/preview/PreviewLoginShell"
import { previewAuth } from "@/lib/preview/betterAuth"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import {
  domainCheckoutPrice,
  domainExtraFeeForProviderPrice,
  normalizeDomainOrderState,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"
import {
  checkPreviewCheckoutDomainAction,
  suggestPreviewCheckoutDomainsAction,
  startPreviewCheckoutPaymentAction,
} from "./actions"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preview")
  return { title: t("checkoutMetadataTitle") }
}

export default async function PreviewCheckoutPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>
}) {
  if (!(await isPreviewHost())) notFound()

  const { clientSlug } = await params
  const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
  if (!normalizedClientSlug) notFound()

  const t = await getTranslations("preview")
  const locale = await getLocale()
  const headerStore = await headers()
  const callbackPath = `/${normalizedClientSlug}/checkout`
  const session = await previewAuth.api.getSession({
    headers: headerStore,
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email

  if (!customerEmail) {
    return (
      <PreviewCheckoutAccessScreen
        clientSlug={normalizedClientSlug}
        callbackPath={callbackPath}
        title={t("loginTitle")}
        description={t("loginDescription")}
      />
    )
  }

  try {
    const context = await loadPreviewGrantContext({
      clientSlug: normalizedClientSlug,
      email: customerEmail,
    })
    const payment = context.run.payment && typeof context.run.payment === "object"
      ? context.run.payment as { status?: string | null }
      : null
    const approval = context.run.clientApproval && typeof context.run.clientApproval === "object"
      ? context.run.clientApproval as { status?: string | null }
      : null
    const domainOrder = normalizeDomainOrderState(context.run.domainOrder)
    const initialPrice = domainPriceLabels(locale, domainOrder)
    const registrant = domainOrder.registrant ?? deriveRegistrantDefaults({
      run: context.run,
    })

    return (
      <PreviewCheckout
        customerEmail={context.customerEmail}
        tenantName={String(context.tenant.name)}
        currentDomain={domainOrder.domain ?? context.tenant.domain}
        domainReady={domainOrder.status === "ready_to_register" && Boolean(domainOrder.domain)}
        registrant={registrant}
        priceLabel={formatCheckoutPrice(locale)}
        initialExtraFeeLabel={initialPrice.extraFeeLabel}
        initialTotalPriceLabel={initialPrice.totalPriceLabel}
        paymentStatus={payment?.status ?? "not_started"}
        approvalStatus={approval?.status ?? "pending"}
        previewHref={`/${context.clientSlug}`}
        checkDomainAction={checkPreviewCheckoutDomainAction.bind(null, context.clientSlug)}
        suggestDomainAlternativesAction={suggestPreviewCheckoutDomainsAction.bind(null, context.clientSlug)}
        startPaymentAction={startPreviewCheckoutPaymentAction.bind(null, context.clientSlug)}
      />
    )
  } catch {
    return (
      <PreviewCheckoutAccessScreen
        clientSlug={normalizedClientSlug}
        callbackPath={callbackPath}
        title={t("accessUnavailableTitle")}
        description={t("accessUnavailableDescription")}
      />
    )
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readText(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return readObject(value)
}

function nestedObject(source: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  return readObject(source?.[key])
}

function splitName(value: string | null): { firstName: string; lastName: string } {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" }
}

function splitPhone(value: string | null): { phoneCountryCode: string; phoneAreaCode: string; phoneSubscriberNumber: string } {
  const cleaned = (value ?? "").replace(/[^\d+]/g, "")
  if (!cleaned) return { phoneCountryCode: "+31", phoneAreaCode: "", phoneSubscriberNumber: "" }
  const withoutCountry = cleaned.startsWith("+31")
    ? cleaned.slice(3)
    : cleaned.startsWith("0031")
      ? cleaned.slice(4)
      : cleaned.startsWith("31") && cleaned.length > 10
        ? cleaned.slice(2)
        : cleaned
  const normalized = withoutCountry.replace(/^0+/, "")
  return {
    phoneCountryCode: cleaned.startsWith("+") || cleaned.startsWith("00") || cleaned.startsWith("31") ? "+31" : "+31",
    phoneAreaCode: normalized.slice(0, 2),
    phoneSubscriberNumber: normalized.slice(2),
  }
}

function splitAddress(value: string | null): { street: string; number: string; suffix: string | null; zipcode: string; city: string } {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? ""
  if (!cleaned) return { street: "", number: "", suffix: null, zipcode: "", city: "" }
  const postcodeMatch = cleaned.match(/\b(\d{4}\s?[a-z]{2})\b\s*(.*)$/i)
  const zipcode = postcodeMatch?.[1]?.toUpperCase().replace(/\s+/, "") ?? ""
  const city = postcodeMatch?.[2]?.replace(/^[,\s]+/, "").trim() ?? ""
  const streetPart = postcodeMatch ? cleaned.slice(0, postcodeMatch.index).replace(/[,\s]+$/, "") : cleaned
  const houseMatch = streetPart.match(/^(.+?)\s+(\d+)\s*([a-z0-9 -]*)?$/i)
  return {
    street: houseMatch?.[1]?.trim() ?? streetPart,
    number: houseMatch?.[2]?.trim() ?? "",
    suffix: houseMatch?.[3]?.trim() || null,
    zipcode,
    city,
  }
}

function deriveRegistrantDefaults(input: {
  run: Awaited<ReturnType<typeof loadPreviewGrantContext>>["run"]
}): DomainRegistrantDetails | null {
  const intake = asRecord(input.run.intakeSubmission)
  const raw = asRecord(intake?.raw)
  const normalizedIntake = readObject(input.run.normalizedIntake)
  const generationInput = readObject(input.run.generationInput)
  const generationNormalized = nestedObject(generationInput, "normalizedIntake")
  const contact = nestedObject(normalizedIntake, "contact") ?? nestedObject(generationNormalized, "contact")
  const companyFacts = nestedObject(normalizedIntake, "companyFacts") ?? nestedObject(generationInput, "companyFacts")
  const intakeBrief = nestedObject(normalizedIntake, "intakeBrief") ?? nestedObject(generationInput, "brief")
  const contactPreferences = nestedObject(intakeBrief, "contactPreferences")
  const rawCompany = nestedObject(raw, "company")
  const rawFinalDetails = nestedObject(raw, "finalDetails")
  const rawContact = nestedObject(raw, "contact")

  const contactName = readText(intake, ["contactName"])
    ?? readText(rawFinalDetails, ["name"])
    ?? readText(contact, ["name", "contactName"])
  const { firstName, lastName } = splitName(contactName)
  const address = splitAddress(
    readText(rawCompany, ["address"])
      ?? readText(rawContact, ["publicAddress"])
      ?? readText(companyFacts, ["address"])
      ?? readText(contactPreferences, ["publicAddress"]),
  )
  const phone = splitPhone(
    readText(rawFinalDetails, ["phone"])
      ?? readText(rawContact, ["phoneNumber"])
      ?? readText(intake, ["contactPhone"])
      ?? readText(contact, ["phone"])
      ?? readText(contactPreferences, ["phoneNumber"]),
  )
  const companyName = readText(intake, ["businessName"])
    ?? readText(rawCompany, ["companyName"])
    ?? readText(normalizedIntake, ["businessName"])
    ?? readText(generationNormalized, ["businessName"])
    ?? readText(companyFacts, ["companyName"])
  const email = readText(intake, ["contactEmail"])
    ?? readText(rawFinalDetails, ["email"])
    ?? readText(raw, ["email"])
    ?? readText(contact, ["email"])

  return {
    companyName,
    firstName,
    lastName,
    email: email ?? "",
    street: address.street,
    number: address.number,
    suffix: address.suffix,
    zipcode: address.zipcode,
    city: address.city,
    country: "NL",
    state: null,
    phoneCountryCode: phone.phoneCountryCode,
    phoneAreaCode: phone.phoneAreaCode,
    phoneSubscriberNumber: phone.phoneSubscriberNumber,
    locale: "nl_NL",
  }
}

function formatMoney(locale: string, amount: string | null | undefined, currency = "EUR"): string | null {
  if (!amount) return null

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return `${currency} ${amount}`

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(numericAmount)
}

function formatCheckoutPrice(locale: string): string {
  return formatMoney(
    locale,
    process.env.MOLLIE_SITE_PAYMENT_AMOUNT?.trim(),
    process.env.MOLLIE_SITE_PAYMENT_CURRENCY?.trim() || "EUR",
  ) ?? "EUR --"
}

function domainPriceLabels(locale: string, domainOrder: ReturnType<typeof normalizeDomainOrderState>) {
  const baseAmount = process.env.MOLLIE_SITE_PAYMENT_AMOUNT?.trim()
  const baseCurrency = process.env.MOLLIE_SITE_PAYMENT_CURRENCY?.trim() || "EUR"
  const providerPrice = domainOrder.providerPriceAmount && domainOrder.providerPriceCurrency
    ? { amount: domainOrder.providerPriceAmount, currency: domainOrder.providerPriceCurrency }
    : null
  const includedProviderPrice = domainOrder.maxProviderPriceAmount && domainOrder.maxProviderPriceCurrency
    ? { amount: domainOrder.maxProviderPriceAmount, currency: domainOrder.maxProviderPriceCurrency }
    : null
  if (!baseAmount || !includedProviderPrice) return { extraFeeLabel: null, totalPriceLabel: null }
  const extraFee = domainExtraFeeForProviderPrice(providerPrice, includedProviderPrice)
  const totalPrice = domainCheckoutPrice({
    basePrice: { amount: baseAmount, currency: baseCurrency },
    providerPrice,
    includedProviderPrice,
  })
  return {
    extraFeeLabel: formatMoney(locale, extraFee?.amount, extraFee?.currency ?? baseCurrency),
    totalPriceLabel: formatMoney(locale, totalPrice.amount, totalPrice.currency),
  }
}

function PreviewCheckoutAccessScreen({
  clientSlug,
  callbackPath,
  title,
  description,
}: {
  clientSlug: string
  callbackPath: string
  title: string
  description: string
}) {
  return (
    <PreviewLoginShell
      clientSlug={clientSlug}
      callbackPath={callbackPath}
      title={title}
      description={description}
    />
  )
}
