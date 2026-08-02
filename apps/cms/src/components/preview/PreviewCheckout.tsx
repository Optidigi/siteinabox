"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleX,
  CreditCard,
  FileText,
  Globe2,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  ReceiptText,
  RefreshCw,
  Rocket,
  Server,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@siteinabox/ui/components/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@siteinabox/ui/components/sheet"
import { cn } from "@siteinabox/ui/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@siteinabox/ui/components/toggle-group"
import { tldUsesIcannTransferPolicy } from "@siteinabox/contracts/tld-capabilities"

import { CheckoutStepper } from "@/components/preview/CheckoutStepper"
import {
  createCheckoutPresentation,
  type CheckoutDecision,
} from "@/components/preview/checkout/checkoutPresentation"
import { MobileCheckoutBar } from "@/components/preview/checkout/MobileCheckoutBar"
import { OrderSummaryRail } from "@/components/preview/checkout/OrderSummaryRail"
import { AcceptanceCheckbox } from "@/components/preview/checkout/AcceptanceCheckbox"
import { CheckoutTextField } from "@/components/preview/checkout/CheckoutTextField"
import { DomainSuggestions } from "@/components/preview/checkout/DomainSuggestions"
import { LifecycleRow } from "@/components/preview/checkout/LifecycleRow"
import { MigrationSourceEvidenceFields } from "@/components/preview/checkout/MigrationSourceEvidenceFields"
import { ReviewGroup, ReviewDetail } from "@/components/preview/checkout/ReviewGroup"
import type {
  CheckoutProfileDraft,
  CheckoutProfileView,
} from "@/lib/checkout/checkoutProfile"
import type { CheckoutQuoteSet } from "@/lib/checkout/checkoutQuote"
import type { CustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import type { CustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"
import { previewDomainCandidates } from "@/lib/domains/previewDomainCandidates"
import type { CustomerBillingAgreementView } from "@/lib/billing/customerBillingAgreement"
import type {
  MigrationCustomerActionState,
  PreviewCheckoutActionState,
  PreviewCheckoutCancellationState,
  PreviewCheckoutDomainOption,
  PreviewCheckoutLiveStatus,
  PreviewCheckoutProfileActionState,
  PreviewCheckoutSuggestionsState,
} from "@/lib/checkout/previewCheckoutContract"

export type {
  MigrationCustomerActionState,
  PreviewCheckoutActionState,
  PreviewCheckoutCancellationState,
  PreviewCheckoutDomainOption,
  PreviewCheckoutLiveStatus,
  PreviewCheckoutProfileActionState,
  PreviewCheckoutSuggestionsState,
} from "@/lib/checkout/previewCheckoutContract"

type PreviewCheckoutAction = (
  previousState: PreviewCheckoutActionState,
  formData: FormData,
) => Promise<PreviewCheckoutActionState>

type PreviewCheckoutProfileAction = (
  previousState: PreviewCheckoutProfileActionState,
  formData: FormData,
) => Promise<PreviewCheckoutProfileActionState>

type LegacyCheckoutStep = "domain" | "details" | "overview"
type CheckoutStep = CheckoutDecision
type BillingPeriod = "monthly" | "annual"
type DetailsGroup = "company" | "contact" | "address"
type AutomaticMigrationSourceMethod =
  | "cloudflare_api_v1"
  | "authorized_axfr_v1"
const checkoutStepOrder: CheckoutStep[] = ["domain", "review"]

export type PreviewCheckoutCatalog = {
  version: string
  currency: "EUR"
  vatRateBasisPoints: number
  plans: Record<BillingPeriod, {
    code: string
    netAmountMinor: number
  }>
  domainIncludedAllowanceNetMinor: number
  migrations: {
    automaticNetAmountMinor: number
  }
}

type PreviewCheckoutProps = {
  clientSlug?: string
  customerEmail: string
  currentDomain?: string | null
  domainReady?: boolean
  initialProfile?: CheckoutProfileView | null
  initialDetails: CheckoutProfileDraft
  initialQuotes?: CheckoutQuoteSet | null
  supportedDomainExtensions?: string[]
  initialStep?: LegacyCheckoutStep
  paymentReturn?: boolean
  existingDomainMigrationEnabled?: boolean
  enabledMigrationSourceMethods?: AutomaticMigrationSourceMethod[]
  cloudflareSourceOAuthEnabled?: boolean
  cloudflareSourceAuthorization?: string | null
  cloudflareSourceDomain?: string | null
  cloudflareSourceResult?: "connected" | "failed" | "provider-mismatch" | null
  migrationStatus?: CustomerMigrationStatus | null
  provisioningStatus?: CustomerProvisioningStatus | null
  billingAgreement?: CustomerBillingAgreementView | null
  acceptedOrderId?: string | number | null
  requiresMigrationRecollection?: boolean
  catalog: PreviewCheckoutCatalog
  paymentStatus: string
  previewHref: string
  prewarmHref: string
  suggestionsHref: string
  checkDomainAction: PreviewCheckoutAction
  saveProfileAction: PreviewCheckoutProfileAction
  startPaymentAction: PreviewCheckoutAction
  loadLiveStatusAction?: () => Promise<PreviewCheckoutLiveStatus>
  recollectAcceptedMigrationInputAction?: (
    formData: FormData,
  ) => Promise<MigrationCustomerActionState>
  submitMigrationTransferCodeAction?: (
    formData: FormData,
  ) => Promise<MigrationCustomerActionState>
  scheduleCancellationAction?: (
    previousState: PreviewCheckoutCancellationState,
    formData: FormData,
  ) => Promise<PreviewCheckoutCancellationState>
  termsHref: string
  privacyHref: string
  termsVersion: string
  privacyVersion: string
  businessUseDeclarationVersion: string
  businessUseDeclarationText: string
  locale: string
}

const initialActionState: PreviewCheckoutActionState = { ok: false, message: "" }
const initialProfileActionState: PreviewCheckoutProfileActionState = {
  ok: false,
  message: "",
  status: "idle",
}
const initialSuggestionsState: PreviewCheckoutSuggestionsState = {
  ok: false,
  suggestions: [],
  cursor: 0,
  done: false,
}
const initialMigrationActionState: MigrationCustomerActionState = {
  ok: false,
  status: "idle",
  message: "",
}
const initialCancellationState: PreviewCheckoutCancellationState = {
  ok: false,
  status: "idle",
  message: "",
}

export const checkoutStatusNeedsPolling = (input: {
  paymentReturn: boolean
  paymentStatus: string
  migrationStatus: CustomerMigrationStatus | null
  provisioningStatus: CustomerProvisioningStatus | null
}): boolean => {
  if (!input.paymentReturn) return false
  if (
    ["failed", "canceled", "cancelled", "expired"].includes(
      input.paymentStatus,
    )
  ) {
    return false
  }
  if (
    input.provisioningStatus?.stages.some(
      (stage) =>
        stage.status === "review" ||
        (stage.code === "activation" && stage.status === "complete"),
    )
  ) {
    return false
  }
  if (input.migrationStatus) {
    if (
      ["completed", "custom_quote_required", "failed", "rolled_back"]
        .includes(input.migrationStatus.state)
    ) {
      return false
    }
    if (
      input.migrationStatus.actions.some((action) =>
        ["required", "failed", "overdue"].includes(action.status))
    ) {
      return false
    }
  }
  return true
}

const placeholderSuggestionsForDomain = (domain: string): PreviewCheckoutDomainOption[] =>
  previewDomainCandidates(domain).slice(0, 5).map((candidate) => ({
    domain: candidate,
    included: true,
    extraFeeAmount: null,
    extraFeeCurrency: null,
  }))

const money = (locale: string, minor: number, currency: string): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100)

const nextRequestToken = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

const checkoutFieldId = (field: string): string | null => ({
  firstName: "checkout-first-name",
  lastName: "checkout-last-name",
  registeredBusinessName: "checkout-business-name",
  kvkNumber: "checkout-kvk",
  intendedCompanyName: "checkout-intended-company",
  street: "checkout-street",
  number: "checkout-number",
  suffix: "checkout-suffix",
  zipcode: "checkout-postcode",
  city: "checkout-city",
  country: "checkout-country",
  phoneCountryCode: "checkout-phone-country",
  phoneAreaCode: "checkout-phone-area",
  phoneSubscriberNumber: "checkout-phone-number",
  euEligibilityBasis: "checkout-eu-eligibility-basis",
  euEligibilityCountry: "checkout-eu-eligibility-country",
} as Record<string, string>)[field] ?? null

export function PreviewCheckout({
  clientSlug = "",
  customerEmail,
  currentDomain,
  domainReady = false,
  initialProfile,
  initialDetails,
  initialQuotes = null,
  supportedDomainExtensions = ["nl", "com", "eu"],
  initialStep = "domain",
  paymentReturn = false,
  existingDomainMigrationEnabled = false,
  enabledMigrationSourceMethods = [],
  cloudflareSourceOAuthEnabled = false,
  cloudflareSourceAuthorization = null,
  cloudflareSourceDomain = null,
  cloudflareSourceResult = null,
  migrationStatus: initialMigrationStatus = null,
  provisioningStatus: initialProvisioningStatus = null,
  billingAgreement: initialBillingAgreement = null,
  acceptedOrderId = null,
  requiresMigrationRecollection = false,
  catalog,
  paymentStatus,
  previewHref,
  prewarmHref,
  suggestionsHref,
  checkDomainAction,
  saveProfileAction,
  startPaymentAction,
  loadLiveStatusAction,
  recollectAcceptedMigrationInputAction,
  submitMigrationTransferCodeAction,
  scheduleCancellationAction,
  termsHref,
  privacyHref,
  termsVersion,
  privacyVersion,
  businessUseDeclarationVersion,
  businessUseDeclarationText,
  locale,
}: PreviewCheckoutProps) {
  const t = useTranslations("preview")
  const initialDecision: CheckoutStep = initialStep === "domain" ? "domain" : "review"
  const [step, setStep] = React.useState<CheckoutStep>(initialDecision)
  const [highestReachedStep, setHighestReachedStep] = React.useState(
    checkoutStepOrder.indexOf(initialDecision),
  )
  const [checkState, checkAction, checkPending] = useActionState(
    checkDomainAction,
    initialActionState,
  )
  const [profileState, profileAction, profilePending] = useActionState(
    saveProfileAction,
    initialProfileActionState,
  )
  const [paymentState, paymentAction, paymentPending] = useActionState(
    startPaymentAction,
    initialActionState,
  )
  const [recollectionState, recollectionAction, recollectionPending] =
    useActionState(
      async (
        _previous: MigrationCustomerActionState,
        formData: FormData,
      ) => recollectAcceptedMigrationInputAction
        ? recollectAcceptedMigrationInputAction(formData)
        : initialMigrationActionState,
      initialMigrationActionState,
    )
  const [transferCodeState, transferCodeAction, transferCodePending] =
    useActionState(
      async (
        _previous: MigrationCustomerActionState,
        formData: FormData,
      ) => submitMigrationTransferCodeAction
        ? submitMigrationTransferCodeAction(formData)
        : initialMigrationActionState,
      initialMigrationActionState,
    )
  const [cancellationState, cancellationAction, cancellationPending] =
    useActionState(
      async (
        _previous: PreviewCheckoutCancellationState,
        formData: FormData,
      ) => scheduleCancellationAction
        ? scheduleCancellationAction(_previous, formData)
        : initialCancellationState,
      initialCancellationState,
    )
  const [paymentStatusLive, setPaymentStatusLive] =
    React.useState(paymentStatus)
  const [migrationStatus, setMigrationStatus] =
    React.useState(initialMigrationStatus)
  const [provisioningStatus, setProvisioningStatus] =
    React.useState(initialProvisioningStatus)
  const [billingAgreement, setBillingAgreement] =
    React.useState(initialBillingAgreement)
  const [details, setDetails] = React.useState<CheckoutProfileDraft>(
    initialProfile ?? initialDetails,
  )
  const [savedProfile, setSavedProfile] = React.useState<CheckoutProfileView | null>(
    initialProfile ?? null,
  )
  const [detailsDirty, setDetailsDirty] = React.useState(!initialProfile)
  const [detailsEditorOpen, setDetailsEditorOpen] = React.useState(!initialProfile)
  const [detailsEditorGroup, setDetailsEditorGroup] = React.useState<DetailsGroup>(() => {
    if (!initialDetails.firstName || !initialDetails.lastName || !initialDetails.phoneSubscriberNumber) return "contact"
    if (!initialDetails.registeredBusinessName && !initialDetails.intendedCompanyName) return "company"
    return "address"
  })
  const [billingPeriod, setBillingPeriod] = React.useState<BillingPeriod>(
    initialQuotes?.annual.quote.billingPeriod ?? "annual",
  )
  const [domainMode, setDomainMode] = React.useState<
    "new_registration" | "existing_domain"
  >(
    cloudflareSourceAuthorization
      ? "existing_domain"
      : initialQuotes?.annual.quote.domainMode ?? "new_registration",
  )
  const [migrationSourceMethod, setMigrationSourceMethod] =
    React.useState<AutomaticMigrationSourceMethod | "">(() => {
      const source = initialQuotes?.annual.quote.migrationSourceMechanism
      if (cloudflareSourceAuthorization) return "cloudflare_api_v1"
      return source === "cloudflare_api_v1" || source === "authorized_axfr_v1"
        ? source
        : ""
    })
  const [quotes, setQuotes] = React.useState<CheckoutQuoteSet | null>(initialQuotes)
  const [migrationPreflight, setMigrationPreflight] = React.useState<{
    domain: string
    publicEvidence: PreviewCheckoutActionState["migrationPublicEvidence"]
    releaseBlocked: boolean
  } | null>(null)
  const [suggestionsState, setSuggestionsState] =
    React.useState<PreviewCheckoutSuggestionsState>(initialSuggestionsState)
  const [suggestionsPending, setSuggestionsPending] = React.useState(false)
  const readyDomain = domainReady && currentDomain ? currentDomain : null
  const [domainValue, setDomainValue] = React.useState(
    cloudflareSourceDomain ?? readyDomain ?? "",
  )
  const [checkedDomain, setCheckedDomain] = React.useState<string | null>(readyDomain)
  const selectedExtensions = React.useMemo(
    () => supportedDomainExtensions.slice(0, 4),
    [supportedDomainExtensions],
  )
  const [extensionResults, setExtensionResults] = React.useState<PreviewCheckoutActionState[]>([])
  const [extensionCheckPending, setExtensionCheckPending] = React.useState(false)
  const [premiumInfoDomain, setPremiumInfoDomain] = React.useState<string | null>(null)
  const extensionRequestRef = React.useRef<string | null>(null)
  const domainFormRef = React.useRef<HTMLFormElement | null>(null)
  const domainRequestTokenRef = React.useRef<HTMLInputElement | null>(null)
  const latestDomainRequestTokenRef = React.useRef<string | null>(null)
  const profileRequestTokenRef = React.useRef<HTMLInputElement | null>(null)
  const latestProfileRequestTokenRef = React.useRef<string | null>(null)
  const paymentFormRef = React.useRef<HTMLFormElement | null>(null)
  const stepHeadingRef = React.useRef<HTMLHeadingElement | null>(null)
  const profileErrorSummaryRef = React.useRef<HTMLDivElement | null>(null)
  const detailsEditorTriggerRef = React.useRef<HTMLElement | null>(null)
  const lastSubmittedDomainRef = React.useRef<string | null>(readyDomain)
  const [paymentSubmitRequested, setPaymentSubmitRequested] = React.useState(false)
  const [previewApprovalAccepted, setPreviewApprovalAccepted] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [businessUseAccepted, setBusinessUseAccepted] = React.useState(false)
  const [legalSubmitRequested, setLegalSubmitRequested] = React.useState(false)
  const suggestionsAbortRef = React.useRef<AbortController | null>(null)
  const lastSuggestionsRequestKeyRef = React.useRef<string | null>(null)
  const normalizedDomainValue = domainValue.trim().toLowerCase()
  const detectedMigrationDnsProvider =
    checkState.migrationPublicEvidence?.probableDnsProvider ??
    migrationPreflight?.publicEvidence?.probableDnsProvider ??
    null
  const availableMigrationSourceMethods = React.useMemo(
    () => enabledMigrationSourceMethods.filter((method) =>
      method !== "cloudflare_api_v1" ||
      (
        cloudflareSourceOAuthEnabled &&
        detectedMigrationDnsProvider === "cloudflare"
      )
    ),
    [
      cloudflareSourceOAuthEnabled,
      detectedMigrationDnsProvider,
      enabledMigrationSourceMethods,
    ],
  )
  const checkTokenIsCurrent = !checkState.requestToken ||
    checkState.requestToken === latestDomainRequestTokenRef.current
  const checkMechanismIsCurrent =
    domainMode !== "existing_domain" ||
    checkState.migrationPreflightOnly === true ||
    checkState.migrationSourceMechanism === migrationSourceMethod
  const checkAppliesToCurrentInput = Boolean(
    checkTokenIsCurrent &&
    checkMechanismIsCurrent &&
    checkState.domain &&
    checkState.domain === normalizedDomainValue &&
    (checkState.domainMode ?? "new_registration") === domainMode,
  )
  const activeMigrationPublicEvidence = checkAppliesToCurrentInput
    ? checkState.migrationPublicEvidence
    : migrationPreflight?.domain === normalizedDomainValue
      ? migrationPreflight.publicEvidence
      : null
  const migrationTransferBlocked = Boolean(
    (activeMigrationPublicEvidence?.transferBlockers?.length ?? 0) > 0,
  )
  const migrationReleaseBlocked = Boolean(
    checkAppliesToCurrentInput
      ? checkState.migrationReleaseBlocked
      : migrationPreflight?.domain === normalizedDomainValue
        ? migrationPreflight.releaseBlocked
        : false,
  )
  const migrationReadinessLedger = activeMigrationPublicEvidence ? (
    <div className="overflow-hidden rounded-[14px] border bg-card" aria-label={t("checkoutMigrationReadinessLabel")}>
      {[
        { icon: Building2, label: t("checkoutMigrationRegistrarLabel"), detail: t("checkoutMigrationRegistrarDetail"), value: activeMigrationPublicEvidence.registrar ?? t("checkoutUnknown"), warning: false },
        { icon: Server, label: t("checkoutMigrationDnsProviderLabel"), detail: activeMigrationPublicEvidence.authoritativeNameservers.join(", ") || t("checkoutUnknown"), value: activeMigrationPublicEvidence.probableDnsProvider ?? t("checkoutUnknown"), warning: false },
        { icon: ShieldCheck, label: t("checkoutMigrationDnssecLabel"), detail: activeMigrationPublicEvidence.dnssecDsPresent ? t("checkoutMigrationDnssecAction") : t("checkoutMigrationDnssecClear"), value: activeMigrationPublicEvidence.dnssecDsPresent ? t("checkoutMigrationDnssecPresent") : t("checkoutMigrationDnssecAbsent"), warning: activeMigrationPublicEvidence.dnssecDsPresent },
        { icon: LockKeyhole, label: t("checkoutMigrationTransferLockLabel"), detail: activeMigrationPublicEvidence.transferBlockers?.join(", ") || t("checkoutMigrationTransferClear"), value: migrationTransferBlocked || migrationReleaseBlocked ? t("checkoutMigrationTransferBlockedValue") : t("checkoutMigrationTransferClearValue"), warning: migrationTransferBlocked || migrationReleaseBlocked },
      ].map((row) => (
        <div key={row.label} className="grid min-h-[54px] grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 border-b px-3 py-[9px] last:border-b-0 min-[560px]:grid-cols-[26px_minmax(0,1fr)_auto]">
          <span className={cn("grid size-[26px] place-items-center rounded-md", row.warning ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
            <row.icon className="size-3.5" aria-hidden />
          </span>
          <span className="grid min-w-0 gap-0.5"><strong className="text-xs">{row.label}</strong><span className="[overflow-wrap:anywhere] text-[0.6875rem] leading-snug text-muted-foreground">{row.detail}</span></span>
          <span className={cn("col-start-2 text-xs font-semibold min-[560px]:col-start-auto min-[560px]:text-right", row.warning && "text-warning")}>{row.value}</span>
        </div>
      ))}
    </div>
  ) : null
  const suggestionsApplyToCurrentInput = Boolean(
    suggestionsState.domain && suggestionsState.domain === normalizedDomainValue,
  )
  const domainLooksCheckable =
    normalizedDomainValue.includes(".") && normalizedDomainValue.length >= 5

  React.useEffect(() => {
    if (cancellationState.agreement) {
      setBillingAgreement(cancellationState.agreement)
    }
  }, [cancellationState.agreement])

  React.useEffect(() => {
    const customerActionJustSaved =
      transferCodeState.ok && transferCodeState.status === "saved"
    if (
      !loadLiveStatusAction ||
      (
        !customerActionJustSaved &&
        !checkoutStatusNeedsPolling({
          paymentReturn: paymentReturn || customerActionJustSaved,
          paymentStatus: paymentStatusLive,
          migrationStatus,
          provisioningStatus,
        })
      )
    ) {
      return
    }

    let stopped = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const schedule = (delay: number) => {
      timeout = setTimeout(() => {
        void poll()
      }, delay)
    }
    const poll = async () => {
      if (stopped) return
      if (document.visibilityState === "hidden") {
        schedule(5_000)
        return
      }
      attempts += 1
      try {
        const next = await loadLiveStatusAction()
        if (stopped) return
        setPaymentStatusLive(next.paymentStatus)
        setMigrationStatus(next.migrationStatus)
        setProvisioningStatus(next.provisioningStatus)
        setBillingAgreement(next.billingAgreement)
        if (
          attempts >= 30 ||
          !checkoutStatusNeedsPolling({
            paymentReturn: paymentReturn || customerActionJustSaved,
            paymentStatus: next.paymentStatus,
            migrationStatus: next.migrationStatus,
            provisioningStatus: next.provisioningStatus,
          })
        ) {
          return
        }
      } catch {
        if (stopped || attempts >= 30) return
      }
      schedule(Math.min(3_000 + attempts * 750, 15_000))
    }
    schedule(1_500)
    return () => {
      stopped = true
      if (timeout) clearTimeout(timeout)
    }
    // The bound server action is stable for this mounted checkout. Restarting
    // the loop on every status projection would create overlapping polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadLiveStatusAction,
    paymentReturn,
    transferCodeState.ok,
    transferCodeState.status,
  ])

  React.useEffect(() => {
    const controller = new AbortController()
    void fetch(prewarmHref, {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
    }).catch(() => {})
    return () => controller.abort()
  }, [prewarmHref])

  React.useEffect(() => {
    if (
      checkState.domain &&
      checkState.domain === normalizedDomainValue &&
      (checkState.domainMode ?? "new_registration") === domainMode &&
      checkTokenIsCurrent &&
      checkMechanismIsCurrent
    ) {
      if (checkState.ok) {
        setCheckedDomain(checkState.domain)
        setDomainValue(checkState.domain)
        setQuotes(checkState.quotes ?? null)
      } else {
        setCheckedDomain(null)
        setQuotes(null)
      }
    }
  }, [
    checkState,
    checkMechanismIsCurrent,
    checkTokenIsCurrent,
    domainMode,
    normalizedDomainValue,
  ])

  React.useEffect(() => {
    if (
      domainMode === "existing_domain" &&
      checkState.migrationPreflightOnly &&
      checkState.domain === normalizedDomainValue &&
      checkTokenIsCurrent
    ) {
      setMigrationPreflight({
        domain: checkState.domain,
        publicEvidence: checkState.migrationPublicEvidence,
        releaseBlocked: checkState.migrationReleaseBlocked === true,
      })
      if (
        checkState.migrationReleaseBlocked ||
        (checkState.migrationPublicEvidence?.transferBlockers?.length ?? 0) > 0
      ) {
        setMigrationSourceMethod("")
      } else if (existingDomainMigrationEnabled) {
        setMigrationSourceMethod(
          availableMigrationSourceMethods[0] ?? "",
        )
      }
    }
  }, [
    checkState,
    checkTokenIsCurrent,
    availableMigrationSourceMethods,
    domainMode,
    existingDomainMigrationEnabled,
    normalizedDomainValue,
  ])

  React.useEffect(() => {
    if (
      profileState.requestToken &&
      profileState.requestToken !== latestProfileRequestTokenRef.current
    ) return
    if (profileState.ok && profileState.profile) {
      setSavedProfile(profileState.profile)
      setDetails(profileState.profile)
      setDetailsDirty(false)
      setDetailsEditorOpen(false)
      if (profileState.quotes) setQuotes(profileState.quotes)
      setStep("review")
      window.setTimeout(() => stepHeadingRef.current?.focus(), 0)
      return
    }
    if (profileState.status === "conflict" && profileState.currentProfile) {
      setSavedProfile(profileState.currentProfile)
      setDetailsDirty(true)
      setStep("review")
    }
  }, [profileState])

  React.useEffect(() => {
    if (paymentSubmitRequested && paymentState.ok && paymentState.checkoutUrl) {
      window.location.assign(paymentState.checkoutUrl)
    }
  }, [paymentState, paymentSubmitRequested])

  React.useEffect(() => {
    if (paymentState.status !== "version_conflict") return
    if (paymentState.quotes) {
      setQuotes(paymentState.quotes)
    } else {
      // Legal documents, accepted-order authority, and provider timestamps are
      // server-owned. Reload the route instead of trying to reconstruct them
      // from stale client props or unlocking an immutable accepted order.
      window.location.assign(window.location.href)
      return
    }
    setPreviewApprovalAccepted(false)
    setTermsAccepted(false)
    setBusinessUseAccepted(false)
  }, [paymentState])

  React.useEffect(() => {
    if (profileState.status !== "invalid") {
      stepHeadingRef.current?.focus()
    }
    setHighestReachedStep((current) =>
      Math.max(current, checkoutStepOrder.indexOf(step)),
    )
  }, [profileState.status, step])

  React.useEffect(() => {
    if (
      profileState.status === "invalid" &&
      (
        !profileState.requestToken ||
        profileState.requestToken === latestProfileRequestTokenRef.current
      )
    ) {
      const fields = Object.keys(profileState.fieldErrors ?? {})
      setDetailsEditorGroup(
        fields.some((field) => ["street", "number", "suffix", "zipcode", "city", "country", "euEligibilityBasis", "euEligibilityCountry"].includes(field))
          ? "address"
          : fields.some((field) => ["partyType", "registeredBusinessName", "kvkNumber", "intendedCompanyName"].includes(field))
            ? "company"
            : "contact",
      )
      setDetailsEditorOpen(true)
      profileErrorSummaryRef.current?.focus()
    }
  }, [profileState])

  React.useEffect(() => {
    if (
      step !== "domain" ||
      domainMode !== "new_registration" ||
      !domainLooksCheckable
    ) return
    const unavailable = Boolean(
      !checkPending &&
      checkAppliesToCurrentInput &&
      !checkState.ok &&
      ["unavailable", "premium"].includes(checkState.status ?? ""),
    )
    if (!unavailable) return
    if (
      suggestionsApplyToCurrentInput &&
      (suggestionsState.done || (suggestionsState.suggestions?.length ?? 0) >= 5)
    ) return
    const existing = suggestionsApplyToCurrentInput
      ? suggestionsState.suggestions ?? []
      : []
    const cursor = suggestionsApplyToCurrentInput ? suggestionsState.cursor ?? 0 : 0
    const requestKey = JSON.stringify({
      domain: normalizedDomainValue,
      cursor,
      existing: existing.map((suggestion) => suggestion.domain),
    })
    if (suggestionsPending && lastSuggestionsRequestKeyRef.current === requestKey) return

    const timer = window.setTimeout(() => {
      suggestionsAbortRef.current?.abort()
      const controller = new AbortController()
      suggestionsAbortRef.current = controller
      lastSuggestionsRequestKeyRef.current = requestKey
      setSuggestionsPending(true)
      void fetch(suggestionsHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          domain: normalizedDomainValue,
          cursor,
          existing: existing.map((suggestion) => suggestion.domain),
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`)
          return await response.json() as PreviewCheckoutSuggestionsState
        })
        .then((nextState) => {
          if (controller.signal.aborted) return
          setSuggestionsState((previousState) => {
            const previousSuggestions =
              previousState.domain === normalizedDomainValue
                ? previousState.suggestions ?? []
                : []
            const nextSuggestions =
              nextState.domain === normalizedDomainValue
                ? nextState.suggestions ?? []
                : []
            const merged = [
              ...previousSuggestions,
              ...nextSuggestions.filter(
                (suggestion) =>
                  !previousSuggestions.some(
                    (existingSuggestion) =>
                      existingSuggestion.domain === suggestion.domain,
                  ),
              ),
            ].slice(0, 5)
            return {
              ok: nextState.ok,
              domain: normalizedDomainValue,
              suggestions: merged,
              cursor: nextState.cursor ?? cursor,
              done: nextState.done || merged.length >= 5,
            }
          })
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          console.error("Preview checkout suggestions request failed", error)
          setSuggestionsState((previousState) => ({
            ok: false,
            domain: normalizedDomainValue,
            suggestions:
              previousState.domain === normalizedDomainValue
                ? previousState.suggestions ?? []
                : [],
            cursor,
            done: true,
          }))
        })
        .finally(() => {
          if (suggestionsAbortRef.current !== controller) return
          suggestionsAbortRef.current = null
          lastSuggestionsRequestKeyRef.current = null
          setSuggestionsPending(false)
        })
    }, suggestionsApplyToCurrentInput ? 0 : 90)
    return () => window.clearTimeout(timer)
  }, [
    checkAppliesToCurrentInput,
    checkPending,
    checkState.ok,
    checkState.status,
    domainLooksCheckable,
    normalizedDomainValue,
    domainMode,
    step,
    suggestionsApplyToCurrentInput,
    suggestionsHref,
    suggestionsPending,
    suggestionsState.done,
    suggestionsState.suggestions,
    suggestionsState.cursor,
  ])

  const extensionSelectionApplies = Boolean(
    checkedDomain && extensionResults.some((result) =>
      result.ok && result.domain === checkedDomain && Boolean(result.quotes)),
  )
  const selectedDomain = checkedDomain &&
    (checkedDomain === normalizedDomainValue || extensionSelectionApplies)
    ? checkedDomain
    : null
  const primaryDomainUnavailable = Boolean(
    domainMode === "new_registration" &&
    !checkPending &&
    checkAppliesToCurrentInput &&
    !checkState.ok &&
    ["unavailable", "premium"].includes(checkState.status ?? ""),
  )
  const suggestions =
    primaryDomainUnavailable && suggestionsApplyToCurrentInput
      ? suggestionsState.suggestions
      : []
  const placeholderSuggestions =
    primaryDomainUnavailable && domainLooksCheckable
      ? placeholderSuggestionsForDomain(normalizedDomainValue)
        .filter(
          (option) =>
            !(suggestions ?? []).some(
              (suggestion) => suggestion.domain === option.domain,
            ),
        )
        .slice(0, Math.max(0, 5 - (suggestions?.length ?? 0)))
      : []
  const domainIsReady = Boolean(
    selectedDomain &&
    quotes &&
    quotes.annual.quote.domainMode === domainMode &&
    (
      extensionResults.some((result) =>
        result.ok && result.domain === selectedDomain && Boolean(result.quotes)) ||
      (checkAppliesToCurrentInput
        ? checkState.ok
        : selectedDomain === readyDomain)
    ),
  )
  const domainResultKind = checkPending
    ? "loading"
    : ["preflight_complete", "release_pending"].includes(checkState.status ?? "") &&
        checkAppliesToCurrentInput
      ? "info"
    : domainIsReady
      ? "success"
      : checkState.message && checkAppliesToCurrentInput
        ? checkState.ok
          ? "success"
          : ["unavailable", "premium"].includes(checkState.status ?? "")
            ? "unavailable"
            : "error"
        : null
  const domainInputState = domainResultKind === "success"
    ? "success"
    : domainResultKind === "unavailable"
      ? "warning"
      : domainResultKind === "error"
        ? "error"
        : null
  const domainDescriptionId = domainInputState === "success"
    ? "checkout-domain-available"
    : domainInputState === "warning"
      ? "checkout-domain-unavailable"
      : domainInputState === "error"
        ? "checkout-domain-error"
        : undefined
  const selectedQuote = quotes?.[billingPeriod] ?? null
  const netAmountMinor = selectedQuote?.quote.netAmountMinor ?? 0
  const vatAmountMinor = selectedQuote?.quote.vatAmountMinor ?? 0
  const grossAmountMinor = selectedQuote?.quote.grossAmountMinor ?? 0

  const updateDomain = (value: string) => {
    suggestionsAbortRef.current?.abort()
    suggestionsAbortRef.current = null
    lastSuggestionsRequestKeyRef.current = null
    setSuggestionsPending(false)
    setDomainValue(value)
    setExtensionResults([])
    setExtensionCheckPending(false)
    extensionRequestRef.current = null
    if (value.trim().toLowerCase() !== checkedDomain) {
      setCheckedDomain(null)
      setQuotes(null)
      setMigrationSourceMethod("")
      setMigrationPreflight(null)
      if (step !== "domain") setStep("domain")
    }
  }

  const checkSelectedExtensions = React.useCallback(async () => {
    const entered = normalizedDomainValue.replace(/^https?:\/\//, "").split("/")[0] ?? ""
    const firstLabel = entered.split(".")[0]?.trim() ?? ""
    if (!firstLabel) return
    const requestToken = nextRequestToken()
    extensionRequestRef.current = requestToken
    setExtensionCheckPending(true)
    setCheckedDomain(null)
    setQuotes(null)
    setExtensionResults([])
    const results = await Promise.all(selectedExtensions.map(async (extension) => {
      const domain = `${firstLabel}.${extension}`
      let result: PreviewCheckoutActionState
      try {
        const formData = new FormData()
        formData.set("domain", domain)
        formData.set("domainMode", "new_registration")
        formData.set("requestToken", requestToken)
        const received = await checkDomainAction(initialActionState, formData)
        result = received ?? {
          ok: false,
          status: "service_error",
          domain,
          domainMode: "new_registration",
          message: t("checkoutDomainServiceUnavailable"),
        }
      } catch {
        result = {
          ok: false,
          status: "service_error" as const,
          domain,
          domainMode: "new_registration" as const,
          message: t("checkoutDomainServiceUnavailable"),
        }
      }
      if (extensionRequestRef.current === requestToken) {
        setExtensionResults((current) => [
          ...current.filter((entry) => entry.domain !== domain),
          result,
        ])
      }
      return result
    }))
    if (extensionRequestRef.current !== requestToken) return
    setExtensionResults(results)
    setExtensionCheckPending(false)
  }, [checkDomainAction, normalizedDomainValue, selectedExtensions, t])

  React.useEffect(() => {
    if (step !== "domain" || domainMode !== "new_registration") return
    const firstLabel = normalizedDomainValue.replace(/^https?:\/\//, "").split(/[./]/)[0]?.trim() ?? ""
    if (firstLabel.length < 2 || selectedExtensions.length === 0) return
    const timer = window.setTimeout(() => void checkSelectedExtensions(), 450)
    return () => window.clearTimeout(timer)
  }, [checkSelectedExtensions, domainMode, normalizedDomainValue, selectedExtensions.length, step])

  const selectExtensionResult = (result: PreviewCheckoutActionState) => {
    if (!result.ok || !result.domain || !result.quotes) return
    setCheckedDomain(result.domain)
    setQuotes(result.quotes)
  }

  // The submitted domain is also one of the live-result rows. Keeping that
  // authoritative action result in the same surface means a manual check never
  // appears to do nothing while the debounced multi-TLD checks are completing.
  React.useEffect(() => {
    if (
      domainMode !== "new_registration" ||
      !checkAppliesToCurrentInput ||
      !checkState.domain
    ) return
    setExtensionResults((current) => [
      checkState,
      ...current.filter((entry) => entry.domain !== checkState.domain),
    ])
  }, [checkAppliesToCurrentInput, checkState, domainMode])

  const updateDomainMode = (mode: "new_registration" | "existing_domain") => {
    if (mode === domainMode) return
    suggestionsAbortRef.current?.abort()
    setDomainMode(mode)
    setCheckedDomain(null)
    setQuotes(null)
    setMigrationSourceMethod("")
    setMigrationPreflight(null)
    setDomainValue("")
    lastSubmittedDomainRef.current = null
  }

  const updateMigrationSourceMethod = (
    method: AutomaticMigrationSourceMethod,
  ) => {
    if (method === migrationSourceMethod) return
    setMigrationSourceMethod(method)
    setCheckedDomain(null)
    setQuotes(null)
  }

  const selectSuggestedDomain = (option: PreviewCheckoutDomainOption) => {
    suggestionsAbortRef.current?.abort()
    suggestionsAbortRef.current = null
    lastSuggestionsRequestKeyRef.current = null
    setSuggestionsPending(false)
    setDomainValue(option.domain)
    setCheckedDomain(null)
    lastSubmittedDomainRef.current = option.domain
    window.setTimeout(() => domainFormRef.current?.requestSubmit(), 0)
  }

  const updateDetail = <K extends keyof CheckoutProfileDraft>(
    key: K,
    value: CheckoutProfileDraft[K],
  ) => {
    setDetails((current) => ({ ...current, [key]: value }))
    setDetailsDirty(true)
  }

  const openDetailsEditor = (group: DetailsGroup, trigger?: HTMLElement) => {
    if (trigger) detailsEditorTriggerRef.current = trigger
    setDetailsEditorGroup(group)
    setDetailsEditorOpen(true)
  }

  const submitPayment = () => {
    if (requiresMigrationRecollection) return
    const firstMissingId = !businessUseAccepted
      ? "checkout-business-use"
        : !termsAccepted
          ? "checkout-terms"
          : !previewApprovalAccepted
            ? "checkout-preview-approval"
            : null
    if (firstMissingId) {
      setLegalSubmitRequested(true)
      window.setTimeout(() => document.getElementById(firstMissingId)?.focus(), 0)
      return
    }
    setLegalSubmitRequested(false)
    setPaymentSubmitRequested(true)
    window.setTimeout(() => paymentFormRef.current?.requestSubmit(), 0)
  }
  const acceptedMigrationDomain =
    initialQuotes?.annual.quote.domainMode === "existing_domain"
      ? initialQuotes.annual.quote.selectedDomain
      : null
  const cloudflareSourceMatchesAcceptedOrder = Boolean(
    acceptedMigrationDomain &&
    cloudflareSourceAuthorization &&
    cloudflareSourceDomain === acceptedMigrationDomain,
  )
  const fulfilmentActive = Boolean(provisioningStatus || migrationStatus || billingAgreement)
  const paymentReturnHasLifecycle = [
    "pending_provider",
    "open",
    "authorized",
    "completed",
    "failed",
    "canceled",
    "cancelled",
    "expired",
  ].includes(paymentStatusLive)
  const paymentActive = paymentReturn && paymentReturnHasLifecycle && !fulfilmentActive
  const actionPaymentStatus = paymentState.status === "payment_pending"
    ? "pending_provider"
    : paymentStatusLive
  const paymentInProgress = paymentPending || ["pending_provider", "open", "authorized"].includes(actionPaymentStatus)
  const presentation = createCheckoutPresentation({
    decision: step,
    paymentActive,
    fulfilmentActive,
    domainReady: domainIsReady,
    profileReady: Boolean(savedProfile && !detailsDirty),
    quoteReady: Boolean(selectedQuote),
    selectedDomain: Boolean(selectedDomain),
    checkPending: checkPending || extensionCheckPending,
    profilePending,
    paymentPending,
    paymentBlocked: requiresMigrationRecollection,
    declarationsAccepted: businessUseAccepted && termsAccepted && previewApprovalAccepted,
    paymentInProgress,
    paymentComplete: actionPaymentStatus === "completed",
    domainResultKind,
    preflightComplete:
      checkState.status === "preflight_complete" &&
      checkAppliesToCurrentInput &&
      !migrationSourceMethod,
    sourceAcquisitionReady: Boolean(
      checkState.status === "preflight_complete" &&
      checkAppliesToCurrentInput &&
      !migrationTransferBlocked &&
      !migrationReleaseBlocked &&
      migrationSourceMethod,
    ),
  })
  const dueNowLabel = money(
    locale,
    grossAmountMinor,
    selectedQuote?.quote.currency ?? catalog.currency,
  )
  const paymentLifecycleStatusLabel = paymentStatusLive === "completed"
    ? t("checkoutPaymentCompleteTitle")
    : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive)
      ? t("checkoutPaymentNotCompletedTitle")
      : t("checkoutPaymentProcessingTitle")
  const addressSheetDescription = domainMode === "existing_domain"
    ? checkAppliesToCurrentInput && checkState.message
      ? checkState.message
      : t("checkoutDomainModeExistingPreflight")
    : t("checkoutDomainHeroDescription")
  const primaryActionHandlers = {
    onDomainNext: () => setStep("review" as const),
    onDomainCheck: () => {
      if (domainMode === "new_registration") void checkSelectedExtensions()
      else domainFormRef.current?.requestSubmit()
    },
    onDetailsNext: () => {
      if (detailsDirty || !savedProfile) setDetailsEditorOpen(true)
      else setStep("review")
    },
    onPay: submitPayment,
  }
  const transferCodeActionRequired = Boolean(migrationStatus?.actions.some((action) =>
    action.action === "provide_epp_code" && ["required", "failed"].includes(action.status)))
  const transferCodeDeadline = migrationStatus?.actions.find((action) =>
    action.action === "provide_epp_code" && ["required", "failed"].includes(action.status))?.deadlineAt

  return (
    <main data-checkout-phase={presentation.phase} className="min-h-dvh bg-muted/25 pb-24 text-foreground dark:bg-background">
      {cloudflareSourceOAuthEnabled && (
        <>
          {domainMode === "existing_domain" && normalizedDomainValue && (
            <form
              id="checkout-cloudflare-source-connect-form"
              method="post"
              action="/api/domain-migration-source/cloudflare/start"
              hidden
            >
              <input type="hidden" name="clientSlug" value={clientSlug} />
              <input type="hidden" name="domain" value={normalizedDomainValue} />
            </form>
          )}
          {migrationStatus?.domain && (
            <form
              id="migration-cloudflare-source-reconnect-form"
              method="post"
              action="/api/domain-migration-source/cloudflare/start"
              hidden
            >
              <input type="hidden" name="clientSlug" value={clientSlug} />
              <input type="hidden" name="domain" value={migrationStatus.domain} />
            </form>
          )}
          {acceptedMigrationDomain && (
            <form
              id="accepted-cloudflare-source-reconnect-form"
              method="post"
              action="/api/domain-migration-source/cloudflare/start"
              hidden
            >
              <input type="hidden" name="clientSlug" value={clientSlug} />
              <input type="hidden" name="domain" value={acceptedMigrationDomain} />
            </form>
          )}
        </>
      )}
      <header data-siab-cms-sticky-chrome className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-xl">
        <div className="grid h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 min-[560px]:h-[52px] min-[560px]:grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] min-[560px]:px-4">
          <div className="flex min-w-0 items-center gap-1">
          <a href={previewHref} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-xs font-semibold">
            <img src="/logos/favicon.svg" alt="" className="size-7 dark:hidden" />
            <img src="/logos/icon-dark.svg" alt="" className="hidden size-7 dark:block" />
          </a>
          </div>
          <div className="hidden items-center gap-2 text-[0.6875rem] font-semibold text-muted-foreground min-[560px]:flex">
            <span>{t("checkoutLaunchWorkspace")}</span>
            <span className="h-0.5 w-14 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full bg-brand", step === "review" ? "w-full" : "w-1/2")} /></span>
            <span>{step === "review" ? "2 / 2" : "1 / 2"}</span>
          </div>
          <div className="flex items-center justify-end">
            <Button asChild variant="ghost" className="h-9 shrink-0 px-2 text-muted-foreground">
              <a href={previewHref}>
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden min-[380px]:inline">{t("checkoutBackToPreview")}</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div data-checkout-shell className="mx-auto grid w-[calc(100%-20px)] min-w-0 max-w-[74rem] content-start gap-4 pb-[98px] pt-[17px] [&>*]:min-w-0 min-[560px]:w-[min(45rem,calc(100%-28px))] min-[560px]:pb-24 min-[560px]:pt-[22px] min-[880px]:w-[calc(100%-40px)] min-[880px]:py-[30px] min-[880px]:pb-24">
        <section className="grid gap-2">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className="text-[1.75rem] font-bold leading-[1.07] tracking-[-0.04em] outline-none min-[880px]:text-[2.5rem]">
                {presentation.phase === "fulfilment" || presentation.phase === "payment"
                  ? t("checkoutLaunchWorkspace")
                    : step === "domain" ? t("checkoutDomainHeroTitle") : t("checkoutReviewHeroTitle")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground min-[880px]:text-[0.9375rem]">
                {presentation.phase === "fulfilment" || presentation.phase === "payment"
                  ? t("checkoutLifecycleShellDescription")
                    : step === "domain" ? t("checkoutDomainHeroDescription") : t("checkoutReviewHeroDescription")}
              </p>
            </div>
        </section>
        <PreviewCheckoutStepper
          step={presentation.phase === "address" ? step : "review"}
          highestReachedStep={presentation.phase === "address" ? highestReachedStep : 1}
          onStepSelect={presentation.phase === "address" || presentation.phase === "review" ? setStep : undefined}
        />

        {(presentation.phase === "payment" || presentation.phase === "fulfilment" || (requiresMigrationRecollection && acceptedOrderId != null)) && (
          <div className={cn("grid min-w-0 gap-[18px]", presentation.phase === "payment" && "min-[880px]:grid-cols-[minmax(0,1fr)_348px] min-[880px]:items-start")}>
          <Card data-checkout-main-card className={cn("relative w-full scroll-mb-28 gap-0 overflow-hidden rounded-[17px] border bg-card py-0 pt-[5px] shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:bg-gradient-to-r before:from-brand before:to-brand/20 min-[560px]:rounded-[22px]", presentation.phase !== "payment" && "mx-auto max-w-[820px]")}>
            <CardContent className="grid gap-[14px] px-[17px] py-5 min-[560px]:gap-[18px] min-[560px]:px-[26px] min-[560px]:py-6 [&_[role=status]]:rounded-[14px] [&_[role=status]]:border [&_[role=status]]:p-[13px]">
        {paymentReturn && presentation.phase === "payment" && (
          <section className="grid justify-items-center gap-3 py-2 text-center min-[560px]:px-5 min-[560px]:pb-5" aria-live="polite">
            <span className={cn("relative grid size-[60px] place-items-center rounded-[18px] bg-brand text-brand-foreground", ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) && "bg-destructive/15 text-destructive", !["failed", "canceled", "cancelled", "expired", "completed"].includes(paymentStatusLive) && "after:absolute after:-inset-[5px] after:rounded-[22px] after:border-2 after:border-current after:opacity-15")}>
              {["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? <CircleAlert className="size-6" aria-hidden /> : paymentStatusLive === "completed" ? <CheckCircle2 className="size-6" aria-hidden /> : <Loader2 className="size-6 animate-spin" aria-hidden />}
            </span>
            <Badge variant={paymentStatusLive === "completed" ? "secondary" : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? "destructive" : "outline"} className="min-h-6 rounded-full px-2 text-[0.625rem] font-bold">
              {t("checkoutOrderReference")}
            </Badge>
            <div>
              <h2 className="text-[21px] font-bold tracking-[-0.03em] min-[560px]:text-2xl">{paymentStatusLive === "completed" ? t("checkoutPaymentCompleteTitle") : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? t("checkoutPaymentNotCompletedTitle") : t("checkoutPaymentProcessingTitle")}</h2>
              <p className="mx-auto mt-[7px] max-w-lg text-sm leading-relaxed text-muted-foreground">
                {paymentStatusLive === "completed" ? t("checkoutPaymentReturnCompleted") : paymentStatusLive === "pending_provider" ? t("checkoutPaymentReturnPending") : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? t("checkoutPaymentReturnFailed") : t("checkoutPaymentReturnUnknown")}
              </p>
            </div>
            {["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) && <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" className="min-h-11 bg-foreground text-background hover:bg-foreground/90" onClick={() => window.location.assign(window.location.pathname)}><RefreshCw className="size-4" aria-hidden />{t("checkoutReviewOrderAction")}</Button>
            </div>}
          </section>
        )}

        {paymentReturn && presentation.phase === "payment" && (
          <ol aria-label={t("checkoutOrderReference")} className="mx-auto w-full max-w-[600px] overflow-hidden rounded-[15px] border bg-card">
            <LifecycleRow icon={ReceiptText} status="complete" title={t("checkoutOrderReference")} detail={t("checkoutSignedQuoteNote")} state={t("checkoutComplete")} />
            <LifecycleRow icon={["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? CircleAlert : CreditCard} status={["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? "action_required" : "active"} title={t("checkoutStepPayment")} detail={paymentStatusLive === "pending_provider" ? t("checkoutPaymentReturnPending") : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? t("checkoutPaymentReturnFailed") : t("checkoutPaymentReturnUnknown")} state={["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive) ? t("checkoutActionRequired") : t("checkoutInProgress")} />
            <LifecycleRow icon={Rocket} status="pending" title={t("checkoutFulfilmentTitle")} detail={t("checkoutPaymentReturnPending")} state={t("checkoutWaiting")} />
          </ol>
        )}

        {presentation.phase === "fulfilment" && !provisioningStatus && (
          <section className="grid justify-items-center gap-3 py-2 text-center min-[560px]:px-5 min-[560px]:pb-5" aria-live="polite">
            <span className="relative grid size-[60px] place-items-center rounded-[18px] bg-brand text-brand-foreground after:absolute after:-inset-[5px] after:rounded-[22px] after:border-2 after:border-current after:opacity-15"><Rocket className="size-[22px]" aria-hidden /></span>
            <Badge variant="outline" className="min-h-6 rounded-full px-2 text-[0.625rem] font-bold">{t("checkoutOrderReference")}</Badge>
            <div>
              <h2 className="text-[21px] font-bold tracking-[-0.03em] min-[560px]:text-2xl">{t("checkoutFulfilmentTitle")}</h2>
              <p className="mx-auto mt-[7px] max-w-lg text-sm leading-relaxed text-muted-foreground">{t("checkoutFulfilmentDescription")}</p>
            </div>
          </section>
        )}

        {provisioningStatus && (
          <section role="status" aria-live="polite" className="grid gap-[14px]">
            <div className="grid justify-items-center gap-3 py-2 text-center min-[560px]:px-5 min-[560px]:pb-5">
              <span className="relative grid size-[60px] place-items-center rounded-[18px] bg-brand text-brand-foreground after:absolute after:-inset-[5px] after:rounded-[22px] after:border-2 after:border-current after:opacity-15"><Rocket className="size-[22px]" aria-hidden /></span>
              <Badge variant="outline" className="min-h-6 rounded-full px-2 text-[0.625rem] font-bold">{t("checkoutOrderReference")}</Badge>
              <div>
                <h2 className="text-[21px] font-bold tracking-[-0.03em] min-[560px]:text-2xl">{t("checkoutProvisioningStatusTitle", { domain: provisioningStatus.domain })}</h2>
                <p className="mx-auto mt-[7px] max-w-lg text-sm leading-relaxed text-muted-foreground">{t("checkoutFulfilmentDescription")}</p>
              </div>
            </div>
            <ol className="mx-auto w-full max-w-[600px] overflow-hidden rounded-[15px] border bg-card">
                {provisioningStatus.stages.map((stage) => (
                  <LifecycleRow key={stage.code} icon={stage.status === "complete" ? CheckCircle2 : stage.status === "action_required" || stage.status === "review" ? CircleAlert : Loader2} status={stage.status} title={provisioningStageLabel(stage.code, t)} detail={provisioningStageStatusLabel(stage.status, t)} state={provisioningStageStatusLabel(stage.status, t)} />
                ))}
            </ol>
              {provisioningStatus.stages.some((stage) =>
                stage.code === "registrant_verification" &&
                stage.status === "action_required") && (
                <div className="mx-auto w-full max-w-[600px] rounded-[14px] border border-warning/30 bg-warning/10 p-[15px] text-left">
                <h3 className="mb-1 text-sm font-bold text-warning">{t("checkoutActionRequired")}</h3>
                <p className="text-xs leading-relaxed text-foreground">
                  {provisioningStatus.registrantVerificationDueAt
                    ? t("checkoutProvisioningVerificationRequiredBy", {
                        deadline: new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(
                          provisioningStatus.registrantVerificationDueAt,
                        )),
                      })
                    : t("checkoutProvisioningVerificationRequired")}
                </p>
                </div>
              )}
          </section>
        )}

        {requiresMigrationRecollection &&
          acceptedOrderId != null &&
          recollectAcceptedMigrationInputAction && (
            <Alert role="alert">
              <Globe2 className="size-4" aria-hidden />
              <AlertTitle>{t("checkoutMigrationRecollectionTitle")}</AlertTitle>
              <AlertDescription>
                <p id="migration-recollection-payment-block">
                  {t("checkoutMigrationRecollectionDescription")}
                </p>
                <form
                  action={recollectionAction}
                  className="mt-4 grid gap-3"
                >
                  <input
                    type="hidden"
                    name="acceptedOrderId"
                    value={acceptedOrderId}
                  />
                  {migrationSourceMethod && (
                    <input
                      type="hidden"
                      name="migrationSourceMethod"
                      value={migrationSourceMethod}
                    />
                  )}
                  {migrationSourceMethod === "cloudflare_api_v1" && (
                    cloudflareSourceOAuthEnabled ? (
                      cloudflareSourceMatchesAcceptedOrder ? (
                        <>
                          <Alert role="status">
                            <AlertTitle>{t("checkoutMigrationCloudflareReconnectedTitle")}</AlertTitle>
                            <AlertDescription>{t("checkoutMigrationCloudflareReconnectedOrderDescription")}</AlertDescription>
                          </Alert>
                          <input
                            type="hidden"
                            name="cloudflareSourceAuthorization"
                            value={cloudflareSourceAuthorization ?? ""}
                          />
                        </>
                      ) : (
                        <Button
                          type="submit"
                          form="accepted-cloudflare-source-reconnect-form"
                          className="w-fit"
                        >
                          {t("checkoutMigrationCloudflareReconnect")}
                        </Button>
                      )
                    ) : (
                      <Alert variant="destructive" role="alert">
                        <AlertTitle>{t("checkoutMigrationCloudflareUnavailableTitle")}</AlertTitle>
                        <AlertDescription>{t("checkoutMigrationCloudflareUnavailableOrderDescription")}</AlertDescription>
                      </Alert>
                    )
                  )}
                  <MigrationSourceEvidenceFields
                    mechanism={migrationSourceMethod || null}
                    idPrefix="accepted"
                  />
                  <Label htmlFor="accepted-migration-transfer-code">
                    {t("checkoutMigrationTransferCodeLabel")}
                  </Label>
                  <Input
                    id="accepted-migration-transfer-code"
                    name="transferCode"
                    type="password"
                    autoComplete="off"
                    required
                  />
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      name="transferAuthorization"
                      value="accepted"
                      required
                      className="mt-1"
                    />
                    <span>{t("checkoutMigrationTransferAuthorization")}</span>
                  </label>
                  <Button
                    type="submit"
                    className="w-fit"
                    disabled={
                      recollectionPending ||
                      (
                        migrationSourceMethod === "cloudflare_api_v1" &&
                        !cloudflareSourceMatchesAcceptedOrder
                      )
                    }
                  >
                    {recollectionPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    {t("checkoutMigrationRecollectionSubmit")}
                  </Button>
                  {recollectionState.message && (
                    <p
                      className={recollectionState.ok
                        ? "text-sm text-foreground"
                        : "text-sm text-destructive"}
                      role={recollectionState.ok ? "status" : "alert"}
                    >
                      {recollectionState.message}
                    </p>
                  )}
                </form>
              </AlertDescription>
            </Alert>
          )}

        {migrationStatus && (
          <Alert role="status" aria-live="polite" className={migrationStatus.actions.some((action) => action.status === "required" || action.status === "failed") ? cn("border-warning/40 bg-warning/10", transferCodeActionRequired && "!grid-cols-[36px_minmax(0,1fr)] gap-x-3.5 [&>svg]:size-9 [&>svg]:translate-y-0") : undefined}>
            {transferCodeActionRequired ? <Link2 className="size-9 rounded-[10px] bg-warning p-2 text-warning-foreground" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
            <AlertTitle className={transferCodeActionRequired ? "text-base text-warning" : undefined}>
              {transferCodeActionRequired ? t("checkoutTransferActionTitle") : t("checkoutMigrationStatusTitle", {
                domain: migrationStatus.domain,
              })}
            </AlertTitle>
            <AlertDescription>
              {transferCodeActionRequired ? <p className="leading-relaxed text-foreground">
                {transferCodeDeadline
                  ? t("checkoutTransferActionDescriptionWithDeadline", {
                      deadline: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(transferCodeDeadline)),
                    })
                  : t("checkoutTransferActionDescription")}
              </p> : <span className="block">
                {t("checkoutMigrationStatusState", {
                  state: migrationStateLabel(migrationStatus.state, t),
                })}
              </span>}
              {!transferCodeActionRequired && migrationStatus.actions.filter((action) =>
                action.status !== "completed").length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {migrationStatus.actions
                    .filter((action) => action.status !== "completed")
                    .map((action) => (
                      <li key={action.action}>
                        {migrationCustomerActionLabel(action.action, t)}
                        {" — "}
                        <span className="font-medium">
                          {migrationCustomerActionStatusLabel(action.status, t)}
                        </span>
                        {action.deadlineAt
                          ? ` — ${t("checkoutMigrationActionDeadline", {
                              deadline: new Intl.DateTimeFormat(locale, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(action.deadlineAt)),
                            })}`
                          : ""}
                      </li>
                    ))}
                </ul>
              )}
              {migrationStatus.actions.some((action) =>
                (
                  action.action === "provide_epp_code" ||
                  action.action === "authorize_provider"
                ) &&
                ["required", "failed"].includes(action.status)) &&
                submitMigrationTransferCodeAction && (
                  <form
                    action={transferCodeAction}
                    className={cn("mt-4 grid gap-3 rounded-[14px] border border-warning/40 bg-warning/10 p-4", transferCodeActionRequired && "border-0 bg-transparent p-0")}
                  >
                    <input
                      type="hidden"
                      name="migrationId"
                      value={migrationStatus.migrationId}
                    />
                    <input
                      type="hidden"
                      name="expectedMigrationVersion"
                      value={migrationStatus.updatedAt}
                    />
                    {!migrationStatus.actions.some((action) =>
                      action.action === "provide_epp_code" &&
                      ["required", "failed"].includes(action.status)) && (
                        <input
                          type="hidden"
                          name="sourceAuthorityOnly"
                          value="accepted"
                        />
                      )}
                    {migrationStatus.actions.some((action) =>
                      (
                        action.action === "upload_complete_zone" ||
                        action.action === "authorize_provider"
                      ) &&
                      ["required", "failed"].includes(action.status)) && (
                        <>
                          {migrationStatus.sourceMechanism ===
                            "cloudflare_api_v1" && (
                              cloudflareSourceOAuthEnabled ? (
                                cloudflareSourceAuthorization &&
                                cloudflareSourceDomain ===
                                  migrationStatus.domain ? (
                                  <>
                                    <Alert role="status">
                                      <AlertTitle>{t("checkoutMigrationCloudflareReconnectedTitle")}</AlertTitle>
                                      <AlertDescription>{t("checkoutMigrationCloudflareReconnectedMigrationDescription")}</AlertDescription>
                                    </Alert>
                                    <input
                                      type="hidden"
                                      name="cloudflareSourceAuthorization"
                                      value={cloudflareSourceAuthorization}
                                    />
                                  </>
                                ) : (
                                  <Button
                                    type="submit"
                                    form="migration-cloudflare-source-reconnect-form"
                                    className="w-fit"
                                  >
                                    {t("checkoutMigrationCloudflareReconnect")}
                                  </Button>
                                )
                              ) : (
                                <Alert variant="destructive" role="alert">
                                  <AlertTitle>{t("checkoutMigrationCloudflareUnavailableTitle")}</AlertTitle>
                                  <AlertDescription>{t("checkoutMigrationCloudflareUnavailableMigrationDescription")}</AlertDescription>
                                </Alert>
                              )
                            )}
                          <MigrationSourceEvidenceFields
                            mechanism={
                              migrationStatus.sourceMechanism === "cloudflare_api_v1" ||
                              migrationStatus.sourceMechanism === "authorized_axfr_v1"
                                ? migrationStatus.sourceMechanism
                                : null
                            }
                            idPrefix="migration-replacement"
                          />
                        </>
                      )}
                    {migrationStatus.actions.some((action) =>
                      action.action === "provide_epp_code" &&
                      ["required", "failed"].includes(action.status)) && (
                        <>
                          <Label htmlFor="migration-replacement-transfer-code" className={transferCodeActionRequired ? "sr-only" : undefined}>
                            {t("checkoutMigrationTransferCodeReplacement")}
                          </Label>
                          <Input
                            id="migration-replacement-transfer-code"
                            name="transferCode"
                            type="password"
                            autoComplete="off"
                            placeholder={transferCodeActionRequired ? t("checkoutMigrationTransferCodeReplacement") : undefined}
                            className={transferCodeActionRequired ? "h-12" : undefined}
                            required
                          />
                        </>
                      )}
                    <Button
                      type="submit"
                      className="min-h-11 w-full bg-foreground text-background hover:bg-foreground/90"
                      disabled={
                        transferCodePending ||
                        (
                          migrationStatus.sourceMechanism ===
                            "cloudflare_api_v1" &&
                          cloudflareSourceOAuthEnabled &&
                          !(
                            cloudflareSourceAuthorization &&
                            cloudflareSourceDomain === migrationStatus.domain
                          )
                        )
                      }
                    >
                      {transferCodePending && (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      )}
                      {transferCodeActionRequired ? t("checkoutTransferActionSubmit") : t("checkoutMigrationTransferCodeSubmit")}
                    </Button>
                    {transferCodeState.message && (
                      <p
                        className={transferCodeState.ok
                          ? "text-sm text-foreground"
                          : "text-sm text-destructive"}
                        role={transferCodeState.ok ? "status" : "alert"}
                      >
                        {transferCodeState.message}
                      </p>
                    )}
                  </form>
                )}
            </AlertDescription>
          </Alert>
        )}

        {billingAgreement && (
          <Alert role="status" aria-live="polite">
            <ReceiptText className="size-4" aria-hidden />
            <AlertTitle>{t("checkoutSubscriptionStatusTitle")}</AlertTitle>
            <AlertDescription className="grid gap-3">
              {billingAgreement.state === "cancellation_scheduled" ? (
                <p>
                  {billingAgreement.cancelAt
                    ? t("checkoutCancellationEffectiveAt", {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "long",
                        }).format(new Date(billingAgreement.cancelAt)),
                      })
                    : t("checkoutCancellationScheduled")}
                </p>
              ) : billingAgreement.state === "cancelled" ? (
                <p>{t("checkoutCancellationCompleted")}</p>
              ) : (
                <p>{t("checkoutSubscriptionActiveDescription")}</p>
              )}
              {scheduleCancellationAction &&
                ["active", "past_due", "suspended"].includes(
                  billingAgreement.state,
                ) && (
                  <form action={cancellationAction}>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={cancellationPending}
                    >
                      {cancellationPending && (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                      )}
                      {t("checkoutCancelAtPeriodEnd")}
                    </Button>
                  </form>
                )}
              {cancellationState.message && (
                <p
                  role={cancellationState.ok ? "status" : "alert"}
                  className={
                    cancellationState.ok
                      ? "text-sm text-foreground"
                      : "text-sm text-destructive"
                  }
                >
                  {cancellationState.message}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
            </CardContent>
          </Card>
          {presentation.phase === "payment" && <OrderSummaryRail
            domain={selectedDomain ?? domainValue}
            company={savedProfile?.contractingPartyName ?? details.registeredBusinessName ?? details.intendedCompanyName ?? customerEmail}
            plan={billingPeriod === "annual" ? t("checkoutPlanAnnualShort") : t("checkoutPlanMonthlyShort")}
            dueNow={dueNowLabel}
            quote={selectedQuote?.quote}
            locale={locale}
            primaryAction={presentation.primaryAction}
            handlers={primaryActionHandlers}
            lifecycle={{
              status: paymentLifecycleStatusLabel,
              orderReference: acceptedOrderId == null ? null : String(acceptedOrderId),
            }}
          />}
          </div>
        )}

        {presentation.phase === "address" && step === "domain" && (
          <div className="grid min-w-0 gap-4 min-[880px]:grid-cols-[minmax(0,1fr)_348px] min-[880px]:items-start min-[880px]:gap-[18px]">
          <Card data-checkout-main-card className="relative scroll-mb-28 gap-0 overflow-hidden rounded-[17px] border bg-card py-0 pt-[5px] shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:bg-gradient-to-r before:from-brand before:to-brand/20 min-[560px]:rounded-[22px]">
            <CardHeader className="!flex items-start gap-3 border-b bg-transparent px-[17px] pb-[15px] pt-[19px] min-[560px]:px-[26px] min-[560px]:pb-[18px] min-[560px]:pt-6">
              <CardTitle>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.025em] min-[880px]:text-xl">
                  {t("checkoutStepDomain")}
                </h2>
                <p className="mt-1 max-w-xl text-sm font-normal leading-relaxed text-muted-foreground">{addressSheetDescription}</p>
              </CardTitle>
              <Badge className="ml-auto min-h-6 shrink-0 gap-1 bg-blue-500/10 px-2 text-[0.625rem] font-bold text-blue-700 hover:bg-blue-500/10 dark:text-blue-300">
                <Globe2 className="size-[15px]" aria-hidden />
                1 / 2
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-5 px-[17px] py-[17px] min-[560px]:px-[26px] min-[560px]:pb-[26px] min-[560px]:pt-[22px]">
              {cloudflareSourceResult === "failed" && (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>{t("checkoutMigrationCloudflareFailedTitle")}</AlertTitle>
                  <AlertDescription>{t("checkoutMigrationCloudflareFailedDescription")}</AlertDescription>
                </Alert>
              )}
              {cloudflareSourceResult === "provider-mismatch" && (
                <Alert role="status">
                  <AlertTitle>{t("checkoutMigrationCloudflareMismatchTitle")}</AlertTitle>
                  <AlertDescription>{t("checkoutMigrationCloudflareMismatchDescription")}</AlertDescription>
                </Alert>
              )}
              <fieldset className="grid gap-2">
                <legend className="sr-only">
                  {t("checkoutDomainModeLegend")}
                </legend>
                <ToggleGroup
                  type="single"
                  value={domainMode}
                  onValueChange={(value) => {
                    if (value === "new_registration" || value === "existing_domain") updateDomainMode(value)
                  }}
                  variant="outline"
                  data-checkout-domain-mode
                  className="grid w-full grid-cols-2 rounded-xl bg-muted p-[3px]"
                >
                  <ToggleGroupItem value="new_registration" className="min-h-[42px] min-w-0 gap-2 rounded-[9px] border-0 px-2 text-center text-xs leading-tight whitespace-normal sm:text-sm data-[state=on]:bg-card data-[state=on]:shadow-sm">
                    <Search className="size-4" aria-hidden />
                    <span>{t("checkoutDomainModeNew")}</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="existing_domain" className="min-h-[42px] min-w-0 gap-2 rounded-[9px] border-0 px-2 text-center text-xs leading-tight whitespace-normal sm:text-sm data-[state=on]:bg-card data-[state=on]:shadow-sm">
                    <RefreshCw className="size-4" aria-hidden />
                    <span>{t("checkoutDomainModeExisting")}</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                {domainMode === "existing_domain" && (
                  <p className="text-xs leading-snug text-muted-foreground">
                    {existingDomainMigrationEnabled
                      ? t("checkoutDomainModeExistingHelp")
                      : t("checkoutDomainModeExistingPreflight")}
                  </p>
                )}
              </fieldset>

              <form
                id="checkout-domain-form"
                ref={domainFormRef}
                action={checkAction}
                className="grid gap-2"
              onSubmit={() => {
                  const token = nextRequestToken()
                  latestDomainRequestTokenRef.current = token
                  if (domainRequestTokenRef.current) {
                    domainRequestTokenRef.current.value = token
                  }
                }}
              >
                <Label htmlFor="checkout-domain" className="mb-[7px] text-xs font-bold">
                  {domainMode === "existing_domain"
                    ? t("checkoutExistingDomainLabel")
                    : t("checkoutDomainLabel")}
                </Label>
                <input ref={domainRequestTokenRef} type="hidden" name="requestToken" />
                <input type="hidden" name="domainMode" value={domainMode} />
                {migrationSourceMethod && (
                  <input
                    type="hidden"
                    name="migrationSourceMethod"
                    value={migrationSourceMethod}
                  />
                )}
                <div className="grid gap-[9px] min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-center">
                  <div className="relative">
                    {domainMode === "existing_domain" ? <Globe2 className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden /> : <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />}
                    <Input
                    id="checkout-domain"
                    name="domain"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={domainValue}
                    onChange={(event) => updateDomain(event.target.value)}
                    placeholder={t("checkoutDomainPlaceholder")}
                    aria-invalid={domainInputState === "error" ? true : undefined}
                    aria-describedby={domainDescriptionId}
                    className={cn(
                      "h-12 md:h-12 rounded-xl pr-11 pl-[42px] text-base font-medium",
                      domainInputState === "success" && "border-success focus-visible:border-success focus-visible:ring-success/30",
                      domainInputState === "warning" && "border-warning focus-visible:border-warning focus-visible:ring-warning/30",
                      domainInputState === "error" && "border-destructive",
                    )}
                    required
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      {checkPending ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                      ) : domainInputState === "success" ? (
                        <Check className="size-5 text-success" aria-hidden />
                      ) : null}
                    </div>
                  </div>
                  <Button type="submit" className="h-12 min-h-12 md:h-12 md:min-h-12 rounded-[11px] px-4 shadow-sm max-[559px]:h-11 max-[559px]:min-h-11 min-[560px]:min-w-40" disabled={checkPending || extensionCheckPending}>
                    {checkPending || extensionCheckPending ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Search className="size-[18px]" aria-hidden />}
                    {domainMode === "existing_domain" ? t("checkoutDomainCheckConnection") : t("checkoutCheckDomain")}
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {domainMode === "existing_domain"
                    ? t("checkoutExistingDomainHint")
                    : t("checkoutAutomaticExtensionHint", { extensions: selectedExtensions.map((extension) => `.${extension}`).join(", ") })}
                </p>
                {domainMode === "new_registration" && (
                  <div className="grid gap-3 pt-3">
                    {(extensionCheckPending || extensionResults.length > 0) && (
                      <div className="grid gap-2" aria-live="polite" aria-busy={extensionCheckPending}>
                        {premiumInfoDomain && (
                          <Alert className="mb-1 border-warning/30 bg-warning/10 text-warning" role="status">
                            <CircleAlert className="size-4" aria-hidden />
                            <AlertTitle>{t("checkoutExtensionPremium")}</AlertTitle>
                            <AlertDescription>{t("checkoutDomainPremium", { domain: premiumInfoDomain })}</AlertDescription>
                          </Alert>
                        )}
                        {extensionResults.some((result) => result.status === "service_error") && (
                          <Alert variant="destructive" className="mb-1" role="alert">
                            <CircleAlert className="size-4" aria-hidden />
                            <AlertTitle>{t("checkoutDomainErrorTitle")}</AlertTitle>
                            <AlertDescription className="grid gap-3">
                              <span>{extensionResults.find((result) => result.status === "service_error")?.message}</span>
                              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void checkSelectedExtensions()}>{t("checkoutCheckAgain")}</Button>
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <strong className="flex items-center gap-1.5 font-semibold">
                            {extensionCheckPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                            {extensionCheckPending ? t("checkoutDomainCheckingShort") : t("checkoutDomainLiveResults")}
                          </strong>
                          <span className="text-muted-foreground">{extensionCheckPending ? normalizedDomainValue.split(".")[0] : t("checkoutDomainCheckedNow")}</span>
                        </div>
                        <div className="overflow-hidden rounded-[14px] border bg-card">
                        {extensionCheckPending && selectedExtensions
                          .filter((extension) => !extensionResults.some((result) => result.domain === `${normalizedDomainValue.split(".")[0]}.${extension}`))
                          .map((extension) => (
                          <div key={extension} data-domain-status="loading" className="grid min-h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b px-3 py-2.5 text-sm last:border-b-0 min-[560px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[560px]:gap-3.5">
                            <span className="grid min-w-0 gap-1.5"><span className="h-3.5 w-2/3 animate-pulse rounded bg-muted" /><span className="h-5 w-20 animate-pulse rounded-full bg-muted" /></span>
                            <span className="h-4 w-14 animate-pulse rounded bg-muted" />
                            <span className="col-span-2 h-[34px] w-full animate-pulse rounded-[9px] bg-muted min-[560px]:col-auto min-[560px]:w-[68px]" />
                          </div>
                        ))}
                        {[...extensionResults]
                          .filter((result) => result.status !== "service_error")
                          .sort((left, right) => selectedExtensions.indexOf(left.domain?.split(".").at(-1) ?? "") - selectedExtensions.indexOf(right.domain?.split(".").at(-1) ?? ""))
                          .map((result) => {
                          const available = Boolean(result.ok && result.domain && result.quotes)
                          const premium = result.status === "premium"
                          return (
                            <div key={result.domain ?? result.message} data-domain-status={result.status} data-domain-selected={checkedDomain === result.domain || undefined} className={cn("grid min-h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[9px] gap-y-2 border-b px-3 py-2.5 text-sm last:border-b-0 min-[560px]:grid-cols-[minmax(0,1fr)_auto_auto] min-[560px]:gap-x-3.5", checkedDomain === result.domain && "bg-brand/10 shadow-[inset_3px_0_0_var(--brand)]")}>
                              <span className="grid min-w-0 gap-1.5">
                                <strong className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground">{result.domain}</strong>
                                <span className={cn("flex min-h-6 w-fit items-center gap-1 rounded-full px-2 text-[0.625rem] font-bold", available && "bg-success/10 text-success", premium && "bg-warning/10 text-warning", !available && !premium && "bg-muted text-muted-foreground")}>
                                  {available ? <Check className="size-[15px]" aria-hidden /> : premium ? <TriangleAlert className="size-[15px]" aria-hidden /> : result.status === "unavailable" ? <X className="size-[15px]" aria-hidden /> : <CircleAlert className="size-[15px]" aria-hidden />}
                                  {premium ? t("checkoutExtensionPremium") : result.status === "unavailable" ? t("checkoutExtensionUnavailable") : result.status === "service_error" ? t("checkoutExtensionError") : t("checkoutExtensionAvailable")}
                                </span>
                              </span>
                              <span className="grid self-start pt-0.5 text-right">
                                <strong className="text-[0.8125rem] font-bold tabular-nums">{available && result.quotes ? (result.quotes.annual.quote.domainSurchargeNetMinor > 0 ? `+ ${money(locale, result.quotes.annual.quote.domainSurchargeNetMinor, result.quotes.annual.quote.currency)}` : t("checkoutDomainIncludedBadge")) : result.extraFeeLabel ?? "—"}</strong>
                                {available && result.quotes && result.quotes.annual.quote.domainSurchargeNetMinor > 0 && <span className="text-[0.625rem] text-muted-foreground">{t("checkoutPriceExVat")}</span>}
                              </span>
                              {available && (
                                <Button type="button" size="sm" variant="ghost" className={cn("col-span-2 min-h-9 w-full shrink-0 rounded-[9px] border bg-card px-[11px] text-xs text-foreground opacity-100 shadow-xs [&&:hover]:bg-muted [&&:hover]:text-foreground min-[560px]:col-auto min-[560px]:w-auto", checkedDomain === result.domain && "border-brand bg-brand text-brand-foreground [&&:hover]:bg-brand/85 [&&:hover]:text-brand-foreground")} onClick={() => selectExtensionResult(result)}>
                                  {checkedDomain === result.domain ? t("checkoutDomainSelected") : t("checkoutSelectDomain")}
                                </Button>
                              )}
                              {premium && (
                                <Button type="button" size="sm" variant="ghost" className="col-span-2 min-h-9 w-full rounded-[9px] px-[11px] text-xs text-muted-foreground min-[560px]:col-auto min-[560px]:w-auto" onClick={() => setPremiumInfoDomain(result.domain ?? null)}>
                                  {t("checkoutPremiumWhy")}
                                </Button>
                              )}
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {domainMode === "existing_domain" && checkAppliesToCurrentInput && (
                  <Alert
                    className={cn(
                      "mt-2 rounded-[13px] border",
                      checkState.ok && !migrationTransferBlocked && !migrationReleaseBlocked
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning",
                    )}
                    role={checkState.ok && !migrationTransferBlocked && !migrationReleaseBlocked ? "status" : "alert"}
                  >
                    {checkState.ok && !migrationTransferBlocked && !migrationReleaseBlocked
                      ? <CheckCircle2 className="size-4" aria-hidden />
                      : <CircleAlert className="size-4" aria-hidden />}
                    <AlertTitle>
                      {migrationTransferBlocked || migrationReleaseBlocked
                        ? t("checkoutMigrationTransferBlockedTitle")
                        : checkState.migrationPreflightOnly
                          ? t("checkoutMigrationPreflightComplete")
                          : checkState.migrationReadiness === "ready_automatic"
                            ? t("checkoutMigrationReadyAutomatic")
                            : t("checkoutMigrationUnsupported")}
                    </AlertTitle>
                    <AlertDescription>{checkState.message}</AlertDescription>
                  </Alert>
                )}
                {domainMode === "existing_domain" && migrationReadinessLedger}
                {domainMode === "existing_domain" &&
                  existingDomainMigrationEnabled &&
                  !migrationTransferBlocked &&
                  !migrationReleaseBlocked &&
                  (
                    migrationPreflight?.domain === normalizedDomainValue ||
                    (
                      cloudflareSourceAuthorization &&
                      cloudflareSourceDomain === normalizedDomainValue
                    )
                  ) && (
                  <div className="mt-[14px] grid gap-4 rounded-[14px] border bg-card p-[14px]">
                    {!cloudflareSourceAuthorization &&
                      availableMigrationSourceMethods.length > 0 && (
                        <fieldset className="grid gap-3">
                          <legend className="font-medium">
                            {t("checkoutMigrationSourceLegend")}
                          </legend>
                          <p className="text-sm text-muted-foreground">
                            {t("checkoutMigrationSourceHelp")}
                          </p>
                          <RadioGroup
                            value={migrationSourceMethod || undefined}
                            onValueChange={(value) => {
                              if (value === "cloudflare_api_v1" || value === "authorized_axfr_v1") {
                                updateMigrationSourceMethod(value)
                              }
                            }}
                            className="gap-2"
                          >
                            {([
                              ["cloudflare_api_v1", "checkoutMigrationSourceCloudflare"],
                              ["authorized_axfr_v1", "checkoutMigrationSourceAxfr"],
                            ] as const)
                              .filter(([value]) => availableMigrationSourceMethods.includes(value))
                              .map(([value, label]) => (
                                <div
                                  key={value}
                                  className="flex cursor-pointer items-start gap-3 rounded-[11px] border bg-muted/20 p-3 text-sm"
                                >
                                  <RadioGroupItem id={`checkout-migration-source-${value}`} value={value} className="mt-0.5" />
                                  <Label htmlFor={`checkout-migration-source-${value}`} className="cursor-pointer font-normal leading-relaxed">{t(label)}</Label>
                                </div>
                              ))}
                          </RadioGroup>
                        </fieldset>
                      )}
                    {!cloudflareSourceAuthorization &&
                      availableMigrationSourceMethods.length === 0 && (
                        <Alert variant="destructive" role="alert">
                          <AlertTitle>{t("checkoutMigrationNoAutomaticSourceTitle")}</AlertTitle>
                          <AlertDescription>
                            {t("checkoutMigrationNoAutomaticSourceDescription")}
                          </AlertDescription>
                        </Alert>
                      )}
                    {migrationSourceMethod === "cloudflare_api_v1" && (
                      cloudflareSourceOAuthEnabled ? (
                        cloudflareSourceAuthorization ? (
                          <Alert role="status" className="rounded-[13px] border-success/30 bg-success/10 text-success">
                            <AlertTitle>{t("checkoutMigrationCloudflareConnectedTitle")}</AlertTitle>
                            <AlertDescription>{t("checkoutMigrationCloudflareConnectedDescription")}</AlertDescription>
                            <input
                              type="hidden"
                              name="cloudflareSourceAuthorization"
                              value={cloudflareSourceAuthorization}
                            />
                          </Alert>
                        ) : (
                          <Button
                            type="submit"
                            form="checkout-cloudflare-source-connect-form"
                            className="min-h-11 w-fit bg-brand text-brand-foreground hover:bg-brand/90"
                          >
                            {t("checkoutMigrationCloudflareConnect")}
                          </Button>
                        )
                      ) : (
                        <Alert variant="destructive" role="alert">
                          <AlertTitle>{t("checkoutMigrationCloudflareUnavailableTitle")}</AlertTitle>
                          <AlertDescription>{t("checkoutMigrationCloudflareUnavailableDescription")}</AlertDescription>
                        </Alert>
                      )
                    )}
                    {migrationSourceMethod === "authorized_axfr_v1" && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="checkout-axfr-nameserver">
                            {t("checkoutMigrationAxfrNameserverLabel")}
                          </Label>
                          <select
                            id="checkout-axfr-nameserver"
                            name="axfrNameserver"
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            required
                            defaultValue={
                              (checkState.migrationPublicEvidence ??
                                migrationPreflight?.publicEvidence)
                                ?.authoritativeNameservers[0]
                            }
                          >
                            {(checkState.migrationPublicEvidence ??
                              migrationPreflight?.publicEvidence)
                              ?.authoritativeNameservers.map((nameserver) => (
                                <option key={nameserver} value={nameserver}>
                                  {nameserver}
                                </option>
                              ))}
                          </select>
                          <p className="text-sm text-muted-foreground">
                            {t("checkoutMigrationAxfrNameserverHelp")}
                          </p>
                        </div>
                        <CheckoutTextField
                          id="checkout-axfr-tsig-name"
                          name="axfrTsigName"
                          label={t("checkoutMigrationAxfrTsigNameLabel")}
                          description={t("checkoutMigrationAxfrTsigHelp")}
                          value={undefined}
                          autoComplete="off"
                        />
                        <CheckoutTextField
                          id="checkout-axfr-tsig-secret"
                          name="axfrTsigSecret"
                          type="password"
                          label={t("checkoutMigrationAxfrTsigSecretLabel")}
                          value={undefined}
                          autoComplete="off"
                        />
                      </>
                    )}
                    <CheckoutTextField
                      id="checkout-transfer-code"
                      name="transferCode"
                      type="password"
                      label={t("checkoutMigrationTransferCodeLabel")}
                      description={t("checkoutMigrationTransferCodeHelp")}
                      value={undefined}
                      autoComplete="off"
                      required
                    />
                    <label className="flex items-start gap-3 text-sm leading-6">
                      <Checkbox
                        name="transferAuthorization"
                        value="accepted"
                        className="mt-1"
                        required
                      />
                      <span>{t("checkoutMigrationTransferAuthorization")}</span>
                    </label>
                    {tldUsesIcannTransferPolicy(
                      normalizedDomainValue.split(".").at(-1) ?? "",
                    ) && (
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <Checkbox
                          name="gtldTransferEligibility"
                          value="accepted"
                          className="mt-1"
                          required
                        />
                        <span>{t("checkoutMigrationGtldEligibilityDeclaration")}</span>
                      </label>
                    )}
                  </div>
                )}
                <div aria-live="polite" aria-atomic="true">
                  {domainInputState === "warning" && (
                    <p id="checkout-domain-unavailable" className="text-sm font-medium text-warning">
                      {t("checkoutDomainUnavailableTitle")}
                    </p>
                  )}
                  {domainInputState === "success" && domainMode === "new_registration" && (
                    <p id="checkout-domain-available" className="text-sm font-medium text-success">
                      {t("checkoutDomainAvailableDetail", {
                        domain: checkState.domain ?? normalizedDomainValue,
                      })}
                      {checkState.extraFeeLabel
                        ? ` ${t("checkoutDomainSurchargeDetail", {
                            amount: checkState.extraFeeLabel,
                          })}`
                        : ""}
                    </p>
                  )}
                </div>
              </form>

              {selectedDomain && selectedQuote && (
                <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-brand/35 bg-brand/10 p-3.5" data-selected-domain-summary>
                  <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-brand text-brand-foreground">
                    <Globe2 className="size-[18px]" aria-hidden />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <strong className="[overflow-wrap:anywhere] text-sm">{selectedDomain}</strong>
                    <span className="text-[0.6875rem] text-muted-foreground">{t("checkoutExtensionAvailable")} · {selectedQuote.quote.domainSurchargeNetMinor > 0 ? `${money(locale, selectedQuote.quote.domainSurchargeNetMinor, selectedQuote.quote.currency)} ${t("checkoutPriceExVat")}` : t("checkoutDomainIncludedBadge")}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9 shrink-0"
                    onClick={() => {
                      setCheckedDomain(null)
                      setQuotes(null)
                      window.setTimeout(() => domainFormRef.current?.querySelector<HTMLInputElement>("#checkout-domain")?.focus(), 0)
                    }}
                  >
                    {t("checkoutChange")}
                  </Button>
                </div>
              )}

              {domainResultKind === "error" && (
                <Alert id="checkout-domain-error" variant="destructive" role="alert">
                  <CircleAlert className="size-4" aria-hidden />
                  <AlertTitle>{t("checkoutDomainErrorTitle")}</AlertTitle>
                  <AlertDescription>{checkState.message}</AlertDescription>
                </Alert>
              )}

              {domainMode === "new_registration" &&
                checkState.status === "release_pending" &&
                checkAppliesToCurrentInput && (
                  <Alert role="status">
                    <Info className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutDomainReleasePendingTitle")}</AlertTitle>
                    <AlertDescription>{checkState.message}</AlertDescription>
                  </Alert>
                )}

              {primaryDomainUnavailable && (
                <DomainSuggestions
                  loading={suggestionsPending}
                  suggestions={suggestions}
                  placeholders={
                    suggestionsPending || !suggestionsApplyToCurrentInput
                      ? placeholderSuggestions
                      : []
                  }
                  selectedDomain={null}
                  onSelect={selectSuggestedDomain}
                />
              )}

            </CardContent>
            <div className="flex items-start justify-between gap-3 border-t bg-muted/45 px-[17px] py-3.5 min-[560px]:px-[26px] min-[880px]:items-center min-[880px]:py-4">
              <p className="flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-[15px] shrink-0" aria-hidden />
                <span>{t("checkoutSignedQuoteNote")}</span>
              </p>
              <Button type="button" className="hidden min-h-11 shrink-0 min-[880px]:inline-flex" disabled={!domainIsReady} onClick={() => setStep("review")}>
                {t("checkoutContinueReview")}
                <ArrowRight className="size-[18px]" aria-hidden />
              </Button>
            </div>
          </Card>
          <OrderSummaryRail
            domain={selectedDomain ?? domainValue}
            company={savedProfile?.contractingPartyName ?? details.registeredBusinessName ?? details.intendedCompanyName ?? customerEmail}
            plan={billingPeriod === "annual" ? t("checkoutPlanAnnualShort") : t("checkoutPlanMonthlyShort")}
            dueNow={dueNowLabel}
            quote={selectedQuote?.quote}
            locale={locale}
            primaryAction={presentation.primaryAction}
            handlers={primaryActionHandlers}
          />
          </div>
        )}

        {presentation.phase === "review" && step === "review" && (
          <div className="grid min-w-0 gap-4 min-[880px]:grid-cols-[minmax(0,1fr)_348px] min-[880px]:items-start min-[880px]:gap-[18px]">
          <div className="relative scroll-mb-28 min-w-0 overflow-hidden rounded-[17px] border bg-card pt-[5px] shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:bg-gradient-to-r before:from-brand before:to-brand/20 min-[560px]:rounded-[22px]">
          <Card data-checkout-main-card className="gap-0 rounded-none border-0 py-0 shadow-none">
            <CardHeader className="!flex items-start gap-3 border-b bg-transparent px-[17px] pb-[15px] pt-[19px] min-[560px]:px-[26px] min-[560px]:pb-[18px] min-[560px]:pt-6">
              <CardTitle>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.025em] min-[880px]:text-xl">
                  {t("checkoutReviewSheetTitle", { site: savedProfile?.contractingPartyName ?? details.registeredBusinessName ?? details.intendedCompanyName ?? t("checkoutLaunchWorkspace") })}
                </h2>
                <p className="mt-1 max-w-xl text-sm font-normal leading-relaxed text-muted-foreground">{t("checkoutReviewSheetDescription")}</p>
              </CardTitle>
              <Badge className="ml-auto hidden min-h-6 shrink-0 gap-1 bg-success/10 px-2 text-[0.625rem] font-bold text-success hover:bg-success/10 min-[360px]:inline-flex">
                <Check className="size-[15px]" aria-hidden />
                {t("checkoutKnownDetailsLabel")}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-5 px-[17px] py-[17px] min-[560px]:px-[26px] min-[560px]:pb-[22px] min-[560px]:pt-[22px]">
              <div className="border-y" aria-label={t("checkoutKnownDetailsLabel")}>
                <ReviewGroup
                  group="company"
                  icon={Building2}
                  title={t("checkoutCompanyGroup")}
                  summary={details.registeredBusinessName || details.intendedCompanyName || t("checkoutNotProvided")}
                  details={[
                    { label: t("checkoutPartyClassification"), value: details.partyType === "registered_business" ? t("checkoutPartyRegistered") : t("checkoutPartyInFormation") },
                    { label: t("checkoutKvkNumber"), value: details.kvkNumber || t("checkoutNotProvided") },
                  ]}
                  attention={!details.registeredBusinessName && !details.intendedCompanyName}
                  onEdit={(trigger) => openDetailsEditor("company", trigger)}
                  editLabel={t("checkoutEdit")}
                  missingLabel={t("checkoutDetailsMissing")}
                />
                <ReviewGroup
                  group="contact"
                  icon={UserRound}
                  title={t("checkoutContactGroup")}
                  summary={`${details.firstName} ${details.lastName}`.trim() || t("checkoutNotProvided")}
                  details={[
                    { label: t("checkoutReviewDetailEmail"), value: customerEmail },
                    { label: t("checkoutPhoneTitle"), value: `${details.phoneCountryCode} ${details.phoneAreaCode} ${details.phoneSubscriberNumber}`.trim() || t("checkoutNotProvided") },
                  ]}
                  attention={!details.firstName || !details.lastName || !details.phoneSubscriberNumber}
                  onEdit={(trigger) => openDetailsEditor("contact", trigger)}
                  editLabel={t("checkoutEdit")}
                  missingLabel={t("checkoutDetailsMissing")}
                />
                <ReviewGroup
                  group="address"
                  icon={MapPin}
                  title={t("checkoutAddressGroup")}
                  summary={`${details.street} ${details.number}${details.suffix ?? ""}, ${details.zipcode} ${details.city}`.trim()}
                  details={[
                    { label: t("checkoutReviewDetailAddress"), value: `${details.street} ${details.number}${details.suffix ?? ""}, ${details.zipcode} ${details.city}`.trim() || t("checkoutNotProvided"), full: true },
                    { label: t("checkoutReviewDetailCountry"), value: details.country || t("checkoutNotProvided") },
                  ]}
                  attention={!details.street || !details.number || !details.zipcode || !details.city || !details.country}
                  onEdit={(trigger) => openDetailsEditor("address", trigger)}
                  editLabel={t("checkoutEdit")}
                  missingLabel={t("checkoutDetailsMissing")}
                />
                <ReviewGroup
                  group="account"
                  icon={Globe2}
                  title={t("checkoutAccountWebsiteGroup")}
                  summary={selectedDomain ?? domainValue}
                  details={[
                    { label: t("checkoutReviewDetailDomain"), value: selectedDomain ?? domainValue },
                    { label: t("checkoutReviewDetailAccountEmail"), value: customerEmail },
                    { label: t("checkoutReviewDetailAuthority"), value: t("checkoutAccountWebsiteAuthority"), full: true },
                  ]}
                  attention={false}
                  onEdit={() => setStep("domain")}
                  editLabel={t("checkoutEdit")}
                  missingLabel={t("checkoutDetailsMissing")}
                />
              </div>
              <Sheet open={detailsEditorOpen} onOpenChange={(open) => {
                setDetailsEditorOpen(open)
                if (!open) {
                  window.setTimeout(() => detailsEditorTriggerRef.current?.focus(), 0)
                }
              }}>
                <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-full sm:max-w-xl sm:rounded-none sm:border-l">
                  <SheetHeader className="border-b px-5">
                    <SheetTitle>
                      {detailsEditorGroup === "company"
                        ? t("checkoutEditDetailsCompany")
                        : detailsEditorGroup === "address"
                          ? t("checkoutEditDetailsAddress")
                          : t("checkoutEditDetailsContact")}
                    </SheetTitle>
                    <SheetDescription>{t("checkoutEditDetailsDescription")}</SheetDescription>
                  </SheetHeader>
              <form
                id="checkout-profile-form"
                action={profileAction}
                className="grid gap-6 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
                onSubmit={() => {
                  const token = nextRequestToken()
                  latestProfileRequestTokenRef.current = token
                  if (profileRequestTokenRef.current) {
                    profileRequestTokenRef.current.value = token
                  }
                }}
              >
                <input ref={profileRequestTokenRef} type="hidden" name="requestToken" />
                <input type="hidden" name="domain" value={selectedDomain ?? domainValue} />
                <input type="hidden" name="domainMode" value={domainMode} />
                <input
                  type="hidden"
                  name="existingMigrationQuoteToken"
                  value={
                    domainMode === "existing_domain"
                      ? selectedQuote?.token ?? ""
                      : ""
                  }
                />
                <input
                  type="hidden"
                  name="expectedProfileVersion"
                  value={savedProfile?.profileVersion ?? 0}
                />
                {detailsEditorGroup !== "company" && (
                  <>
                    <input type="hidden" name="partyType" value={details.partyType} />
                    <input type="hidden" name="registeredBusinessName" value={details.registeredBusinessName ?? ""} />
                    <input type="hidden" name="kvkNumber" value={details.kvkNumber ?? ""} />
                    <input type="hidden" name="intendedCompanyName" value={details.intendedCompanyName ?? ""} />
                  </>
                )}
                {detailsEditorGroup !== "contact" && (
                  <>
                    <input type="hidden" name="firstName" value={details.firstName ?? ""} />
                    <input type="hidden" name="lastName" value={details.lastName ?? ""} />
                    <input type="hidden" name="phoneCountryCode" value={details.phoneCountryCode ?? ""} />
                    <input type="hidden" name="phoneAreaCode" value={details.phoneAreaCode ?? ""} />
                    <input type="hidden" name="phoneSubscriberNumber" value={details.phoneSubscriberNumber ?? ""} />
                  </>
                )}
                {detailsEditorGroup !== "address" && (
                  <>
                    <input type="hidden" name="street" value={details.street ?? ""} />
                    <input type="hidden" name="number" value={details.number ?? ""} />
                    <input type="hidden" name="suffix" value={details.suffix ?? ""} />
                    <input type="hidden" name="zipcode" value={details.zipcode ?? ""} />
                    <input type="hidden" name="city" value={details.city ?? ""} />
                    <input type="hidden" name="country" value={details.country ?? ""} />
                    <input type="hidden" name="euEligibilityBasis" value={details.euEligibilityBasis ?? ""} />
                    <input type="hidden" name="euEligibilityCountry" value={details.euEligibilityCountry ?? ""} />
                  </>
                )}

                {savedProfile && (
                  <Alert>
                    <Info className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutProfileCorrectionTitle")}</AlertTitle>
                    <AlertDescription>
                      {t("checkoutProfileCorrectionDescription", {
                        version: savedProfile.profileVersion,
                      })}
                    </AlertDescription>
                  </Alert>
                )}

                {profileState.message && (
                  <div
                    ref={profileErrorSummaryRef}
                    tabIndex={profileState.ok ? undefined : -1}
                    aria-label={
                      profileState.ok ? undefined : t("checkoutErrorSummaryLabel")
                    }
                    className="outline-none"
                  >
                    <Alert
                      variant={profileState.ok ? "default" : "destructive"}
                      role={profileState.ok ? "status" : "alert"}
                    >
                      <AlertTitle>
                        {profileState.status === "conflict"
                          ? t("checkoutProfileConflictTitle")
                          : profileState.ok
                            ? t("checkoutProfileSavedTitle")
                            : t("checkoutDetailsErrorTitle")}
                      </AlertTitle>
                    <AlertDescription>{profileState.message}</AlertDescription>
                    {!profileState.ok && profileState.fieldErrors && (
                      <ul
                        className="mt-2 list-disc space-y-1 pl-5"
                      >
                        {Object.entries(profileState.fieldErrors).map(([field, message]) => {
                          const target = checkoutFieldId(field)
                          return (
                            <li key={field}>
                              {target ? (
                                <a
                                  href={`#${target}`}
                                  className="underline underline-offset-2"
                                  onClick={() => {
                                    window.setTimeout(() => {
                                      document.getElementById(target)?.focus()
                                    }, 0)
                                  }}
                                >
                                  {message}
                                </a>
                              ) : message}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Alert>
                  </div>
                )}

                {detailsEditorGroup === "company" && <>
                <fieldset className="grid gap-3">
                  <legend className="text-base font-semibold">
                    {t("checkoutPartyTypeLegend")}
                  </legend>
                  <RadioGroup
                    value={details.partyType}
                    onValueChange={(value) => {
                      if (value === "registered_business" || value === "business_in_formation") {
                        updateDetail("partyType", value)
                      }
                    }}
                    className="gap-2"
                    aria-label={t("checkoutPartyTypeLegend")}
                  >
                    <div className="flex items-start gap-3 rounded-md border p-4">
                      <RadioGroupItem id="checkout-party-registered" value="registered_business" className="mt-0.5" />
                      <Label htmlFor="checkout-party-registered" className="cursor-pointer font-normal">
                        <span className="block font-medium">{t("checkoutPartyRegistered")}</span>
                        <span className="block text-sm text-muted-foreground">{t("checkoutPartyRegisteredHelp")}</span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-3 rounded-md border p-4">
                      <RadioGroupItem id="checkout-party-formation" value="business_in_formation" className="mt-0.5" />
                      <Label htmlFor="checkout-party-formation" className="cursor-pointer font-normal">
                        <span className="block font-medium">{t("checkoutPartyInFormation")}</span>
                        <span className="block text-sm text-muted-foreground">{t("checkoutPartyInFormationHelp")}</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </fieldset>

                {details.partyType === "registered_business" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CheckoutTextField
                      id="checkout-business-name"
                      name="registeredBusinessName"
                      label={t("checkoutRegisteredBusinessName")}
                      value={details.registeredBusinessName}
                      error={profileState.fieldErrors?.registeredBusinessName}
                      autoComplete="organization"
                      onChange={(value) => updateDetail("registeredBusinessName", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-kvk"
                      name="kvkNumber"
                      label={t("checkoutKvkNumber")}
                      value={details.kvkNumber}
                      error={profileState.fieldErrors?.kvkNumber}
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      onChange={(value) => updateDetail("kvkNumber", value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                ) : (
                  <CheckoutTextField
                    id="checkout-intended-company"
                    name="intendedCompanyName"
                    label={t("checkoutIntendedCompanyName")}
                    value={details.intendedCompanyName}
                    error={profileState.fieldErrors?.intendedCompanyName}
                    autoComplete="organization"
                    onChange={(value) => updateDetail("intendedCompanyName", value)}
                    description={t("checkoutIntendedCompanyNameHelp")}
                  />
                )}
                </>}

                {detailsEditorGroup === "contact" && <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CheckoutTextField
                    id="checkout-first-name"
                    name="firstName"
                    label={t("checkoutFirstName")}
                    value={details.firstName}
                    error={profileState.fieldErrors?.firstName}
                    autoComplete="given-name"
                    onChange={(value) => updateDetail("firstName", value)}
                    required
                  />
                  <CheckoutTextField
                    id="checkout-last-name"
                    name="lastName"
                    label={t("checkoutLastName")}
                    value={details.lastName}
                    error={profileState.fieldErrors?.lastName}
                    autoComplete="family-name"
                    onChange={(value) => updateDetail("lastName", value)}
                    required
                  />
                </div>

                <CheckoutTextField
                  id="checkout-customer-email"
                  label={t("checkoutRegistrantEmail")}
                  value={customerEmail}
                  autoComplete="email"
                  readOnly
                />
                <fieldset className="grid gap-4">
                  <legend className="text-base font-semibold">{t("checkoutPhoneTitle")}</legend>
                  <div className="grid gap-4 sm:grid-cols-[7rem_8rem_1fr]">
                    <CheckoutTextField id="checkout-phone-country" name="phoneCountryCode" label={t("checkoutPhoneCountry")} value={details.phoneCountryCode} error={profileState.fieldErrors?.phoneCountryCode} autoComplete="tel-country-code" onChange={(value) => updateDetail("phoneCountryCode", value)} required />
                    <CheckoutTextField id="checkout-phone-area" name="phoneAreaCode" label={t("checkoutPhoneArea")} value={details.phoneAreaCode} error={profileState.fieldErrors?.phoneAreaCode} inputMode="numeric" autoComplete="tel-area-code" onChange={(value) => updateDetail("phoneAreaCode", value.replace(/\D/g, ""))} required />
                    <CheckoutTextField id="checkout-phone-number" name="phoneSubscriberNumber" label={t("checkoutPhoneNumber")} value={details.phoneSubscriberNumber} error={profileState.fieldErrors?.phoneSubscriberNumber} inputMode="numeric" autoComplete="tel-local" onChange={(value) => updateDetail("phoneSubscriberNumber", value.replace(/\D/g, ""))} required />
                  </div>
                </fieldset>
                </>}

                {detailsEditorGroup === "address" && <>
                <fieldset className="grid gap-4">
                  <legend className="text-base font-semibold">
                    {t("checkoutRegistrantAddress")}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
                    <CheckoutTextField
                      id="checkout-street"
                      name="street"
                      label={t("checkoutStreet")}
                      value={details.street}
                      error={profileState.fieldErrors?.street}
                      autoComplete="address-line1"
                      onChange={(value) => updateDetail("street", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-number"
                      name="number"
                      label={t("checkoutHouseNumber")}
                      value={details.number}
                      error={profileState.fieldErrors?.number}
                      onChange={(value) => updateDetail("number", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-suffix"
                      name="suffix"
                      label={t("checkoutHouseSuffix")}
                      value={details.suffix}
                      error={profileState.fieldErrors?.suffix}
                      onChange={(value) => updateDetail("suffix", value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[12rem_1fr_7rem]">
                    <CheckoutTextField
                      id="checkout-postcode"
                      name="zipcode"
                      label={t("checkoutZipcode")}
                      value={details.zipcode}
                      error={profileState.fieldErrors?.zipcode}
                      autoComplete="postal-code"
                      onChange={(value) => updateDetail("zipcode", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-city"
                      name="city"
                      label={t("checkoutCity")}
                      value={details.city}
                      error={profileState.fieldErrors?.city}
                      autoComplete="address-level2"
                      onChange={(value) => updateDetail("city", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-country"
                      name="country"
                      label={t("checkoutCountry")}
                      value={details.country}
                      error={profileState.fieldErrors?.country}
                      autoComplete="country"
                      maxLength={2}
                      onChange={(value) => updateDetail("country", value.toUpperCase())}
                      required
                    />
                  </div>
                </fieldset>

                {selectedDomain?.endsWith(".eu") && (
                  <fieldset className="grid gap-4">
                    <legend className="text-base font-semibold">
                      {t("checkoutEuEligibilityTitle")}
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-eu-eligibility-basis">
                          {t("checkoutEuEligibilityBasis")}
                        </Label>
                        <select
                          id="checkout-eu-eligibility-basis"
                          name="euEligibilityBasis"
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          value={details.euEligibilityBasis ?? ""}
                          onChange={(event) =>
                            updateDetail(
                              "euEligibilityBasis",
                              event.target.value as
                                | "establishment"
                                | "residence"
                                | "citizenship"
                                | "",
                            )}
                          required
                        >
                          <option value="">
                            {t("checkoutEuEligibilityChoose")}
                          </option>
                          {details.partyType === "registered_business" ? (
                            <option value="establishment">
                              {t("checkoutEuEligibilityEstablishment")}
                            </option>
                          ) : (
                            <>
                              <option value="residence">
                                {t("checkoutEuEligibilityResidence")}
                              </option>
                              <option value="citizenship">
                                {t("checkoutEuEligibilityCitizenship")}
                              </option>
                            </>
                          )}
                        </select>
                      </div>
                      <CheckoutTextField
                        id="checkout-eu-eligibility-country"
                        name="euEligibilityCountry"
                        label={t("checkoutEuEligibilityCountry")}
                        description={t("checkoutEuEligibilityCountryHelp")}
                        value={details.euEligibilityCountry ?? ""}
                        error={profileState.fieldErrors?.euEligibilityCountry}
                        maxLength={2}
                        onChange={(value) =>
                          updateDetail(
                            "euEligibilityCountry",
                            value.toUpperCase(),
                          )}
                        required
                      />
                    </div>
                  </fieldset>
                )}

                </>}
                <Button type="submit" variant="success" disabled={profilePending}>
                  {profilePending
                    ? <Loader2 className="size-4 animate-spin" aria-hidden />
                    : <CheckCircle2 className="size-4" aria-hidden />}
                  {t("checkoutDetailsSave")}
                </Button>
              </form>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
          {savedProfile && <section data-details-group="plan" className="border-b bg-card">
            <div className="flex items-center gap-3 px-[17px] pb-0 pt-[17px] min-[560px]:px-[26px] min-[560px]:pt-[18px]">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-success/10 text-success">
                <CreditCard className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-bold leading-tight tracking-[-0.012em]">
                  {t("checkoutPlanTitle")}
                </h2>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{billingPeriod === "annual" ? `${t("checkoutPlanAnnualShort")} · ${t("checkoutPlanAnnualSaving")}` : t("checkoutPlanMonthlyShort")}</p>
              </div>
            </div>
            <div className="grid min-w-0 gap-5 px-[17px] pb-[17px] pt-3 [&>*]:min-w-0 min-[560px]:px-[26px] min-[560px]:pb-[22px]">
              <fieldset className="ml-10 grid min-w-0 gap-2">
                <legend className="sr-only">{t("checkoutPlanLegend")}</legend>
                <ToggleGroup
                  type="single"
                  value={billingPeriod}
                  onValueChange={(value) => {
                    if (acceptedOrderId == null && (value === "annual" || value === "monthly")) setBillingPeriod(value)
                  }}
                  variant="outline"
                  spacing={1}
                  className="grid w-full grid-cols-1 gap-[9px] min-[420px]:grid-cols-2"
                >
                {(acceptedOrderId == null ? ["annual", "monthly"] as const : [billingPeriod] as const).map((period) => {
                  const option = quotes?.[period]?.quote
                  return (
                    <ToggleGroupItem
                      key={period}
                      value={period}
                      disabled={acceptedOrderId != null}
                      className={cn(
                    "h-auto min-h-[5.25rem] w-full min-w-0 justify-start rounded-[13px] border bg-card p-3 text-left shadow-none",
                        "data-[state=on]:border-foreground data-[state=on]:bg-muted/40 data-[state=on]:ring-1 data-[state=on]:ring-foreground",
                      )}
                    >
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex min-w-0 items-center justify-between gap-1 text-xs font-semibold sm:text-sm">
                          {period === "annual"
                            ? t("checkoutPlanAnnual")
                            : t("checkoutPlanMonthly")}
                          {period === "annual" && <Badge className="h-[18px] rounded-full bg-brand px-1.5 py-0 text-[0.5625rem] font-extrabold leading-none text-brand-foreground hover:bg-brand">{t("checkoutPlanAnnualSaving")}</Badge>}
                        </span>
                        <span className="mt-1 text-lg font-bold leading-tight tracking-tight text-foreground">
                          {money(
                            locale,
                            option?.planPriceNetMinor ?? 0,
                            option?.currency ?? catalog.currency,
                          )}
                          <span className="ml-1 text-[0.625rem] font-medium text-muted-foreground">{period === "annual" ? t("checkoutPlanPerYear") : t("checkoutPlanPerMonth")} · {t("checkoutPriceExVat")}</span>
                        </span>
                      </span>
                    </ToggleGroupItem>
                  )
                })}
                </ToggleGroup>
              </fieldset>

              {selectedQuote?.quote.domainMode === "existing_domain" && selectedQuote.quote.transferRenewalEffect && (
                <div className="ml-10 grid gap-1 rounded-[12px] border bg-muted/30 px-3 py-2 text-xs">
                  <strong>{t("checkoutTransferRenewalEffect")}</strong>
                  <span className="text-muted-foreground">
                    {selectedQuote.quote.transferRenewalEffect === "unchanged"
                      ? t("checkoutTransferRenewalEffectUnchanged")
                      : selectedQuote.quote.transferRenewalEffect === "extends_one_year"
                        ? t("checkoutTransferRenewalEffectExtendsOneYear")
                        : selectedQuote.quote.transferRenewalEffect === "restarts_from_transfer_date"
                          ? t("checkoutTransferRenewalEffectRestartsFromTransferDate")
                          : t("checkoutTransferRenewalEffectProviderDetermined")}
                  </span>
                  <span className="text-muted-foreground">
                    {selectedQuote.quote.transferRenewalEffect === "unchanged"
                      ? t("checkoutDomainRenewalExplanationUnchanged")
                      : selectedQuote.quote.transferRenewalEffect === "extends_one_year"
                        ? t("checkoutDomainRenewalExplanationExtendsOneYear")
                        : selectedQuote.quote.transferRenewalEffect === "restarts_from_transfer_date"
                          ? t("checkoutDomainRenewalExplanationRestartsFromTransferDate")
                          : t("checkoutDomainRenewalExplanationProviderDetermined")}
                  </span>
                </div>
              )}

              <form
                id="checkout-payment-form"
                ref={paymentFormRef}
                action={paymentAction}
                className="hidden"
              >
                <input type="hidden" name="domain" value={selectedDomain ?? domainValue} />
                {acceptedOrderId != null && (
                  <input
                    type="hidden"
                    name="acceptedOrderId"
                    value={acceptedOrderId}
                  />
                )}
                <input type="hidden" name="expectedProfileKey" value={savedProfile.profileKey} />
                <input type="hidden" name="expectedProfileVersion" value={savedProfile.profileVersion} />
                <input type="hidden" name="billingPeriod" value={billingPeriod} />
                <input
                  type="hidden"
                  name="checkoutQuoteToken"
                  value={selectedQuote?.token ?? ""}
                />
                {cloudflareSourceAuthorization && (
                  <input
                    type="hidden"
                    name="cloudflareSourceAuthorization"
                    value={cloudflareSourceAuthorization}
                  />
                )}
                <input type="hidden" name="previewApproval" value={previewApprovalAccepted ? "accepted" : ""} />
                <input type="hidden" name="termsAcceptance" value={termsAccepted ? "accepted" : ""} />
                <input type="hidden" name="businessUseAcceptance" value={businessUseAccepted ? "accepted" : ""} />
                <input type="hidden" name="expectedTermsVersion" value={termsVersion} />
                <input type="hidden" name="expectedPrivacyVersion" value={privacyVersion} />
                <input
                  type="hidden"
                  name="expectedBusinessUseDeclarationVersion"
                  value={businessUseDeclarationVersion}
                />
              </form>

              <div className="grid min-w-0 gap-2 border-t pt-[18px]">
                <div className="mb-1">
                  <h3 className="text-sm font-bold text-foreground">{t("checkoutDeclarationsRequiredTitle")}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("checkoutDeclarationsIntro")}</p>
                </div>
                {legalSubmitRequested && !(businessUseAccepted && termsAccepted && previewApprovalAccepted) && (
                  <Alert id="checkout-declarations-error" variant="destructive" role="alert" tabIndex={-1} className="border-destructive/35 bg-destructive/15">
                    <CircleAlert className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutRequiredLabel")}</AlertTitle>
                    <AlertDescription>{t("checkoutDeclarationsRequiredDescription")}</AlertDescription>
                  </Alert>
                )}
                <AcceptanceCheckbox
                  id="checkout-business-use"
                  checked={businessUseAccepted}
                  onCheckedChange={setBusinessUseAccepted}
                  title={t("checkoutBusinessPurchaseTitle")}
                  label={businessUseDeclarationText}
                  help={t("checkoutBusinessUseHelp")}
                  requiredLabel={t("checkoutRequiredLabel")}
                  describedBy={legalSubmitRequested && !businessUseAccepted ? "checkout-declarations-error" : undefined}
                  invalid={legalSubmitRequested && !businessUseAccepted}
                />
                <AcceptanceCheckbox
                  id="checkout-terms"
                  checked={termsAccepted}
                  onCheckedChange={setTermsAccepted}
                  title={t("checkoutTermsPrivacyTitle")}
                  label={t.rich("checkoutTermsAcceptanceLabel", {
                    terms: (chunks) => (
                      <a href={termsHref} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                        {chunks}
                      </a>
                    ),
                    version: termsVersion,
                  })}
                  help={t.rich("checkoutPrivacyDisclosure", {
                    privacy: (chunks) => (
                      <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {chunks}
                      </a>
                    ),
                  })}
                  requiredLabel={t("checkoutRequiredLabel")}
                  describedBy={legalSubmitRequested && !termsAccepted ? "checkout-declarations-error" : undefined}
                  invalid={legalSubmitRequested && !termsAccepted}
                />
                <AcceptanceCheckbox
                  id="checkout-preview-approval"
                  checked={previewApprovalAccepted}
                  onCheckedChange={setPreviewApprovalAccepted}
                  title={t("checkoutWebsiteApprovalTitle")}
                  label={t("checkoutPreviewApprovalLabel")}
                  help={t("checkoutPreviewApprovalHelp")}
                  requiredLabel={t("checkoutRequiredLabel")}
                  describedBy={legalSubmitRequested && !previewApprovalAccepted ? "checkout-declarations-error" : undefined}
                  invalid={legalSubmitRequested && !previewApprovalAccepted}
                />
              </div>

              {paymentSubmitRequested && paymentState.message && (
                <Alert
                  variant={
                    paymentState.ok ||
                    paymentState.status === "payment_complete" ||
                    paymentState.status === "payment_pending"
                      ? "default"
                      : "destructive"
                  }
                  role={
                    paymentState.ok || paymentState.status === "payment_pending"
                      ? "status"
                      : "alert"
                  }
                >
                  <AlertTitle>{paymentAlertTitle(paymentState, t)}</AlertTitle>
                  <AlertDescription>{paymentState.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </section>}
          <div className="flex items-start gap-2 border-t bg-muted/45 px-[17px] py-3.5 text-xs leading-relaxed text-muted-foreground min-[560px]:px-[26px] min-[560px]:py-4">
            <LockKeyhole className="mt-0.5 size-[15px] shrink-0" aria-hidden />
            <span>{t("checkoutSignedQuoteNote")}</span>
          </div>
          </div>
          <OrderSummaryRail
            domain={selectedDomain ?? domainValue}
            company={savedProfile?.contractingPartyName ?? details.registeredBusinessName ?? details.intendedCompanyName ?? customerEmail}
            plan={billingPeriod === "annual" ? t("checkoutPlanAnnualShort") : t("checkoutPlanMonthlyShort")}
            dueNow={dueNowLabel}
            quote={selectedQuote?.quote}
            locale={locale}
            primaryAction={presentation.primaryAction}
            handlers={primaryActionHandlers}
          />
          </div>
        )}
      </div>

      {(presentation.phase === "review" || (presentation.phase === "address" && Boolean(selectedDomain))) && <MobileCheckoutBar
        decision={step}
        action={presentation.primaryAction}
        selectedDomain={selectedDomain}
        navigationLocked={acceptedOrderId != null}
        dueNow={dueNowLabel}
        plan={billingPeriod === "annual" ? t("checkoutPlanAnnualShort") : t("checkoutPlanMonthlyShort")}
        quote={selectedQuote?.quote}
        locale={locale}
        previewHref={previewHref}
        handlers={primaryActionHandlers}
      />}
    </main>
  )
}

const migrationCustomerActionLabel = (
  action: string,
  t: ReturnType<typeof useTranslations<"preview">>,
): string => {
  const keys = {
    provide_epp_code: "checkoutMigrationActionProvideEpp",
    authorize_provider: "checkoutMigrationActionAuthorizeProvider",
    upload_complete_zone: "checkoutMigrationActionUploadZone",
    confirm_transfer: "checkoutMigrationActionConfirmTransfer",
    verify_registrant: "checkoutMigrationActionVerifyRegistrant",
    remove_dnssec_ds: "checkoutMigrationActionRemoveDnssecDs",
  } as const
  const key = keys[action as keyof typeof keys]
  return key ? t(key) : t("checkoutMigrationActionUnknown")
}

const provisioningStageLabel = (
  stage: CustomerProvisioningStatus["stages"][number]["code"],
  t: ReturnType<typeof useTranslations<"preview">>,
): string => {
  const keys = {
    payment: "checkoutProvisioningStage_payment",
    registration: "checkoutProvisioningStage_registration",
    registrant_verification: "checkoutProvisioningStage_registrant_verification",
    dns: "checkoutProvisioningStage_dns",
    https: "checkoutProvisioningStage_https",
    activation: "checkoutProvisioningStage_activation",
  } as const
  return t(keys[stage])
}

const provisioningStageStatusLabel = (
  status: CustomerProvisioningStatus["stages"][number]["status"],
  t: ReturnType<typeof useTranslations<"preview">>,
): string => {
  const keys = {
    pending: "checkoutProvisioningStageStatus_pending",
    action_required: "checkoutProvisioningStageStatus_action_required",
    complete: "checkoutProvisioningStageStatus_complete",
    review: "checkoutProvisioningStageStatus_review",
  } as const
  return t(keys[status])
}

const migrationCustomerActionStatusLabel = (
  status: string,
  t: ReturnType<typeof useTranslations<"preview">>,
): string => {
  const keys = {
    required: "checkoutMigrationActionStatusRequired",
    pending: "checkoutMigrationActionStatusPending",
    failed: "checkoutMigrationActionStatusFailed",
    overdue: "checkoutMigrationActionStatusOverdue",
    completed: "checkoutMigrationActionStatusCompleted",
  } as const
  const key = keys[status as keyof typeof keys]
  return key ? t(key) : t("checkoutMigrationActionStatusUnknown")
}

const migrationStateLabel = (
  state: string,
  t: ReturnType<typeof useTranslations<"preview">>,
): string => {
  const keys = {
    assessment: "checkoutMigrationStateAssessment",
    awaiting_customer: "checkoutMigrationStateAwaitingCustomer",
    ready_to_prepare: "checkoutMigrationStateReadyToPrepare",
    preparing: "checkoutMigrationStatePreparing",
    awaiting_provider: "checkoutMigrationStateAwaitingProvider",
    ready_for_cutover: "checkoutMigrationStateReadyForCutover",
    cutover_in_progress: "checkoutMigrationStateCutoverInProgress",
    verifying: "checkoutMigrationStateVerifying",
    completed: "checkoutMigrationStateCompleted",
    paused_supplemental_order: "checkoutMigrationStatePausedSupplemental",
    custom_quote_required: "checkoutMigrationStateCustomQuote",
    failed: "checkoutMigrationStateFailed",
    rolled_back: "checkoutMigrationStateRolledBack",
  } as const
  const key = keys[state as keyof typeof keys]
  return key ? t(key) : t("checkoutMigrationStateUnknown")
}

function PreviewCheckoutStepper({
  step,
  highestReachedStep,
  onStepSelect,
}: {
  step: CheckoutStep
  highestReachedStep: number
  onStepSelect?: (step: CheckoutStep) => void
}) {
  const t = useTranslations("preview")
  const steps: Array<{ id: CheckoutStep; label: string; description: string; icon: React.ElementType }> = [
    { id: "domain", label: t("checkoutStepDomain"), description: t("checkoutStepDomainDescription"), icon: Globe2 },
    { id: "review", label: t("checkoutStepPayment"), description: t("checkoutStepPaymentDescription"), icon: FileText },
  ]
  return (
    <CheckoutStepper
      steps={steps}
      activeStep={step}
      reachableSteps={steps
        .slice(0, highestReachedStep + 1)
        .map((entry) => entry.id)}
      onStepSelect={onStepSelect}
      progressText={(current, total, label) => t("checkoutProgressText", { current, total, label })}
    />
  )
}

function paymentAlertTitle(
  state: PreviewCheckoutActionState,
  t: ReturnType<typeof useTranslations<"preview">>,
): string {
  if (state.ok) return t("checkoutPaymentStartingTitle")
  if (state.status === "payment_complete") return t("checkoutPaymentCompleteTitle")
  if (state.status === "payment_pending") return t("checkoutPaymentPendingTitle")
  if (state.status === "profile_conflict" || state.status === "version_conflict") {
    return t("checkoutVersionConflictTitle")
  }
  return t("checkoutPaymentErrorTitle")
}
