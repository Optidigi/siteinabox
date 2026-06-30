"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Globe2, Loader2, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"

export type PreviewCheckoutActionState = {
  ok: boolean
  message: string
  checkoutUrl?: string
}

type PreviewCheckoutAction = (
  previousState: PreviewCheckoutActionState,
  formData: FormData,
) => Promise<PreviewCheckoutActionState>

type PreviewCheckoutProps = {
  customerEmail: string
  tenantName: string
  currentDomain?: string | null
  priceLabel: string
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

export function PreviewCheckout({
  customerEmail,
  tenantName,
  currentDomain,
  priceLabel,
  paymentStatus,
  approvalStatus,
  previewHref,
  checkDomainAction,
  startPaymentAction,
}: PreviewCheckoutProps) {
  const t = useTranslations("preview")
  const [checkState, checkAction, checkPending] = useActionState(
    checkDomainAction,
    initialState,
  )
  const [paymentState, paymentAction, paymentPending] = useActionState(
    startPaymentAction,
    initialState,
  )

  React.useEffect(() => {
    if (paymentState.ok && paymentState.checkoutUrl) {
      window.location.assign(paymentState.checkoutUrl)
    }
  }, [paymentState])

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid gap-6">
          <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-start md:justify-between">
            <div className="grid gap-2">
              <Badge variant="outline" className="w-fit">
                <ShieldCheck className="size-3" aria-hidden />
                {t("checkoutSecureBadge")}
              </Badge>
              <h1 className="text-3xl font-semibold tracking-normal">{t("checkoutTitle")}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("checkoutDescription", { site: tenantName })}
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={previewHref}>{t("checkoutBackToPreview")}</a>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("checkoutDomainTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <form action={checkAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="checkout-domain">{t("checkoutDomainLabel")}</Label>
                  <Input
                    id="checkout-domain"
                    name="domain"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    defaultValue={currentDomain ?? ""}
                    placeholder={t("checkoutDomainPlaceholder")}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" disabled={checkPending}>
                  {checkPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Globe2 className="size-4" aria-hidden />
                  )}
                  {t("checkoutCheckDomain")}
                </Button>
              </form>
              {checkState.message && (
                <Alert variant={checkState.ok ? "default" : "destructive"}>
                  <AlertTitle>{checkState.ok ? t("checkoutDomainCheckTitle") : t("accessUnavailable")}</AlertTitle>
                  <AlertDescription>{checkState.message}</AlertDescription>
                </Alert>
              )}
              <form action={paymentAction} className="grid gap-3 border-t pt-5">
                <div className="grid gap-2">
                  <Label htmlFor="checkout-confirm-domain">{t("checkoutConfirmDomainLabel")}</Label>
                  <Input
                    id="checkout-confirm-domain"
                    name="domain"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    defaultValue={currentDomain ?? ""}
                    placeholder={t("checkoutDomainPlaceholder")}
                    required
                  />
                </div>
                <DomainHolderFields idPrefix="pay" customerEmail={customerEmail} />
                <div className="text-sm text-muted-foreground">{t("checkoutDomainSubmitDescription")}</div>
                <Button type="submit" disabled={paymentPending}>
                  {paymentPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  {t("checkoutStartPayment")}
                </Button>
              </form>
              {paymentState.message && (
                <Alert variant={paymentState.ok ? "default" : "destructive"}>
                  <AlertTitle>{paymentState.ok ? t("checkoutPaymentStartingTitle") : t("accessUnavailable")}</AlertTitle>
                  <AlertDescription>{paymentState.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="grid h-fit gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("checkoutSummaryTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="grid gap-1">
                <div className="text-muted-foreground">{t("checkoutSummaryProduct")}</div>
                <div className="font-medium">{t("checkoutSummaryProductName")}</div>
              </div>
              <div className="grid gap-1">
                <div className="text-muted-foreground">{t("checkoutSummaryCustomer")}</div>
                <div className="break-all font-medium">{customerEmail}</div>
              </div>
              <div className="grid gap-1">
                <div className="text-muted-foreground">{t("checkoutSummaryDomain")}</div>
                <div className="break-all font-medium">{currentDomain || t("checkoutDomainUnset")}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div className="text-muted-foreground">{t("checkoutSummaryApproval")}</div>
                <Badge variant={approvalStatus === "approved" ? "success" : "secondary"}>
                  {approvalStatus === "approved" ? t("approved") : t("pendingApproval")}
                </Badge>
                <div className="text-muted-foreground">{t("checkoutSummaryPayment")}</div>
                <Badge variant={paymentStatus === "completed" ? "success" : "secondary"}>
                  {formatPaymentStatus(paymentStatus, t)}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-t pt-4 text-base">
                <span className="font-medium">{t("checkoutSummaryTotal")}</span>
                <span className="font-semibold">{priceLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("checkoutPaymentDescription")}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

function DomainHolderFields({ idPrefix, customerEmail }: { idPrefix: string; customerEmail: string }) {
  const t = useTranslations("preview")
  const id = (name: string) => `checkout-${idPrefix}-${name}`
  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">{t("checkoutRegistrantTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("checkoutRegistrantDescription")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id("company-name")}>{t("checkoutCompanyName")}</Label>
          <Input id={id("company-name")} name="companyName" type="text" autoComplete="organization" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("registrant-email")}>{t("checkoutRegistrantEmail")}</Label>
          <Input id={id("registrant-email")} name="registrantEmail" type="email" autoComplete="email" defaultValue={customerEmail} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("first-name")}>{t("checkoutFirstName")}</Label>
          <Input id={id("first-name")} name="firstName" type="text" autoComplete="given-name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("last-name")}>{t("checkoutLastName")}</Label>
          <Input id={id("last-name")} name="lastName" type="text" autoComplete="family-name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("street")}>{t("checkoutStreet")}</Label>
          <Input id={id("street")} name="street" type="text" autoComplete="address-line1" required />
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div className="grid gap-2">
            <Label htmlFor={id("number")}>{t("checkoutHouseNumber")}</Label>
            <Input id={id("number")} name="number" type="text" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id("suffix")}>{t("checkoutHouseSuffix")}</Label>
            <Input id={id("suffix")} name="suffix" type="text" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("zipcode")}>{t("checkoutZipcode")}</Label>
          <Input id={id("zipcode")} name="zipcode" type="text" autoComplete="postal-code" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("city")}>{t("checkoutCity")}</Label>
          <Input id={id("city")} name="city" type="text" autoComplete="address-level2" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("country")}>{t("checkoutCountry")}</Label>
          <Input id={id("country")} name="country" type="text" autoComplete="country" defaultValue="NL" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("state")}>{t("checkoutState")}</Label>
          <Input id={id("state")} name="state" type="text" autoComplete="address-level1" />
        </div>
        <div className="grid grid-cols-[5rem_1fr_1fr] gap-3 md:col-span-2">
          <div className="grid gap-2">
            <Label htmlFor={id("phone-country")}>{t("checkoutPhoneCountry")}</Label>
            <Input id={id("phone-country")} name="phoneCountryCode" type="text" defaultValue="+31" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id("phone-area")}>{t("checkoutPhoneArea")}</Label>
            <Input id={id("phone-area")} name="phoneAreaCode" type="text" inputMode="tel" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id("phone-number")}>{t("checkoutPhoneNumber")}</Label>
            <Input id={id("phone-number")} name="phoneSubscriberNumber" type="text" inputMode="tel" required />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatPaymentStatus(status: string, t: ReturnType<typeof useTranslations<"preview">>): string {
  switch (status) {
    case "completed":
      return t("paymentCompleted")
    case "waived":
      return t("paymentWaived")
    case "pending_provider":
      return t("paymentPendingProvider")
    case "not_started":
      return t("paymentNotStarted")
    default:
      return status.replace(/_/g, " ")
  }
}
