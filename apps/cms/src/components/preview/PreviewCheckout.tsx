"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  ChevronLeft,
  CircleAlert,
  CheckCircle2,
  CreditCard,
  Globe2,
  Loader2,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Separator } from "@siteinabox/ui/components/separator"
import { cn } from "@siteinabox/ui/lib/utils"
import type { DomainRegistrantDetails } from "@/lib/domains/orderState"

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
  status?: "idle" | "available" | "available_extra" | "unavailable" | "premium" | "too_expensive" | "invalid" | "service_error" | "payment_error" | "payment_complete" | "redirecting"
  checkoutUrl?: string
  domain?: string
  included?: boolean
  extraFeeAmount?: string | null
  extraFeeCurrency?: string | null
  extraFeeLabel?: string | null
  totalPriceLabel?: string | null
  suggestions?: PreviewCheckoutDomainOption[]
}

type PreviewCheckoutAction = (
  previousState: PreviewCheckoutActionState,
  formData: FormData,
) => Promise<PreviewCheckoutActionState>

type CheckoutStep = "domain" | "details" | "payment"

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
  checkDomainAction: PreviewCheckoutAction
  startPaymentAction: PreviewCheckoutAction
}

const initialState: PreviewCheckoutActionState = {
  ok: false,
  message: "",
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

export function PreviewCheckout({
  customerEmail,
  tenantName,
  currentDomain,
  domainReady = false,
  registrant,
  priceLabel,
  initialTotalPriceLabel,
  paymentStatus,
  previewHref,
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
  const [domainValue, setDomainValue] = React.useState(currentDomain ?? "")
  const [checkedDomain, setCheckedDomain] = React.useState<string | null>(domainReady ? (currentDomain ?? null) : null)
  const [selectedSuggestion, setSelectedSuggestion] = React.useState<PreviewCheckoutDomainOption | null>(null)
  const [holder, setHolder] = React.useState(() => emptyRegistrant(customerEmail, registrant))
  const [detailsEditing, setDetailsEditing] = React.useState(() => !registrant || !registrantIsComplete(emptyRegistrant(customerEmail, registrant)))
  const normalizedDomainValue = domainValue.trim().toLowerCase()
  const checkAppliesToCurrentInput = Boolean(checkState.domain && checkState.domain === normalizedDomainValue)

  React.useEffect(() => {
    if (checkState.ok && checkState.domain) {
      setCheckedDomain(checkState.domain)
      setDomainValue(checkState.domain)
      setSelectedSuggestion(null)
    }
  }, [checkState])

  React.useEffect(() => {
    if (paymentState.ok && paymentState.checkoutUrl) {
      window.location.assign(paymentState.checkoutUrl)
    }
  }, [paymentState])

  const selectedDomain = checkedDomain && checkedDomain === domainValue ? checkedDomain : null
  const holderComplete = registrantIsComplete(holder)
  const canContinueFromDomain = Boolean(
    selectedDomain && (checkState.ok || (domainReady && selectedDomain === currentDomain)),
  )
  const totalPriceLabel = !selectedSuggestion
    ? checkState.totalPriceLabel || initialTotalPriceLabel || priceLabel
    : initialTotalPriceLabel || priceLabel
  const domainResultKind = checkPending
    ? "loading"
    : checkState.message && checkAppliesToCurrentInput
      ? checkState.ok
        ? "success"
        : ["unavailable", "premium", "too_expensive"].includes(checkState.status ?? "")
          ? "unavailable"
          : "error"
      : null
  const domainInputState = domainResultKind === "success"
    ? "success"
    : domainResultKind === "unavailable" || domainResultKind === "error"
      ? "error"
      : null

  const updateHolder = (key: keyof DomainRegistrantDetails, value: string) => {
    setHolder((current) => ({ ...current, [key]: value }))
  }

  const updateDomain = (value: string) => {
    setDomainValue(value)
    setSelectedSuggestion(null)
    if (value !== checkedDomain) {
      setCheckedDomain(null)
      if (step !== "domain") setStep("domain")
    }
  }

  const selectSuggestedDomain = (option: PreviewCheckoutDomainOption) => {
    setDomainValue(option.domain)
    setSelectedSuggestion(option)
    if (checkedDomain !== option.domain) {
      setCheckedDomain(null)
    }
  }

  const goBack = () => {
    if (step === "payment") {
      setStep("details")
      return
    }
    if (step === "details") {
      setStep("domain")
    }
  }

  return (
    <main className="min-h-dvh bg-background pb-28 text-foreground md:pb-6">
      <header data-siab-cms-sticky-chrome className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-3 px-3 py-2 md:min-h-12 md:px-4">
          <a href={previewHref} className="flex min-w-0 items-center gap-2">
            <img src="/logos/logo-light.svg" alt="Site in a Box" className="h-7 w-auto dark:hidden" />
            <img src="/logos/logo-dark.svg" alt="Site in a Box" className="hidden h-7 w-auto dark:block" />
          </a>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-foreground">{t("checkoutTitle")}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {t("checkoutDescription", { site: tenantName })}
            </p>
          </div>
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            <ShieldCheck className="size-3" aria-hidden />
            {t("checkoutSecureBadge")}
          </Badge>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={previewHref}>
              <ArrowLeft className="size-4" aria-hidden />
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
                <CardTitle>{t("checkoutDomainTitle")}</CardTitle>
                <CardDescription>{t("checkoutDomainStepDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <form id="checkout-domain-form" action={checkAction} className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="checkout-domain">{t("checkoutDomainLabel")}</Label>
                    <Input
                      id="checkout-domain"
                      name="domain"
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      value={domainValue}
                      onChange={(event) => updateDomain(event.target.value)}
                      placeholder={t("checkoutDomainPlaceholder")}
                      aria-invalid={domainInputState === "error"}
                      className={cn(
                        domainInputState === "success" && "border-primary",
                        domainInputState === "error" && "border-destructive",
                      )}
                      required
                    />
                  </div>
                </form>

                {domainResultKind === "success" && selectedDomain && (
                  <DomainOptionRow
                    option={{
                      domain: selectedDomain,
                      included: Boolean(checkState.included),
                      extraFeeAmount: checkState.extraFeeAmount ?? null,
                      extraFeeCurrency: checkState.extraFeeCurrency ?? null,
                      extraFeeLabel: checkState.extraFeeLabel,
                    }}
                    selected
                  />
                )}

                {domainResultKind === "error" && (
                  <Alert variant="destructive">
                    <CircleAlert className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutDomainErrorTitle")}</AlertTitle>
                    <AlertDescription>{checkState.message}</AlertDescription>
                  </Alert>
                )}

                {checkAppliesToCurrentInput && (
                  <DomainSuggestions
                    suggestions={checkState.suggestions}
                    selectedDomain={selectedSuggestion?.domain ?? null}
                    onSelect={selectSuggestedDomain}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {step === "details" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("checkoutDetailsTitle")}</CardTitle>
                <CardDescription>{t("checkoutDetailsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-3 rounded-md border p-4 text-sm">
                  <ReviewRow label={t("checkoutSummaryDomain")} value={selectedDomain ?? domainValue} onEdit={() => setStep("domain")} />
                  <ReviewRow
                    label={t("checkoutRegistrantTitle")}
                    value={formatRegistrantSummary(holder, t)}
                    onEdit={() => setDetailsEditing(true)}
                  />
                  <ReviewRow
                    label={t("checkoutRegistrantAddress")}
                    value={formatAddressSummary(holder, t)}
                    onEdit={() => setDetailsEditing(true)}
                  />
                </div>
                {detailsEditing ? (
                  <div className="grid gap-4">
                    <DomainHolderFields holder={holder} onChange={updateHolder} />
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" disabled={!holderComplete} onClick={() => setDetailsEditing(false)}>
                        <CheckCircle2 className="size-4" aria-hidden />
                        {t("checkoutDetailsComplete")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle2 className="size-4" aria-hidden />
                    <AlertTitle>{t("checkoutDetailsOverviewTitle")}</AlertTitle>
                    <AlertDescription>{t("checkoutDetailsOverviewDescription")}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {step === "payment" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("checkoutPaymentTitle")}</CardTitle>
                <CardDescription>{t("checkoutPaymentStepDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 rounded-md border p-4 text-sm">
                  <ReviewRow label={t("checkoutSummaryDomain")} value={selectedDomain ?? domainValue} onEdit={() => setStep("domain")} />
                  <ReviewRow label={t("checkoutRegistrantTitle")} value={holder.companyName || `${holder.firstName} ${holder.lastName}`.trim()} onEdit={() => setStep("details")} />
                  <ReviewRow label={t("checkoutSummaryTotal")} value={totalPriceLabel} />
                </div>
                <Alert>
                  <ShieldCheck className="size-4" aria-hidden />
                  <AlertTitle>{t("checkoutRenewalTitle")}</AlertTitle>
                  <AlertDescription>{t("checkoutDomainSubmitDescription")}</AlertDescription>
                </Alert>
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
        priceLabel={totalPriceLabel}
        canContinueFromDomain={canContinueFromDomain}
        holderComplete={holderComplete}
        selectedDomain={selectedDomain}
        checkPending={checkPending}
        paymentPending={paymentPending}
        domainResultKind={domainResultKind}
        paymentStatus={paymentStatus}
        previewHref={previewHref}
        onBack={goBack}
        onNext={() => setStep(step === "domain" ? "details" : "payment")}
        t={t}
      />
    </main>
  )
}

function CheckoutStepper({ step }: { step: CheckoutStep }) {
  const t = useTranslations("preview")
  const steps: Array<{ id: CheckoutStep; label: string; icon: React.ElementType }> = [
    { id: "domain", label: t("checkoutStepDomain"), icon: Globe2 },
    { id: "details", label: t("checkoutStepDetails"), icon: UserRound },
    { id: "payment", label: t("checkoutStepPayment"), icon: CreditCard },
  ]
  const activeIndex = steps.findIndex((entry) => entry.id === step)
  return (
    <ol className="grid grid-cols-3 gap-2 rounded-full border bg-background p-1">
      {steps.map((entry, index) => {
        const Icon = entry.icon
        const active = index === activeIndex
        const complete = index < activeIndex
        return (
          <li
            key={entry.id}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground",
              active && "bg-primary text-primary-foreground",
              complete && "text-primary",
            )}
          >
            {complete ? <CheckCircle2 className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{entry.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function CheckoutActionBar({
  step,
  priceLabel,
  canContinueFromDomain,
  holderComplete,
  selectedDomain,
  checkPending,
  paymentPending,
  domainResultKind,
  paymentStatus,
  previewHref,
  onBack,
  onNext,
  t,
}: {
  step: CheckoutStep
  priceLabel: string
  canContinueFromDomain: boolean
  holderComplete: boolean
  selectedDomain: string | null
  checkPending: boolean
  paymentPending: boolean
  domainResultKind: "loading" | "success" | "unavailable" | "error" | null
  paymentStatus: string
  previewHref: string
  onBack: () => void
  onNext: () => void
  t: ReturnType<typeof useTranslations<"preview">>
}) {
  const priceBadge = (
    <Badge variant="outline" className="h-9 rounded-md px-3">
      {t("checkoutTotalBadge", { total: priceLabel })}
    </Badge>
  )

  const secondary = step === "domain"
    ? (
        <Button asChild variant="outline" size="icon" aria-label={t("checkoutBackToPreview")}>
          <a href={previewHref}>
            <ChevronLeft className="size-4" aria-hidden />
          </a>
        </Button>
      )
    : (
        <Button type="button" variant="outline" size="icon" aria-label={t("checkoutBack")} onClick={onBack}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      )

  let primary: React.ReactNode
  if (step === "domain" && canContinueFromDomain) {
    primary = (
      <Button type="button" className="min-w-0 flex-1" onClick={onNext}>
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
        variant={unavailable ? "destructive" : "default"}
        className="min-w-0 flex-1"
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
  } else if (step === "details") {
    primary = (
      <Button type="button" className="min-w-0 flex-1" disabled={!holderComplete || !selectedDomain} onClick={onNext}>
        {t("checkoutNext")}
      </Button>
    )
  } else {
    const complete = paymentStatus === "completed"
    primary = (
      <Button
        form="checkout-payment-form"
        type="submit"
        className="min-w-0 flex-1"
        disabled={paymentPending || !holderComplete || !selectedDomain || complete}
      >
        {paymentPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
        {complete ? t("paymentCompleted") : t("checkoutStartPayment")}
      </Button>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-lg backdrop-blur md:static md:mx-auto md:mt-2 md:w-full md:max-w-4xl md:rounded-md md:border md:bg-card md:shadow-none">
      <div className="flex items-center gap-2">
        {priceBadge}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  )
}

function DomainOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: PreviewCheckoutDomainOption
  selected?: boolean
  onSelect?: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  const content = (
    <>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="break-all text-sm font-medium text-foreground">{option.domain}</span>
        <span className="text-xs text-muted-foreground">
          {option.included || !option.extraFeeLabel
            ? t("checkoutDomainIncluded")
            : t("checkoutDomainExtraFeeInline", { extraFee: option.extraFeeLabel })}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Badge variant={option.included ? "success" : "secondary"}>
          {option.included ? t("checkoutDomainIncludedBadge") : t("checkoutDomainExtraFeeBadge")}
        </Badge>
        {selected && (
          <span className="flex size-7 items-center justify-center rounded-full border border-primary text-primary">
            <CheckCircle2 className="size-4" aria-hidden />
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
          "h-auto w-full justify-between whitespace-normal p-3 text-left",
          selected && "border-primary bg-primary/5",
        )}
        aria-pressed={selected}
        onClick={() => onSelect(option)}
      >
        {content}
      </Button>
    )
  }
  return (
    <div className={cn("flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3", selected && "border-primary bg-primary/5")}>
      {content}
    </div>
  )
}

function DomainSuggestions({
  suggestions,
  selectedDomain,
  onSelect,
}: {
  suggestions?: PreviewCheckoutDomainOption[]
  selectedDomain: string | null
  onSelect: (option: PreviewCheckoutDomainOption) => void
}) {
  const t = useTranslations("preview")
  if (!suggestions?.length) return null
  const visibleSuggestions = suggestions.slice(0, 5)
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium text-foreground">{t("checkoutDomainSuggestionsTitle")}</div>
      <div className="grid gap-2">
        {visibleSuggestions.map((option) => (
          <DomainOptionRow
            key={option.domain}
            option={option}
            selected={selectedDomain === option.domain}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  const t = useTranslations("preview")
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-words text-sm font-medium">{value || "-"}</div>
      </div>
      {onEdit && (
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          {t("checkoutEdit")}
        </Button>
      )}
    </div>
  )
}

function paymentAlertTitle(state: PreviewCheckoutActionState, t: ReturnType<typeof useTranslations<"preview">>): string {
  if (state.ok) return t("checkoutPaymentStartingTitle")
  if (state.status === "payment_complete") return t("checkoutPaymentCompleteTitle")
  return t("checkoutPaymentErrorTitle")
}

function formatRegistrantSummary(holder: DomainRegistrantDetails, t: ReturnType<typeof useTranslations<"preview">>): string {
  const name = [holder.firstName, holder.lastName].filter(Boolean).join(" ").trim()
  return [holder.companyName, name, holder.email].filter(Boolean).join(" / ") || t("checkoutDetailsMissing")
}

function formatAddressSummary(holder: DomainRegistrantDetails, t: ReturnType<typeof useTranslations<"preview">>): string {
  const street = [holder.street, holder.number, holder.suffix].filter(Boolean).join(" ").trim()
  const city = [holder.zipcode, holder.city].filter(Boolean).join(" ").trim()
  const phone = [holder.phoneCountryCode, holder.phoneAreaCode, holder.phoneSubscriberNumber].filter(Boolean).join(" ").trim()
  return [street, city, holder.country, phone].filter(Boolean).join(" / ") || t("checkoutDetailsMissing")
}

function DomainHolderFields({
  holder,
  onChange,
}: {
  holder: DomainRegistrantDetails
  onChange: (key: keyof DomainRegistrantDetails, value: string) => void
}) {
  const t = useTranslations("preview")
  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">{t("checkoutRegistrantTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("checkoutRegistrantDescription")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField id="checkout-company-name" label={t("checkoutCompanyName")} value={holder.companyName ?? ""} autoComplete="organization" onChange={(value) => onChange("companyName", value)} />
        <TextField id="checkout-registrant-email" label={t("checkoutRegistrantEmail")} value={holder.email} type="email" autoComplete="email" required onChange={(value) => onChange("email", value)} />
        <TextField id="checkout-first-name" label={t("checkoutFirstName")} value={holder.firstName} autoComplete="given-name" required onChange={(value) => onChange("firstName", value)} />
        <TextField id="checkout-last-name" label={t("checkoutLastName")} value={holder.lastName} autoComplete="family-name" required onChange={(value) => onChange("lastName", value)} />
        <TextField id="checkout-street" label={t("checkoutStreet")} value={holder.street} autoComplete="address-line1" required onChange={(value) => onChange("street", value)} />
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <TextField id="checkout-number" label={t("checkoutHouseNumber")} value={holder.number} required onChange={(value) => onChange("number", value)} />
          <TextField id="checkout-suffix" label={t("checkoutHouseSuffix")} value={holder.suffix ?? ""} onChange={(value) => onChange("suffix", value)} />
        </div>
        <TextField id="checkout-zipcode" label={t("checkoutZipcode")} value={holder.zipcode} autoComplete="postal-code" required onChange={(value) => onChange("zipcode", value)} />
        <TextField id="checkout-city" label={t("checkoutCity")} value={holder.city} autoComplete="address-level2" required onChange={(value) => onChange("city", value)} />
        <TextField id="checkout-country" label={t("checkoutCountry")} value={holder.country} autoComplete="country" required onChange={(value) => onChange("country", value.toUpperCase())} />
        <TextField id="checkout-state" label={t("checkoutState")} value={holder.state ?? ""} autoComplete="address-level1" onChange={(value) => onChange("state", value)} />
        <div className="grid grid-cols-[5rem_1fr_1fr] gap-3 md:col-span-2">
          <TextField id="checkout-phone-country" label={t("checkoutPhoneCountry")} value={holder.phoneCountryCode} required onChange={(value) => onChange("phoneCountryCode", value)} />
          <TextField id="checkout-phone-area" label={t("checkoutPhoneArea")} value={holder.phoneAreaCode} inputMode="tel" required onChange={(value) => onChange("phoneAreaCode", value)} />
          <TextField id="checkout-phone-number" label={t("checkoutPhoneNumber")} value={holder.phoneSubscriberNumber} inputMode="tel" required onChange={(value) => onChange("phoneSubscriberNumber", value)} />
        </div>
      </div>
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  required?: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
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
