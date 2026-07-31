"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Globe2,
  Info,
  Loader2,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { cn } from "@siteinabox/ui/lib/utils"
import { tldUsesIcannTransferPolicy } from "@siteinabox/contracts/tld-capabilities"

import { CheckoutStepper } from "@/components/preview/CheckoutStepper"
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

type CheckoutStep = "domain" | "details" | "overview"
type BillingPeriod = "monthly" | "annual"
type AutomaticMigrationSourceMethod =
  | "cloudflare_api_v1"
  | "authorized_axfr_v1"
const checkoutStepOrder: CheckoutStep[] = ["domain", "details", "overview"]

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
  initialStep?: CheckoutStep
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
  const [step, setStep] = React.useState<CheckoutStep>(initialStep)
  const [highestReachedStep, setHighestReachedStep] = React.useState(
    checkoutStepOrder.indexOf(initialStep),
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
  const domainFormRef = React.useRef<HTMLFormElement | null>(null)
  const domainRequestTokenRef = React.useRef<HTMLInputElement | null>(null)
  const latestDomainRequestTokenRef = React.useRef<string | null>(null)
  const profileRequestTokenRef = React.useRef<HTMLInputElement | null>(null)
  const latestProfileRequestTokenRef = React.useRef<string | null>(null)
  const paymentFormRef = React.useRef<HTMLFormElement | null>(null)
  const stepHeadingRef = React.useRef<HTMLHeadingElement | null>(null)
  const profileErrorSummaryRef = React.useRef<HTMLDivElement | null>(null)
  const lastSubmittedDomainRef = React.useRef<string | null>(readyDomain)
  const [paymentSubmitRequested, setPaymentSubmitRequested] = React.useState(false)
  const [previewApprovalAccepted, setPreviewApprovalAccepted] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [businessUseAccepted, setBusinessUseAccepted] = React.useState(false)
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
    if (step !== "domain" || domainMode !== "new_registration") return
    if (!domainLooksCheckable) return
    if (
      normalizedDomainValue === checkedDomain ||
      normalizedDomainValue === lastSubmittedDomainRef.current
    ) return
    const timer = window.setTimeout(() => {
      lastSubmittedDomainRef.current = normalizedDomainValue
      domainFormRef.current?.requestSubmit()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [checkedDomain, domainLooksCheckable, domainMode, normalizedDomainValue, step])

  React.useEffect(() => {
    if (
      profileState.requestToken &&
      profileState.requestToken !== latestProfileRequestTokenRef.current
    ) return
    if (profileState.ok && profileState.profile) {
      setSavedProfile(profileState.profile)
      setDetails(profileState.profile)
      setDetailsDirty(false)
      if (profileState.quotes) setQuotes(profileState.quotes)
      setStep("overview")
      return
    }
    if (profileState.status === "conflict" && profileState.currentProfile) {
      setSavedProfile(profileState.currentProfile)
      setDetailsDirty(true)
      setStep("details")
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

  const selectedDomain =
    checkedDomain && checkedDomain === normalizedDomainValue ? checkedDomain : null
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
      checkAppliesToCurrentInput
        ? checkState.ok
        : selectedDomain === readyDomain
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
    if (value.trim().toLowerCase() !== checkedDomain) {
      setCheckedDomain(null)
      setQuotes(null)
      setMigrationSourceMethod("")
      setMigrationPreflight(null)
      if (step !== "domain") setStep("domain")
    }
  }

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

  const goBack = () => {
    if (acceptedOrderId != null) return
    if (step === "details") setStep("domain")
    if (step === "overview") setStep("details")
  }

  const submitPayment = () => {
    if (requiresMigrationRecollection) return
    setPaymentSubmitRequested(true)
    paymentFormRef.current?.requestSubmit()
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

  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground md:pb-6">
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
      <header data-siab-cms-sticky-chrome className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center gap-3 px-3 py-2 md:min-h-16 md:px-4">
          <a href={previewHref} className="flex min-w-0 items-center gap-2">
            <img src="/logos/logo-light.svg" alt="Site in a Box" className="h-8 w-auto dark:hidden md:h-9" />
            <img src="/logos/logo-dark.svg" alt="Site in a Box" className="hidden h-8 w-auto dark:block md:h-9" />
          </a>
          <div className="flex-1" />
          <Button asChild variant="outline" className="shrink-0">
            <a href={previewHref}>
              <X className="size-4 sm:hidden" aria-hidden />
              <ArrowLeft className="hidden size-4 sm:block" aria-hidden />
              <span className="hidden sm:inline">{t("checkoutBackToPreview")}</span>
            </a>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 w-full max-w-4xl gap-4 p-3 [&>*]:min-w-0 md:p-4">
        <PreviewCheckoutStepper
          step={step}
          highestReachedStep={
            acceptedOrderId == null
              ? highestReachedStep
              : checkoutStepOrder.indexOf(step)
          }
          onStepSelect={acceptedOrderId == null ? setStep : () => {}}
        />

        {paymentReturn && (
          <Alert role="status" aria-live="polite">
            <Info className="size-4" aria-hidden />
            <AlertTitle>{t("checkoutPaymentReturnTitle")}</AlertTitle>
            <AlertDescription>
              {paymentStatusLive === "completed"
                ? t("checkoutPaymentReturnCompleted")
                : paymentStatusLive === "pending_provider"
                  ? t("checkoutPaymentReturnPending")
                  : ["failed", "canceled", "cancelled", "expired"].includes(paymentStatusLive)
                    ? t("checkoutPaymentReturnFailed")
                    : t("checkoutPaymentReturnUnknown")}
            </AlertDescription>
          </Alert>
        )}

        {provisioningStatus && (
          <Alert role="status" aria-live="polite">
            <Globe2 className="size-4" aria-hidden />
            <AlertTitle>
              {t("checkoutProvisioningStatusTitle", {
                domain: provisioningStatus.domain,
              })}
            </AlertTitle>
            <AlertDescription>
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {provisioningStatus.stages.map((stage) => (
                  <li
                    key={stage.code}
                    className="flex items-center gap-2 rounded-md border bg-background p-3"
                  >
                    {stage.status === "complete"
                      ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                      : stage.status === "action_required"
                        ? <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden />
                        : stage.status === "review"
                          ? <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                          : <Loader2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span>
                      <span className="block font-medium">
                        {provisioningStageLabel(stage.code, t)}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {provisioningStageStatusLabel(stage.status, t)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {provisioningStatus.stages.some((stage) =>
                stage.code === "registrant_verification" &&
                stage.status === "action_required") && (
                <p className="mt-3 font-medium">
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
              )}
            </AlertDescription>
          </Alert>
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
          <Alert role="status" aria-live="polite">
            <Globe2 className="size-4" aria-hidden />
            <AlertTitle>
              {t("checkoutMigrationStatusTitle", {
                domain: migrationStatus.domain,
              })}
            </AlertTitle>
            <AlertDescription>
              <span className="block">
                {t("checkoutMigrationStatusState", {
                  state: migrationStateLabel(migrationStatus.state, t),
                })}
              </span>
              {migrationStatus.actions.filter((action) =>
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
                    className="mt-4 grid gap-3 rounded-md border bg-background p-3"
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
                          <Label htmlFor="migration-replacement-transfer-code">
                            {t("checkoutMigrationTransferCodeReplacement")}
                          </Label>
                          <Input
                            id="migration-replacement-transfer-code"
                            name="transferCode"
                            type="password"
                            autoComplete="off"
                            required
                          />
                        </>
                      )}
                    <Button
                      type="submit"
                      className="w-fit"
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
                      {t("checkoutMigrationTransferCodeSubmit")}
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

        {step === "domain" && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h1 ref={stepHeadingRef} tabIndex={-1} className="text-xl outline-none md:text-2xl">
                  {t("checkoutDomainTitle")}
                </h1>
              </CardTitle>
              <CardDescription className="text-base">
                {t("checkoutDomainStepDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
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
              <fieldset className="grid gap-3">
                <legend className="text-base font-semibold">
                  {t("checkoutDomainModeLegend")}
                </legend>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
                  <input
                    type="radio"
                    name="checkout-domain-mode"
                    value="new_registration"
                    checked={domainMode === "new_registration"}
                    onChange={() => updateDomainMode("new_registration")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">{t("checkoutDomainModeNew")}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t("checkoutDomainModeNewHelp")}
                    </span>
                  </span>
                </label>
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-4"
                >
                  <input
                    type="radio"
                    name="checkout-domain-mode"
                    value="existing_domain"
                    checked={domainMode === "existing_domain"}
                    onChange={() => updateDomainMode("existing_domain")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">{t("checkoutDomainModeExisting")}</span>
                    <span className="block text-sm text-muted-foreground">
                      {existingDomainMigrationEnabled
                        ? t("checkoutDomainModeExistingHelp")
                        : t("checkoutDomainModeExistingPreflight")}
                    </span>
                  </span>
                </label>
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
                <Label htmlFor="checkout-domain">{t("checkoutDomainLabel")}</Label>
                <input ref={domainRequestTokenRef} type="hidden" name="requestToken" />
                <input type="hidden" name="domainMode" value={domainMode} />
                {migrationSourceMethod && (
                  <input
                    type="hidden"
                    name="migrationSourceMethod"
                    value={migrationSourceMethod}
                  />
                )}
                <div className="relative">
                  <Input
                    id="checkout-domain"
                    name="domain"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={domainValue}
                    onChange={(event) => updateDomain(event.target.value)}
                    placeholder={t("checkoutDomainPlaceholder")}
                    aria-invalid={domainInputState === "error" ? true : undefined}
                    aria-describedby={domainDescriptionId}
                    className={cn(
                      "h-12 pr-12 text-base font-medium md:h-13 md:text-lg",
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
                  <div className="mt-3 grid gap-4 rounded-md border bg-muted/20 p-4">
                    {!cloudflareSourceAuthorization &&
                      availableMigrationSourceMethods.length > 0 && (
                        <fieldset className="grid gap-3">
                          <legend className="font-medium">
                            {t("checkoutMigrationSourceLegend")}
                          </legend>
                          <p className="text-sm text-muted-foreground">
                            {t("checkoutMigrationSourceHelp")}
                          </p>
                          {([
                            ["cloudflare_api_v1", "checkoutMigrationSourceCloudflare"],
                            ["authorized_axfr_v1", "checkoutMigrationSourceAxfr"],
                          ] as const)
                            .filter(([value]) =>
                              availableMigrationSourceMethods.includes(value))
                            .map(([value, label]) => (
                              <label
                                key={value}
                                className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3"
                              >
                                <input
                                  type="radio"
                                  name="checkout-migration-source"
                                  value={value}
                                  checked={migrationSourceMethod === value}
                                  onChange={() =>
                                    updateMigrationSourceMethod(value)}
                                  className="mt-1"
                                />
                                <span>{t(label)}</span>
                              </label>
                            ))}
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
                          <Alert role="status">
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
                            className="w-fit"
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

              {domainMode === "existing_domain" && checkAppliesToCurrentInput && (
                <Alert
                  variant={
                    checkState.ok && !migrationTransferBlocked
                      ? "default"
                      : "destructive"
                  }
                  role={
                    checkState.ok && !migrationTransferBlocked
                      ? "status"
                      : "alert"
                  }
                >
                  <Info className="size-4" aria-hidden />
                  <AlertTitle>
                    {migrationTransferBlocked
                      ? t("checkoutMigrationTransferBlockedTitle")
                      : checkState.migrationPreflightOnly
                      ? t("checkoutMigrationPreflightComplete")
                      : checkState.migrationReadiness === "ready_automatic"
                      ? t("checkoutMigrationReadyAutomatic")
                      : t("checkoutMigrationUnsupported")}
                  </AlertTitle>
                  <AlertDescription>
                    {checkState.message}
                    {checkState.migrationPublicEvidence && (
                      <span className="mt-2 block text-sm">
                        {t("checkoutMigrationPublicEvidence", {
                          registrar: checkState.migrationPublicEvidence.registrar ?? t("checkoutUnknown"),
                          provider:
                            checkState.migrationPublicEvidence.probableDnsProvider ??
                            t("checkoutUnknown"),
                          nameservers:
                            checkState.migrationPublicEvidence.authoritativeNameservers.join(", ") ||
                            t("checkoutUnknown"),
                          dnssec: checkState.migrationPublicEvidence.dnssecDsPresent
                            ? t("checkoutMigrationDnssecPresent")
                            : t("checkoutMigrationDnssecAbsent"),
                        })}
                      </span>
                    )}
                  </AlertDescription>
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

              {domainMode === "new_registration" && (
                <ExistingDomainMigrationInfo catalog={catalog} locale={locale} />
              )}
            </CardContent>
          </Card>
        )}

        {step === "details" && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h1 ref={stepHeadingRef} tabIndex={-1} className="text-xl outline-none md:text-2xl">
                  {t("checkoutDetailsTitle")}
                </h1>
              </CardTitle>
              <CardDescription className="text-base">
                {t("checkoutDetailsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="checkout-profile-form"
                action={profileAction}
                className="grid gap-6"
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

                <fieldset className="grid gap-3">
                  <legend className="text-base font-semibold">
                    {t("checkoutPartyTypeLegend")}
                  </legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
                    <input
                      type="radio"
                      name="partyType"
                      value="registered_business"
                      checked={details.partyType === "registered_business"}
                      onChange={() => updateDetail("partyType", "registered_business")}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{t("checkoutPartyRegistered")}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t("checkoutPartyRegisteredHelp")}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
                    <input
                      type="radio"
                      name="partyType"
                      value="business_in_formation"
                      checked={details.partyType === "business_in_formation"}
                      onChange={() => updateDetail("partyType", "business_in_formation")}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{t("checkoutPartyInFormation")}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t("checkoutPartyInFormationHelp")}
                      </span>
                    </span>
                  </label>
                </fieldset>

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
                  <>
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
                  </>
                )}

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

                <fieldset className="grid gap-4">
                  <legend className="text-base font-semibold">{t("checkoutPhoneTitle")}</legend>
                  <div className="grid gap-4 sm:grid-cols-[7rem_8rem_1fr]">
                    <CheckoutTextField
                      id="checkout-phone-country"
                      name="phoneCountryCode"
                      label={t("checkoutPhoneCountry")}
                      value={details.phoneCountryCode}
                      error={profileState.fieldErrors?.phoneCountryCode}
                      autoComplete="tel-country-code"
                      onChange={(value) => updateDetail("phoneCountryCode", value)}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-phone-area"
                      name="phoneAreaCode"
                      label={t("checkoutPhoneArea")}
                      value={details.phoneAreaCode}
                      error={profileState.fieldErrors?.phoneAreaCode}
                      inputMode="numeric"
                      autoComplete="tel-area-code"
                      onChange={(value) => updateDetail("phoneAreaCode", value.replace(/\D/g, ""))}
                      required
                    />
                    <CheckoutTextField
                      id="checkout-phone-number"
                      name="phoneSubscriberNumber"
                      label={t("checkoutPhoneNumber")}
                      value={details.phoneSubscriberNumber}
                      error={profileState.fieldErrors?.phoneSubscriberNumber}
                      inputMode="numeric"
                      autoComplete="tel-local"
                      onChange={(value) => updateDetail("phoneSubscriberNumber", value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "overview" && savedProfile && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h1 ref={stepHeadingRef} tabIndex={-1} className="text-xl outline-none md:text-2xl">
                  {t("checkoutSubscriptionOverviewTitle")}
                </h1>
              </CardTitle>
              <CardDescription className="text-base">
                {t("checkoutSubscriptionOverviewDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-6 [&>*]:min-w-0">
              <fieldset className="grid min-w-0 gap-3">
                <legend className="text-base font-semibold">{t("checkoutPlanLegend")}</legend>
                {(acceptedOrderId == null
                  ? ["annual", "monthly"] as const
                  : [billingPeriod] as const).map((period) => {
                  const option = quotes?.[period]?.quote
                  return (
                    <label
                      key={period}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-4",
                        billingPeriod === period && "border-primary ring-2 ring-primary/20",
                      )}
                    >
                      <input
                        type="radio"
                        name="billing-period-choice"
                        value={period}
                        checked={billingPeriod === period}
                        onChange={() => setBillingPeriod(period)}
                        disabled={acceptedOrderId != null}
                        className="mt-1"
                      />
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="font-medium">
                          {period === "annual"
                            ? t("checkoutPlanAnnual")
                            : t("checkoutPlanMonthly")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("checkoutPlanPriceExVat", {
                            price: money(
                              locale,
                              option?.planPriceNetMinor ?? 0,
                              option?.currency ?? catalog.currency,
                            ),
                          })}
                        </span>
                      </span>
                      {period === "annual" && (
                        <Badge variant="secondary">{t("checkoutPlanAnnualSaving")}</Badge>
                      )}
                    </label>
                  )
                })}
              </fieldset>

              <div className="grid min-w-0 gap-3 rounded-md border p-4">
                <ReviewRow
                  label={t("checkoutSummaryDomain")}
                  value={selectedDomain ?? domainValue}
                />
                <ReviewRow
                  label={t("checkoutContractingParty")}
                  value={savedProfile.contractingPartyName}
                />
                <ReviewRow
                  label={t("checkoutPartyClassification")}
                  value={
                    savedProfile.partyType === "registered_business"
                      ? t("checkoutPartyRegistered")
                      : t("checkoutPartyInFormation")
                  }
                />
                {selectedQuote && (
                  <>
                    <ReviewRow
                      label={t("checkoutSummaryPlanExVat")}
                      value={money(
                        locale,
                        selectedQuote.quote.planPriceNetMinor,
                        selectedQuote.quote.currency,
                      )}
                    />
                    <ReviewRow
                      label={t("checkoutSummaryProviderDomainExVat")}
                      value={money(
                        locale,
                        selectedQuote.quote.providerOperationPriceNetMinor,
                        selectedQuote.quote.currency,
                      )}
                    />
                    <ReviewRow
                      label={t("checkoutSummaryDomainAllowanceExVat")}
                      value={money(
                        locale,
                        selectedQuote.quote.domainIncludedAllowanceNetMinor,
                        selectedQuote.quote.currency,
                      )}
                    />
                    <ReviewRow
                      label={t("checkoutSummaryDomainSurchargeExVat")}
                      value={money(
                        locale,
                        selectedQuote.quote.domainSurchargeNetMinor,
                        selectedQuote.quote.currency,
                      )}
                    />
                    {selectedQuote.quote.migrationServiceFeeNetMinor > 0 && (
                      <ReviewRow
                        label={t("checkoutSummaryMigrationExVat")}
                        value={money(
                          locale,
                          selectedQuote.quote.migrationServiceFeeNetMinor,
                          selectedQuote.quote.currency,
                        )}
                      />
                    )}
                  </>
                )}
                <ReviewRow
                  label={t("checkoutSummaryNet")}
                  value={money(locale, netAmountMinor, catalog.currency)}
                />
                <ReviewRow
                  label={t("checkoutSummaryVat")}
                  value={money(locale, vatAmountMinor, catalog.currency)}
                />
                <ReviewRow
                  label={t("checkoutSummaryTotal")}
                  value={money(locale, grossAmountMinor, catalog.currency)}
                  strong
                />
                {selectedQuote && (
                  <>
                    <ReviewRow
                      label={t("checkoutSummaryFutureSubscription")}
                      value={money(
                        locale,
                        selectedQuote.quote.futureSubscriptionGrossMinor,
                        selectedQuote.quote.currency,
                      )}
                    />
                    {selectedQuote.quote.domainMode === "existing_domain" &&
                      selectedQuote.quote.transferRenewalEffect && (
                      <ReviewRow
                        label={t("checkoutTransferRenewalEffect")}
                        value={
                          selectedQuote.quote.transferRenewalEffect === "unchanged"
                            ? t("checkoutTransferRenewalEffectUnchanged")
                            : selectedQuote.quote.transferRenewalEffect === "extends_one_year"
                              ? t("checkoutTransferRenewalEffectExtendsOneYear")
                              : selectedQuote.quote.transferRenewalEffect ===
                                  "restarts_from_transfer_date"
                                ? t("checkoutTransferRenewalEffectRestartsFromTransferDate")
                                : t("checkoutTransferRenewalEffectProviderDetermined")
                        }
                      />
                    )}
                    <p className="text-sm text-muted-foreground">
                      {selectedQuote.quote.transferRenewalEffect === "unchanged"
                        ? t("checkoutDomainRenewalExplanationUnchanged")
                        : selectedQuote.quote.transferRenewalEffect === "extends_one_year"
                          ? t("checkoutDomainRenewalExplanationExtendsOneYear")
                          : selectedQuote.quote.transferRenewalEffect ===
                              "restarts_from_transfer_date"
                            ? t("checkoutDomainRenewalExplanationRestartsFromTransferDate")
                            : selectedQuote.quote.transferRenewalEffect ===
                                "provider_determined"
                              ? t("checkoutDomainRenewalExplanationProviderDetermined")
                              : t("checkoutDomainRenewalExplanationGeneric")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("checkoutQuoteValidUntil", {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(selectedQuote.quote.quoteExpiresAt)),
                      })}
                    </p>
                  </>
                )}
              </div>

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

              <div className="grid min-w-0 gap-4 border-t pt-5">
                <AcceptanceCheckbox
                  id="checkout-preview-approval"
                  checked={previewApprovalAccepted}
                  onCheckedChange={setPreviewApprovalAccepted}
                  label={t("checkoutPreviewApprovalLabel")}
                  help={t("checkoutPreviewApprovalHelp")}
                />
                <AcceptanceCheckbox
                  id="checkout-business-use"
                  checked={businessUseAccepted}
                  onCheckedChange={setBusinessUseAccepted}
                  label={businessUseDeclarationText}
                  help={t("checkoutBusinessUseHelp")}
                />
                <label
                  htmlFor="checkout-terms"
                  className="flex min-w-0 items-start gap-3 text-sm leading-6"
                >
                  <Checkbox
                    id="checkout-terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-1"
                  />
                  <span className="min-w-0 break-words">
                    {t.rich("checkoutTermsAcceptanceLabel", {
                      terms: (chunks) => (
                        <a href={termsHref} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                          {chunks}
                        </a>
                      ),
                      version: termsVersion,
                    })}
                    <span className="block text-muted-foreground">
                      {t.rich("checkoutPrivacyDisclosure", {
                        privacy: (chunks) => (
                          <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            {chunks}
                          </a>
                        ),
                      })}
                    </span>
                  </span>
                </label>
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
            </CardContent>
          </Card>
        )}
      </div>

      <CheckoutActionBar
        step={step}
        canContinueFromDomain={domainIsReady}
        profileReady={Boolean(savedProfile && !detailsDirty)}
        quoteReady={Boolean(selectedQuote)}
        selectedDomain={selectedDomain}
        checkPending={checkPending}
        profilePending={profilePending}
        paymentPending={paymentPending}
        paymentBlocked={requiresMigrationRecollection}
        domainResultKind={domainResultKind}
        preflightComplete={
          checkState.status === "preflight_complete" &&
          checkAppliesToCurrentInput &&
          !migrationSourceMethod
        }
        sourceAcquisitionReady={Boolean(
          checkState.status === "preflight_complete" &&
          checkAppliesToCurrentInput &&
          !migrationTransferBlocked &&
          !migrationReleaseBlocked &&
          migrationSourceMethod,
        )}
        paymentStatus={
          paymentState.status === "payment_pending"
            ? "pending_provider"
            : paymentStatusLive
        }
        navigationLocked={acceptedOrderId != null}
        legalAccepted={
          previewApprovalAccepted && termsAccepted && businessUseAccepted
        }
        totalPriceLabel={money(
          locale,
          grossAmountMinor,
          selectedQuote?.quote.currency ?? catalog.currency,
        )}
        previewHref={previewHref}
        onBack={goBack}
        onDomainNext={() => setStep("details")}
        onPay={submitPayment}
        t={t}
      />
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
  onStepSelect: (step: CheckoutStep) => void
}) {
  const t = useTranslations("preview")
  const steps: Array<{ id: CheckoutStep; label: string; icon: React.ElementType }> = [
    { id: "domain", label: t("checkoutStepDomain"), icon: Globe2 },
    { id: "details", label: t("checkoutStepDetails"), icon: UserRound },
    { id: "overview", label: t("checkoutStepSubscriptionOverview"), icon: ReceiptText },
  ]
  return (
    <CheckoutStepper
      steps={steps}
      activeStep={step}
      reachableSteps={steps
        .slice(0, highestReachedStep + 1)
        .map((entry) => entry.id)}
      onStepSelect={onStepSelect}
    />
  )
}

function CheckoutActionBar({
  step,
  canContinueFromDomain,
  profileReady,
  quoteReady,
  selectedDomain,
  checkPending,
  profilePending,
  paymentPending,
  paymentBlocked,
  domainResultKind,
  preflightComplete,
  sourceAcquisitionReady,
  paymentStatus,
  navigationLocked,
  legalAccepted,
  totalPriceLabel,
  previewHref,
  onBack,
  onDomainNext,
  onPay,
  t,
}: {
  step: CheckoutStep
  canContinueFromDomain: boolean
  profileReady: boolean
  quoteReady: boolean
  selectedDomain: string | null
  checkPending: boolean
  profilePending: boolean
  paymentPending: boolean
  paymentBlocked: boolean
  domainResultKind: "loading" | "info" | "success" | "unavailable" | "error" | null
  preflightComplete: boolean
  sourceAcquisitionReady: boolean
  paymentStatus: string
  navigationLocked: boolean
  legalAccepted: boolean
  totalPriceLabel: string
  previewHref: string
  onBack: () => void
  onDomainNext: () => void
  onPay: () => void
  t: ReturnType<typeof useTranslations<"preview">>
}) {
  const secondary = navigationLocked && step !== "domain" ? null : step === "domain" ? (
    <Button asChild variant="outline" className="w-11 px-0 md:w-auto md:px-4" aria-label={t("checkoutBackToPreview")}>
      <a href={previewHref}>
        <X className="size-4 md:hidden" aria-hidden />
        <ArrowLeft className="hidden size-4 md:block" aria-hidden />
        <span className="hidden md:inline">{t("checkoutBackToPreview")}</span>
      </a>
    </Button>
  ) : (
    <Button type="button" variant="outline" className="w-11 px-0 md:w-auto md:px-4" aria-label={t("checkoutBack")} onClick={onBack}>
      <ArrowLeft className="size-4" aria-hidden />
      <span className="hidden md:inline">{t("checkoutBack")}</span>
    </Button>
  )

  let primary: React.ReactNode
  if (step === "domain" && canContinueFromDomain) {
    primary = (
      <Button
        key="domain-next"
        type="button"
        variant="success"
        className="min-w-0 flex-1 md:flex-none"
        onClick={onDomainNext}
      >
        <CheckCircle2 className="size-4" aria-hidden />
        {t("checkoutNext")}
      </Button>
    )
  } else if (step === "domain") {
    const unavailable = domainResultKind === "unavailable"
    primary = preflightComplete ? (
      <Button
        key="domain-preflight-complete"
        type="button"
        variant="outline"
        className="min-w-0 flex-1 md:flex-none"
        disabled
      >
        <Info className="size-4" aria-hidden />
        {t("checkoutMigrationPreflightNoOrder")}
      </Button>
    ) : (
      <Button
        key="domain-check"
        form="checkout-domain-form"
        type="submit"
        variant={unavailable ? "ghost" : "default"}
        className={cn("min-w-0 flex-1 md:flex-none", unavailable && "text-muted-foreground")}
        disabled={checkPending || unavailable}
      >
        {checkPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
        {checkPending
          ? t("checkoutDomainCheckingShort")
          : sourceAcquisitionReady
            ? t("checkoutMigrationVerifySource")
          : unavailable
            ? t("checkoutDomainOccupied")
            : domainResultKind === "error"
              ? t("checkoutCheckAgain")
              : t("checkoutCheckDomain")}
      </Button>
    )
  } else if (step === "details") {
    primary = (
      <Button
        key="details-save"
        form="checkout-profile-form"
        type="submit"
        variant="success"
        className="min-w-0 flex-1 md:flex-none"
        disabled={profilePending}
      >
        {profilePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
        {profileReady ? t("checkoutDetailsConfirm") : t("checkoutDetailsSave")}
      </Button>
    )
  } else {
  const complete = paymentStatus === "completed"
  const paymentInProgress = ["pending_provider", "open", "authorized"].includes(paymentStatus)
    primary = (
      <Button
        key="payment"
        type="button"
        variant="success"
        className="min-w-0 flex-1 md:flex-none"
        disabled={
          paymentPending ||
          paymentBlocked ||
          !selectedDomain ||
          !profileReady ||
          !quoteReady ||
          !legalAccepted ||
          paymentInProgress ||
          complete
        }
        aria-describedby={
          paymentBlocked ? "migration-recollection-payment-block" : undefined
        }
        onClick={onPay}
      >
        {paymentPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
        {complete ? t("paymentCompleted") : `${t("checkoutStartPayment")} - ${totalPriceLabel}`}
      </Button>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-lg backdrop-blur md:static md:mx-auto md:mt-2 md:w-full md:max-w-[54rem] md:rounded-md md:border md:bg-card md:shadow-none">
      <div className="flex min-w-0 items-center justify-end gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  )
}

function CheckoutTextField({
  id,
  name,
  label,
  value,
  error,
  description,
  onChange,
  ...inputProps
}: {
  id: string
  name?: string
  label: string
  value: string | undefined
  error?: string
  description?: string
  onChange?: (value: string) => void
} & Omit<React.ComponentProps<typeof Input>, "id" | "name" | "value" | "onChange">) {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(" ") || undefined
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...inputProps}
        id={id}
        name={name}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      {description && (
        <p id={`${id}-description`} className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  )
}

function AcceptanceCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  help,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  help: string
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 items-start gap-3 text-sm leading-6">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1"
      />
      <span className="min-w-0 break-words">
        {label}
        <span className="block text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}

function MigrationSourceEvidenceFields({
  mechanism,
  idPrefix,
}: {
  mechanism: AutomaticMigrationSourceMethod | null | undefined
  idPrefix: string
}) {
  const t = useTranslations("preview")
  if (mechanism === "authorized_axfr_v1") {
    return (
      <>
        <CheckoutTextField
          id={`${idPrefix}-axfr-nameserver`}
          name="axfrNameserver"
          label={t("checkoutMigrationAxfrNameserverLabel")}
          description={t("checkoutMigrationAxfrNameserverHelp")}
          value={undefined}
          autoComplete="off"
          required
        />
        <CheckoutTextField
          id={`${idPrefix}-axfr-tsig-name`}
          name="axfrTsigName"
          label={t("checkoutMigrationAxfrTsigNameLabel")}
          description={t("checkoutMigrationAxfrTsigHelp")}
          value={undefined}
          autoComplete="off"
        />
        <CheckoutTextField
          id={`${idPrefix}-axfr-tsig-secret`}
          name="axfrTsigSecret"
          type="password"
          label={t("checkoutMigrationAxfrTsigSecretLabel")}
          value={undefined}
          autoComplete="off"
        />
      </>
    )
  }
  return null
}

function ExistingDomainMigrationInfo({
  catalog,
  locale,
}: {
  catalog: PreviewCheckoutCatalog
  locale: string
}) {
  const t = useTranslations("preview")
  return (
    <details className="rounded-md border bg-muted/20 p-4">
      <summary className="cursor-pointer font-medium">
        {t("checkoutExistingDomainTitle")}
      </summary>
      <div className="mt-4 grid gap-3">
        <p className="text-sm text-muted-foreground">
          {t("checkoutExistingDomainDescription")}
        </p>
        <div className="grid gap-3">
          <div className="rounded-md border bg-background p-3">
            <div className="flex items-center gap-2 font-medium">
              <Globe2 className="size-4" aria-hidden />
              {t("checkoutMigrationAutomaticTitle")}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("checkoutMigrationAutomaticDescription", {
                price: money(
                  locale,
                  catalog.migrations.automaticNetAmountMinor,
                  catalog.currency,
                ),
              })}
            </p>
          </div>
        </div>
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertDescription>{t("checkoutMigrationCustomerActions")}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          {t("checkoutMigrationLaterPhaseNotice")}
        </p>
      </div>
    </details>
  )
}

function DomainOptionRow({
  option,
  selected,
  checking = false,
  onSelect,
}: {
  option: PreviewCheckoutDomainOption
  selected?: boolean
  checking?: boolean
  onSelect?: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  const content = (
    <>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="break-all text-base font-medium text-foreground">{option.domain}</span>
        {!option.included && option.extraFeeLabel && (
          <span className="text-sm text-muted-foreground">
            {t("checkoutDomainExtraFeeInline", { extraFee: option.extraFeeLabel })}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {checking ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : option.included ? (
          <span className="text-success" aria-label={t("checkoutDomainIncludedBadge")}>
            <Check className="size-5" aria-hidden />
          </span>
        ) : (
          <Badge variant="secondary">{t("checkoutDomainExtraFeeBadge")}</Badge>
        )}
        {selected && !option.included && (
          <span className="text-success">
            <Check className="size-5" aria-hidden />
            <span className="sr-only">{t("checkoutDomainSelected")}</span>
          </span>
        )}
      </span>
    </>
  )
  if (onSelect) {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-auto min-h-12 w-full justify-between whitespace-normal border border-transparent bg-success/10 p-2.5 text-left shadow-sm shadow-success/10 ring-2 ring-success/70 hover:bg-success/15 hover:ring-success dark:bg-success/10 dark:shadow-success/15 dark:hover:bg-success/15",
          selected && "bg-success/15 ring-success dark:bg-success/15",
        )}
        aria-pressed={selected}
        onClick={() => onSelect(option)}
      >
        {content}
      </Button>
    )
  }
  return (
    <div
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-md border bg-background p-2.5",
        selected && "border-transparent bg-success/10 shadow-sm shadow-success/10 ring-2 ring-success/70",
        checking && "border-border bg-muted/30 text-muted-foreground",
      )}
      aria-busy={checking}
    >
      {content}
    </div>
  )
}

function DomainSuggestions({
  loading,
  suggestions,
  placeholders = [],
  selectedDomain,
  onSelect,
}: {
  loading: boolean
  suggestions?: PreviewCheckoutDomainOption[]
  placeholders?: PreviewCheckoutDomainOption[]
  selectedDomain: string | null
  onSelect: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  if (!loading && !suggestions?.length && !placeholders.length) return null
  const visibleSuggestions = (suggestions ?? []).slice(0, 5)
  const visiblePlaceholders = placeholders.slice(0, Math.max(0, 5 - visibleSuggestions.length))
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="flex items-center gap-2 text-base font-medium text-foreground">
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
        <span>{t("checkoutDomainSuggestionsTitle")}</span>
      </div>
      <div className="grid gap-2">
        {visibleSuggestions.map((option) => (
          <DomainOptionRow
            key={option.domain}
            option={option}
            selected={selectedDomain === option.domain}
            onSelect={onSelect}
          />
        ))}
        {visiblePlaceholders.map((option) => (
          <DomainOptionRow key={`checking-${option.domain}`} option={option} checking />
        ))}
      </div>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words text-right text-base", strong ? "font-semibold" : "font-medium")}>
        {value || "-"}
      </span>
    </div>
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
