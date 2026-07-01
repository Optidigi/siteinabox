"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CheckCircle2,
  CreditCard,
  Globe2,
  Loader2,
  X,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { cn } from "@siteinabox/ui/lib/utils"
import type { DomainRegistrantDetails } from "@/lib/domains/orderState"
import { previewDomainCandidates } from "@/lib/domains/previewDomainCandidates"

export type PreviewCheckoutDomainOption = {
  domain: string
  included: boolean
  extraFeeAmount: string | null
  extraFeeCurrency: string | null
  extraFeeLabel?: string | null
}

export type PreviewCheckoutActionState = {
  ok: boolean
  message: string
  status?: "idle" | "available" | "available_extra" | "unavailable" | "premium" | "invalid" | "service_error" | "payment_error" | "payment_complete" | "redirecting"
  checkoutUrl?: string
  domain?: string
  included?: boolean
  extraFeeAmount?: string | null
  extraFeeCurrency?: string | null
  extraFeeLabel?: string | null
  totalPriceLabel?: string | null
  suggestions?: PreviewCheckoutDomainOption[]
}

export type PreviewCheckoutSuggestionsState = {
  ok: boolean
  domain?: string
  suggestions?: PreviewCheckoutDomainOption[]
  cursor?: number
  done?: boolean
}

type PreviewCheckoutAction = (
  previousState: PreviewCheckoutActionState,
  formData: FormData,
) => Promise<PreviewCheckoutActionState>

type CheckoutStep = "domain" | "payment"

type PreviewCheckoutProps = {
  customerEmail: string
  tenantName: string
  currentDomain?: string | null
  domainReady?: boolean
  registrant?: DomainRegistrantDetails | null
  priceLabel: string
  initialExtraFeeLabel?: string | null
  initialTotalPriceLabel?: string | null
  paymentStatus: string
  approvalStatus: string
  previewHref: string
  prewarmHref: string
  suggestionsHref: string
  checkDomainAction: PreviewCheckoutAction
  startPaymentAction: PreviewCheckoutAction
}

const initialState: PreviewCheckoutActionState = {
  ok: false,
  message: "",
}

const initialSuggestionsState: PreviewCheckoutSuggestionsState = {
  ok: false,
  suggestions: [],
  cursor: 0,
  done: false,
}

const emptyRegistrant = (customerEmail: string, registrant?: DomainRegistrantDetails | null): DomainRegistrantDetails => ({
  companyName: registrant?.companyName ?? "",
  firstName: registrant?.firstName ?? "",
  lastName: registrant?.lastName ?? "",
  email: registrant?.email ?? customerEmail,
  street: registrant?.street ?? "",
  number: registrant?.number ?? "",
  suffix: registrant?.suffix ?? "",
  zipcode: registrant?.zipcode ?? "",
  city: registrant?.city ?? "",
  country: registrant?.country ?? "NL",
  state: registrant?.state ?? "",
  phoneCountryCode: registrant?.phoneCountryCode ?? "+31",
  phoneAreaCode: registrant?.phoneAreaCode ?? "",
  phoneSubscriberNumber: registrant?.phoneSubscriberNumber ?? "",
  locale: registrant?.locale ?? "nl_NL",
})

const requiredRegistrantKeys: Array<keyof DomainRegistrantDetails> = [
  "firstName",
  "lastName",
  "email",
  "street",
  "number",
  "zipcode",
  "city",
  "country",
  "phoneCountryCode",
  "phoneAreaCode",
  "phoneSubscriberNumber",
]

const registrantIsComplete = (holder: DomainRegistrantDetails): boolean =>
  requiredRegistrantKeys.every((key) => String(holder[key] ?? "").trim().length > 0)

const placeholderSuggestionsForDomain = (domain: string): PreviewCheckoutDomainOption[] => {
  return previewDomainCandidates(domain)
    .slice(0, 5)
    .map((candidate) => ({
      domain: candidate,
      included: true,
      extraFeeAmount: null,
      extraFeeCurrency: null,
    }))
}

