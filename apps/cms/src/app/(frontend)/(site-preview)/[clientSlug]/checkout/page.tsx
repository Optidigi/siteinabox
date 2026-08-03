import type { Metadata } from "next"
import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { getCurrentLegalDocument } from "@siteinabox/legal-content"
import { COMMERCIAL_CATALOG } from "@siteinabox/contracts/commerce"
import { PreviewCheckout } from "@/components/preview/PreviewCheckout"
import { PreviewLoginShell } from "@/components/preview/PreviewLoginShell"
import { previewAuth } from "@/lib/preview/betterAuth"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { loadPreviewGrantContext, normalizePreviewClientSlug } from "@/lib/preview/previewAccess"
import {
  normalizeDomainOrderState,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"
import {
  checkoutProfileView,
  loadLatestCheckoutProfile,
  type CheckoutProfileDraft,
} from "@/lib/checkout/checkoutProfile"
import { loadAcceptedCheckoutResume } from "@/lib/checkout/acceptedCheckoutResume"
import {
  decimalMoneyToMinor,
  issueCheckoutQuoteSet,
  type CheckoutQuoteSet,
} from "@/lib/checkout/checkoutQuote"
import {
  checkPreviewCheckoutDomainAction,
  loadPreviewCheckoutLiveStatusAction,
  recollectAcceptedMigrationInputAction,
  savePreviewCheckoutProgressAction,
  savePreviewCheckoutProfileAction,
  schedulePreviewCheckoutCancellationAction,
  startPreviewCheckoutPaymentAction,
  submitMigrationTransferCodeAction,
} from "./actions"
import {
  automaticMigrationSourceEnabled,
  existingDomainMigrationCheckoutEnabled,
} from "@/lib/domains/migrationCheckout"
import { commerceProviderReadsAllowed } from "@/lib/commerce/releaseGateCore"
import { loadCustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import { loadCustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"
import {
  cloudflareSourceCheckoutEnabled,
  loadCloudflareSourceAuthorizationMetadata,
} from "@/lib/domains/cloudflareSourceOAuth"
import { relationshipId } from "@/lib/relationshipId"
import { loadCustomerBillingAgreement } from "@/lib/billing/customerBillingAgreement"
import { loadCheckoutProgressDraft } from "@/lib/checkout/checkoutProgress"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preview")
  return { title: t("checkoutMetadataTitle") }
}

export default async function PreviewCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>
  searchParams?: Promise<{
    payment?: string | string[]
    cloudflareSource?: string | string[]
  }>
}) {
  if (!(await isPreviewHost())) notFound()

  const { clientSlug } = await params
  const resolvedSearchParams = await searchParams
  const paymentReturn = resolvedSearchParams?.payment === "return"
  const cloudflareSourceValue =
    typeof resolvedSearchParams?.cloudflareSource === "string"
      ? resolvedSearchParams.cloudflareSource
      : null
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
    const oauthEnabled = cloudflareSourceCheckoutEnabled()
    const tenantId = relationshipId(context.tenant)
    const sourceMetadata =
      oauthEnabled &&
      tenantId &&
      cloudflareSourceValue &&
      !["failed", "provider-mismatch"].includes(cloudflareSourceValue)
        ? await loadCloudflareSourceAuthorizationMetadata(
            context.payload,
            {
              authorizationKey: cloudflareSourceValue,
              generationRunId: context.run.id,
              tenantId,
              clientSlug: context.clientSlug,
              customerEmail: context.customerEmail,
            },
          )
        : null
    const cloudflareSourceAuthorization =
      sourceMetadata?.authorizationKey ?? null
    const cloudflareSourceDomain = sourceMetadata?.domain ?? null
    const payment = context.run.payment && typeof context.run.payment === "object"
      ? context.run.payment as { status?: string | null }
      : null
    const domainOrder = normalizeDomainOrderState(context.run.domainOrder)
    const terms = getCurrentLegalDocument("platform-terms", "nl")
    const privacy = getCurrentLegalDocument("platform-privacy", "nl")
    const registrant = domainOrder.registrant ?? deriveRegistrantDefaults({
      run: context.run,
    })
    const signingSecret = process.env.PAYLOAD_SECRET?.trim()
    if (!signingSecret) {
      throw new Error("PAYLOAD_SECRET is required to issue checkout quotes.")
    }
    const [profileRecord, acceptedResume, initialProgress] = await Promise.all([
      loadLatestCheckoutProfile(context.payload, context.run.id),
      loadAcceptedCheckoutResume(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
        signingSecret,
      }),
      loadCheckoutProgressDraft({ context }),
    ])
    const selectedDomain = acceptedResume?.domain ??
      (domainOrder.status === "ready_to_register" ? domainOrder.domain : null)
    const initialProfile = profileRecord ? checkoutProfileView(profileRecord) : null
    const [migrationStatus, provisioningStatus, billingAgreement] = await Promise.all([
      loadCustomerMigrationStatus(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
      }),
      loadCustomerProvisioningStatus(context.payload, {
        generationRunId: context.run.id,
        customerEmail: context.customerEmail,
      }),
      loadCustomerBillingAgreement(context.payload, {
        generationRunId: context.run.id,
        tenantId: context.tenant.id,
        customerEmail: context.customerEmail,
      }),
    ])
    const initialDetails = initialProfile ?? deriveCheckoutDetails({
      run: context.run,
      registrant,
      tenantName: String(context.tenant.name),
    })
    const initialQuotes = acceptedResume?.quotes ?? (selectedDomain
      ? initialCheckoutQuotes({
          domain: selectedDomain,
          domainOrder,
          profileVersion: initialProfile?.profileVersion ?? 0,
          draftVersion: String(context.run.updatedAt ?? domainOrder.updatedAt ?? ""),
        })
      : null)

    const enabledMigrationSourceMethods = ([
      "cloudflare_api_v1",
      "authorized_axfr_v1",
    ] as const).filter((mechanism) =>
      automaticMigrationSourceEnabled(mechanism) &&
      (mechanism !== "cloudflare_api_v1" || oauthEnabled))
    const existingDomainMigrationEnabled =
      existingDomainMigrationCheckoutEnabled() &&
      commerceProviderReadsAllowed() &&
      enabledMigrationSourceMethods.length > 0

    return (
      <PreviewCheckout
        clientSlug={context.clientSlug}
        customerEmail={context.customerEmail}
        currentDomain={selectedDomain}
        domainReady={Boolean(selectedDomain)}
        initialProfile={initialProfile}
        initialDetails={initialDetails}
        initialQuotes={initialQuotes}
        initialProgress={initialProgress}
        initialStep={
          paymentReturn && initialProfile && initialQuotes
            ? "overview"
            : "domain"
        }
        paymentReturn={paymentReturn}
        existingDomainMigrationEnabled={existingDomainMigrationEnabled}
        enabledMigrationSourceMethods={enabledMigrationSourceMethods}
        cloudflareSourceOAuthEnabled={oauthEnabled}
        cloudflareSourceAuthorization={cloudflareSourceAuthorization}
        cloudflareSourceDomain={cloudflareSourceDomain}
        cloudflareSourceResult={
          sourceMetadata
            ? "connected"
            : cloudflareSourceValue === "failed"
              ? "failed"
              : cloudflareSourceValue === "provider-mismatch"
                ? "provider-mismatch"
                : null
        }
        migrationStatus={migrationStatus}
        provisioningStatus={provisioningStatus}
        billingAgreement={billingAgreement}
        acceptedOrderId={acceptedResume?.orderId ?? null}
        acceptedBillingPeriod={acceptedResume?.billingPeriod ?? null}
        requiresMigrationRecollection={
          acceptedResume?.requiresMigrationRecollection ?? false
        }
        catalog={{
          version: COMMERCIAL_CATALOG.catalogVersion,
          currency: COMMERCIAL_CATALOG.currency,
          vatRateBasisPoints: COMMERCIAL_CATALOG.vat.rateBasisPoints,
          plans: {
            monthly: {
              code: COMMERCIAL_CATALOG.subscriptions.monthly.code,
              netAmountMinor: COMMERCIAL_CATALOG.subscriptions.monthly.netAmountMinor,
            },
            annual: {
              code: COMMERCIAL_CATALOG.subscriptions.annual.code,
              netAmountMinor: COMMERCIAL_CATALOG.subscriptions.annual.netAmountMinor,
            },
          },
          domainIncludedAllowanceNetMinor:
            COMMERCIAL_CATALOG.domain.includedAllowanceNetMinor,
          migrations: {
            automaticNetAmountMinor:
              COMMERCIAL_CATALOG.migrations.automatic.netAmountMinor,
          },
        }}
        paymentStatus={payment?.status ?? "not_started"}
        previewHref={`/${context.clientSlug}`}
        domainSearchHref={`/${context.clientSlug}/checkout/domain-search`}
        quoteDomainAction={checkPreviewCheckoutDomainAction.bind(
          null,
          context.clientSlug,
          { ok: false, message: "" },
        )}
        checkDomainAction={checkPreviewCheckoutDomainAction.bind(null, context.clientSlug)}
        saveProfileAction={savePreviewCheckoutProfileAction.bind(null, context.clientSlug)}
        saveProgressAction={savePreviewCheckoutProgressAction.bind(null, context.clientSlug)}
        startPaymentAction={startPreviewCheckoutPaymentAction.bind(null, context.clientSlug)}
        loadLiveStatusAction={
          loadPreviewCheckoutLiveStatusAction.bind(null, context.clientSlug)
        }
        recollectAcceptedMigrationInputAction={
          recollectAcceptedMigrationInputAction.bind(null, context.clientSlug)
        }
        submitMigrationTransferCodeAction={
          submitMigrationTransferCodeAction.bind(null, context.clientSlug)
        }
        scheduleCancellationAction={
          schedulePreviewCheckoutCancellationAction.bind(
            null,
            context.clientSlug,
          )
        }
        termsHref={`https://www.siteinabox.nl${terms.permanentPath}`}
        privacyHref={`https://www.siteinabox.nl${privacy.permanentPath}`}
        termsVersion={terms.documentVersion}
        privacyVersion={privacy.documentVersion}
        locale={locale}
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

function initialCheckoutQuotes(input: {
  domain: string
  domainOrder: ReturnType<typeof normalizeDomainOrderState>
  profileVersion: number
  draftVersion: string
}): CheckoutQuoteSet | null {
  if (
    !input.domainOrder.providerPriceAmount ||
    input.domainOrder.providerPriceCurrency !== "EUR" ||
    !input.domainOrder.checkedAt
  ) {
    return null
  }
  const secret = process.env.PAYLOAD_SECRET?.trim()
  if (!secret) throw new Error("PAYLOAD_SECRET is required to issue checkout quotes.")
  const providerPriceAmount = input.domainOrder.providerPriceAmount
  const providerQuotedAt = input.domainOrder.checkedAt
  return issueCheckoutQuoteSet({
      providerOperationPriceNetMinor: decimalMoneyToMinor(
        providerPriceAmount,
      ),
      selectedDomain: input.domain,
      providerQuotedAt,
      profileVersion: input.profileVersion,
      draftVersion: input.draftVersion,
    }, secret)
}

function deriveCheckoutDetails(input: {
  run: Awaited<ReturnType<typeof loadPreviewGrantContext>>["run"]
  registrant: DomainRegistrantDetails | null
  tenantName: string
}): CheckoutProfileDraft {
  const normalizedIntake = readObject(input.run.normalizedIntake)
  const generationInput = readObject(input.run.generationInput)
  const generationNormalized = nestedObject(generationInput, "normalizedIntake")
  const companyFacts =
    nestedObject(normalizedIntake, "companyFacts") ??
    nestedObject(generationInput, "companyFacts")
  const intake = asRecord(input.run.intakeSubmission)
  const raw = asRecord(intake?.raw)
  const rawCompany = nestedObject(raw, "company")
  const kvkNumber = (
    readText(rawCompany, ["kvkNumber"]) ??
    readText(companyFacts, ["kvkNumber"]) ??
    readText(normalizedIntake, ["kvkNumber"]) ??
    readText(generationNormalized, ["kvkNumber"]) ??
    ""
  ).replace(/\D/g, "")
  const isRegistered = /^\d{8}$/.test(kvkNumber)
  const companyName =
    input.registrant?.companyName ??
    readText(intake, ["businessName"]) ??
    input.tenantName
  return {
    partyType: isRegistered ? "registered_business" : "business_in_formation",
    firstName: input.registrant?.firstName ?? "",
    lastName: input.registrant?.lastName ?? "",
    registeredBusinessName: isRegistered ? companyName : "",
    kvkNumber: isRegistered ? kvkNumber : "",
    intendedCompanyName: isRegistered ? "" : companyName,
    street: input.registrant?.street ?? "",
    number: input.registrant?.number ?? "",
    suffix: input.registrant?.suffix ?? "",
    zipcode: input.registrant?.zipcode ?? "",
    city: input.registrant?.city ?? "",
    country: input.registrant?.country ?? "NL",
    phoneCountryCode: input.registrant?.phoneCountryCode ?? "+31",
    phoneAreaCode: input.registrant?.phoneAreaCode ?? "",
    phoneSubscriberNumber: input.registrant?.phoneSubscriberNumber ?? "",
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