export function PreviewCheckout({
  customerEmail,
  currentDomain,
  domainReady = false,
  registrant,
  priceLabel,
  initialTotalPriceLabel,
  paymentStatus,
  previewHref,
  prewarmHref,
  suggestionsHref,
  checkDomainAction,
  startPaymentAction,
}: PreviewCheckoutProps) {
  const t = useTranslations("preview")
  const [step, setStep] = React.useState<CheckoutStep>("domain")
  const [checkState, checkAction, checkPending] = useActionState(
    checkDomainAction,
    initialState,
  )
  const [paymentState, paymentAction, paymentPending] = useActionState(
    startPaymentAction,
    initialState,
  )
  const [suggestionsState, setSuggestionsState] = React.useState<PreviewCheckoutSuggestionsState>(initialSuggestionsState)
  const [suggestionsPending, setSuggestionsPending] = React.useState(false)
  const [domainValue, setDomainValue] = React.useState(currentDomain ?? "")
  const [checkedDomain, setCheckedDomain] = React.useState<string | null>(domainReady ? (currentDomain ?? null) : null)
  const [holder, setHolder] = React.useState(() => emptyRegistrant(customerEmail, registrant))
  const domainFormRef = React.useRef<HTMLFormElement | null>(null)
  const lastSubmittedDomainRef = React.useRef<string | null>(domainReady ? (currentDomain ?? null) : null)
  const suggestionsAbortRef = React.useRef<AbortController | null>(null)
  const lastSuggestionsRequestKeyRef = React.useRef<string | null>(null)
  const normalizedDomainValue = domainValue.trim().toLowerCase()
  const checkAppliesToCurrentInput = Boolean(checkState.domain && checkState.domain === normalizedDomainValue)
  const suggestionsApplyToCurrentInput = Boolean(suggestionsState.domain && suggestionsState.domain === normalizedDomainValue)
  const domainLooksCheckable = normalizedDomainValue.includes(".") && normalizedDomainValue.length >= 5

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
    if (checkState.ok && checkState.domain && checkState.domain === normalizedDomainValue) {
      setCheckedDomain(checkState.domain)
      setDomainValue(checkState.domain)
    }
  }, [checkState, normalizedDomainValue])

  React.useEffect(() => {
    if (step !== "domain") return
    if (!normalizedDomainValue.includes(".") || normalizedDomainValue.length < 5) return
    if (normalizedDomainValue === checkedDomain || normalizedDomainValue === lastSubmittedDomainRef.current) return

    const timer = window.setTimeout(() => {
      lastSubmittedDomainRef.current = normalizedDomainValue
      domainFormRef.current?.requestSubmit()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [checkedDomain, normalizedDomainValue, step])

  React.useEffect(() => {
    if (paymentState.ok && paymentState.checkoutUrl) {
      window.location.assign(paymentState.checkoutUrl)
    }
  }, [paymentState])

  React.useEffect(() => {
    if (step !== "domain") return
    if (!domainLooksCheckable) return
    const primaryDomainUnavailable = Boolean(
      !checkPending &&
      checkAppliesToCurrentInput &&
      !checkState.ok &&
      ["unavailable", "premium"].includes(checkState.status ?? ""),
    )
    if (!primaryDomainUnavailable) return
    if (
      suggestionsApplyToCurrentInput &&
      (suggestionsState.done || (suggestionsState.suggestions?.length ?? 0) >= 5)
    ) return

    const existing = suggestionsApplyToCurrentInput ? suggestionsState.suggestions ?? [] : []
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
            const previousSuggestions = previousState.domain === normalizedDomainValue
              ? previousState.suggestions ?? []
              : []
            const nextSuggestions = nextState.domain === normalizedDomainValue
              ? nextState.suggestions ?? []
              : []
            const merged = [
              ...previousSuggestions,
              ...nextSuggestions.filter((suggestion) => !previousSuggestions.some((existingSuggestion) => existingSuggestion.domain === suggestion.domain)),
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
            suggestions: previousState.domain === normalizedDomainValue ? previousState.suggestions ?? [] : [],
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
    step,
    suggestionsApplyToCurrentInput,
    suggestionsHref,
    suggestionsPending,
    suggestionsState.done,
    suggestionsState.suggestions,
    suggestionsState.cursor,
  ])

  const selectedDomain = checkedDomain && checkedDomain === domainValue ? checkedDomain : null
  const primaryDomainAvailable = Boolean(!checkPending && checkAppliesToCurrentInput && checkState.ok)
  const primaryDomainUnavailable = Boolean(
    !checkPending &&
    checkAppliesToCurrentInput &&
    !checkState.ok &&
    ["unavailable", "premium"].includes(checkState.status ?? ""),
  )
  const suggestions = primaryDomainUnavailable && suggestionsApplyToCurrentInput ? suggestionsState.suggestions : []
  const placeholderSuggestions = primaryDomainUnavailable && domainLooksCheckable
    ? placeholderSuggestionsForDomain(normalizedDomainValue)
      .filter((option) => !(suggestions ?? []).some((suggestion) => suggestion.domain === option.domain))
      .slice(0, Math.max(0, 5 - (suggestions?.length ?? 0)))
    : []
  const showSuggestions = step === "domain" && domainLooksCheckable && primaryDomainUnavailable && (
    suggestionsPending || suggestionsApplyToCurrentInput || (suggestions?.length ?? 0) > 0 || placeholderSuggestions.length > 0
  )
  const holderComplete = registrantIsComplete(holder)
  const canContinueFromDomain = Boolean(
    selectedDomain && (checkState.ok || (domainReady && selectedDomain === currentDomain)),
  )
  const totalPriceLabel = checkState.totalPriceLabel || initialTotalPriceLabel || priceLabel
  const domainIsReady = Boolean(selectedDomain && (
    (checkState.ok && checkAppliesToCurrentInput)
    || (domainReady && selectedDomain === currentDomain)
  ))
  const domainResultKind = checkPending
    ? "loading"
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

  const updateDomain = (value: string) => {
    suggestionsAbortRef.current?.abort()
    suggestionsAbortRef.current = null
    lastSuggestionsRequestKeyRef.current = null
    setSuggestionsPending(false)
    setDomainValue(value)
    if (value !== checkedDomain) {
      setCheckedDomain(null)
      if (step !== "domain") setStep("domain")
    }
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

  const goBack = () => {
    if (step === "payment") {
      setStep("domain")
    }
  }

  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground md:pb-6">
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

      <div className="mx-auto grid w-full max-w-4xl gap-4 p-3 md:p-4">
        <section className="grid gap-4">
          <CheckoutStepper step={step} />

          {step === "domain" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl">{t("checkoutDomainTitle")}</CardTitle>
                <CardDescription className="text-base">{t("checkoutDomainStepDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <form id="checkout-domain-form" ref={domainFormRef} action={checkAction} className="grid gap-3">
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
                      aria-invalid={domainInputState === "error" || domainInputState === "warning"}
                      aria-describedby={domainInputState === "warning" ? "checkout-domain-unavailable" : undefined}
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
                  {domainInputState === "warning" && (
                    <p id="checkout-domain-unavailable" className="text-sm font-medium text-warning">
                      {t("checkoutDomainUnavailableTitle")}
                    </p>
                  )}
                </form>

                {domainResultKind === "error" && (
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutDomainErrorTitle")}</AlertTitle>
                    <AlertDescription>{checkState.message}</AlertDescription>
                  </Alert>
                )}

                {showSuggestions && (
                  <DomainSuggestions
                    loading={suggestionsPending}
                    suggestions={suggestions}
                    placeholders={suggestionsPending || !suggestionsApplyToCurrentInput ? placeholderSuggestions : []}
                    selectedDomain={null}
                    onSelect={selectSuggestedDomain}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {step === "payment" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl">{t("checkoutPaymentTitle")}</CardTitle>
                <CardDescription className="text-base">{t("checkoutPaymentStepDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 rounded-md border p-4 text-base">
                  <ReviewRow label={t("checkoutSummaryDomain")} value={selectedDomain ?? domainValue} />
                  <ReviewRow label={t("checkoutRegistrantTitle")} value={formatDomainHolderName(holder, t)} />
                  <ReviewRow label={t("checkoutSummaryTotal")} value={totalPriceLabel} />
                </div>
                <form id="checkout-payment-form" action={paymentAction} className="hidden">
                  <CheckoutHiddenInputs domain={selectedDomain ?? domainValue} holder={holder} />
                </form>
                {paymentState.message && (
                  <Alert variant={paymentState.ok || paymentState.status === "payment_complete" ? "default" : "destructive"}>
                    <AlertTitle>{paymentAlertTitle(paymentState, t)}</AlertTitle>
                    <AlertDescription>{paymentState.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </section>

      </div>
      <CheckoutActionBar
        step={step}
        canContinueFromDomain={canContinueFromDomain}
        holderComplete={holderComplete}
        selectedDomain={selectedDomain}
        checkPending={checkPending}
        paymentPending={paymentPending}
        domainResultKind={domainResultKind}
        paymentStatus={paymentStatus}
        totalPriceLabel={totalPriceLabel}
        previewHref={previewHref}
        onBack={goBack}
        onNext={() => setStep("payment")}
        t={t}
      />
    </main>
  )
}

function CheckoutStepper({ step }: { step: CheckoutStep }) {
  const t = useTranslations("preview")
  const steps: Array<{ id: CheckoutStep; label: string; icon: React.ElementType }> = [
    { id: "domain", label: t("checkoutStepDomain"), icon: Globe2 },
    { id: "payment", label: t("checkoutStepPayment"), icon: CreditCard },
  ]
  const activeIndex = steps.findIndex((entry) => entry.id === step)
  return (
    <ol className="grid grid-cols-2 rounded-full border bg-background p-1">
      {steps.map((entry, index) => {
        const Icon = entry.icon
        const active = index === activeIndex
        const complete = index < activeIndex
        return (
          <li
            key={entry.id}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground",
              (active || complete) && "bg-primary text-primary-foreground",
              complete && index + 1 === activeIndex && "rounded-r-none",
              active && index > 0 && "rounded-l-none",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{entry.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function CheckoutActionBar({
  step,
  canContinueFromDomain,
  holderComplete,
  selectedDomain,
  checkPending,
  paymentPending,
  domainResultKind,
  paymentStatus,
  totalPriceLabel,
  previewHref,
  onBack,
  onNext,
  t,
}: {
  step: CheckoutStep
  canContinueFromDomain: boolean
  holderComplete: boolean
  selectedDomain: string | null
  checkPending: boolean
  paymentPending: boolean
  domainResultKind: "loading" | "success" | "unavailable" | "error" | null
  paymentStatus: string
  totalPriceLabel: string
  previewHref: string
  onBack: () => void
  onNext: () => void
  t: ReturnType<typeof useTranslations<"preview">>
}) {
  const secondary = step === "domain"
    ? (
        <Button asChild variant="outline" className="w-11 px-0 md:w-auto md:px-4" aria-label={t("checkoutBackToPreview")}>
          <a href={previewHref}>
            <X className="size-4 md:hidden" aria-hidden />
            <ArrowLeft className="hidden size-4 md:block" aria-hidden />
            <span className="hidden md:inline">{t("checkoutBackToPreview")}</span>
          </a>
        </Button>
      )
    : (
        <Button type="button" variant="outline" className="w-11 px-0 md:w-auto md:px-4" aria-label={t("checkoutBack")} onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden md:inline">{t("checkoutBack")}</span>
        </Button>
      )

  let primary: React.ReactNode
  if (step === "domain" && canContinueFromDomain) {
    primary = (
      <Button type="button" variant="success" className="min-w-0 flex-1 md:flex-none" onClick={onNext}>
        <CheckCircle2 className="size-4" aria-hidden />
        {t("checkoutNext")}
      </Button>
    )
  } else if (step === "domain") {
    const unavailable = domainResultKind === "unavailable"
    primary = (
      <Button
        form="checkout-domain-form"
        type="submit"
        variant={unavailable ? "ghost" : "default"}
        className={cn(
          "min-w-0 flex-1 md:flex-none",
          unavailable && "text-muted-foreground",
        )}
        disabled={checkPending || unavailable}
      >
        {checkPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
        {checkPending
          ? t("checkoutDomainCheckingShort")
          : unavailable
            ? t("checkoutDomainOccupied")
            : domainResultKind === "error"
              ? t("checkoutCheckAgain")
              : t("checkoutCheckDomain")}
      </Button>
    )
  } else {
    const complete = paymentStatus === "completed"
    primary = (
      <Button
        form="checkout-payment-form"
        type="submit"
        variant="success"
        className="min-w-0 flex-1 md:flex-none"
        disabled={paymentPending || !holderComplete || !selectedDomain || complete}
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
        <span className="break-all text-sm font-medium text-foreground">{option.domain}</span>
        {!option.included && option.extraFeeLabel && (
          <span className="text-xs text-muted-foreground">
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
        variant="outline"
        className={cn(
          "h-auto w-full justify-between whitespace-normal border-success bg-success/5 p-3 text-left ring-1 ring-success/30 hover:bg-success/10 focus-visible:ring-success/40",
          selected && "bg-success/10 ring-success/50",
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
        "flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3",
        selected && "border-success bg-success/5 ring-1 ring-success/30",
        checking && "border-dashed text-muted-foreground",
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
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
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
          <DomainOptionRow
            key={`checking-${option.domain}`}
            option={option}
            checking
          />
        ))}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="break-words text-base font-medium">{value || "-"}</div>
      </div>
    </div>
  )
}

function paymentAlertTitle(state: PreviewCheckoutActionState, t: ReturnType<typeof useTranslations<"preview">>): string {
  if (state.ok) return t("checkoutPaymentStartingTitle")
  if (state.status === "payment_complete") return t("checkoutPaymentCompleteTitle")
  return t("checkoutPaymentErrorTitle")
}

function formatDomainHolderName(holder: DomainRegistrantDetails, t: ReturnType<typeof useTranslations<"preview">>): string {
  const name = [holder.firstName, holder.lastName].filter(Boolean).join(" ").trim()
  return name || holder.companyName || t("checkoutDetailsMissing")
}

function CheckoutHiddenInputs({ domain, holder }: { domain: string; holder: DomainRegistrantDetails }) {
  return (
    <>
      <input type="hidden" name="domain" value={domain} />
      <input type="hidden" name="companyName" value={holder.companyName ?? ""} />
      <input type="hidden" name="registrantEmail" value={holder.email} />
      <input type="hidden" name="firstName" value={holder.firstName} />
      <input type="hidden" name="lastName" value={holder.lastName} />
      <input type="hidden" name="street" value={holder.street} />
      <input type="hidden" name="number" value={holder.number} />
      <input type="hidden" name="suffix" value={holder.suffix ?? ""} />
      <input type="hidden" name="zipcode" value={holder.zipcode} />
      <input type="hidden" name="city" value={holder.city} />
      <input type="hidden" name="country" value={holder.country} />
      <input type="hidden" name="state" value={holder.state ?? ""} />
      <input type="hidden" name="phoneCountryCode" value={holder.phoneCountryCode} />
      <input type="hidden" name="phoneAreaCode" value={holder.phoneAreaCode} />
      <input type="hidden" name="phoneSubscriberNumber" value={holder.phoneSubscriberNumber} />
    </>
  )
}
