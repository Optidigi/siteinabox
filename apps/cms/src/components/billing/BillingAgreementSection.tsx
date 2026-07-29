import { CalendarClock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"

import {
  cancelBillingAgreementAction,
  recoverBillingAgreementAction,
} from "@/app/(frontend)/(admin)/settings/actions"

export type BillingAgreementView = {
  id: string
  state: string
  billingPeriod: "monthly" | "annual"
  currentPeriodEndsAt?: string | null
  nextChargeAt?: string | null
  cancelAt?: string | null
  serviceSuspensionStatus?: string | null
  failureReason?: string | null
}

const formatDate = (value: string, locale: string) => new Intl.DateTimeFormat(locale, {
  dateStyle: "long",
}).format(new Date(value))

export function BillingAgreementSection({
  agreement,
  locale,
  result,
}: {
  agreement: BillingAgreementView | null
  locale: string
  result?: string
}) {
  const english = locale.startsWith("en")
  if (!agreement) return null
  const cancellationScheduled = agreement.state === "cancellation_scheduled"
  const cancelled = agreement.state === "cancelled"
  const canCancel = ["active", "past_due", "suspended"].includes(agreement.state)
  const hasRecoverableFailure =
    agreement.failureReason?.startsWith("Mollie mandate status is ") === true ||
    agreement.failureReason?.startsWith("Mollie payment state is ") === true
  const canRecover = ["past_due", "suspended", "cancellation_scheduled"].includes(
    agreement.state,
  ) && (
    agreement.serviceSuspensionStatus === "billing_suspended" ||
    hasRecoverableFailure
  )
  const periodLabel = agreement.billingPeriod === "annual"
    ? english ? "Annual" : "Jaarlijks"
    : english ? "Monthly" : "Maandelijks"
  return (
    <Card id="billing" className="w-full max-w-3xl scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CalendarClock className="size-5" />
          {english ? "Subscription" : "Abonnement"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Your billing period, renewal status, and cancellation at the end of the paid period."
            : "Je betaalperiode, verlengingsstatus en opzegging aan het einde van de betaalde periode."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {result === "cancelled" && (
          <Alert>
            <AlertTitle>{english ? "Cancellation scheduled" : "Opzegging ingepland"}</AlertTitle>
            <AlertDescription>
              {english
                ? "The subscription remains active through the paid period."
                : "Het abonnement blijft actief tot het einde van de betaalde periode."}
            </AlertDescription>
          </Alert>
        )}
        {result === "failed" && (
          <Alert variant="destructive">
            <AlertTitle>{english ? "Cancellation failed" : "Opzegging mislukt"}</AlertTitle>
            <AlertDescription>
              {english ? "Please try again or contact support." : "Probeer het opnieuw of neem contact op."}
            </AlertDescription>
          </Alert>
        )}
        {result === "recovery-failed" && (
          <Alert variant="destructive">
            <AlertTitle>
              {english ? "Payment recovery could not start" : "Betalingsherstel kon niet starten"}
            </AlertTitle>
            <AlertDescription>
              {english
                ? "No new payment was created. Refresh the page and try again."
                : "Er is geen nieuwe betaling aangemaakt. Vernieuw de pagina en probeer opnieuw."}
            </AlertDescription>
          </Alert>
        )}
        {result === "return" && (
          <Alert>
            <AlertTitle>{english ? "Payment is being verified" : "Betaling wordt gecontroleerd"}</AlertTitle>
            <AlertDescription>
              {english
                ? "Service is restored automatically after Mollie confirms the payment and replacement mandate."
                : "De dienst wordt automatisch hersteld zodra Mollie de betaling en de nieuwe machtiging bevestigt."}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
          <div className="grid gap-1">
            <p className="font-medium">{periodLabel}</p>
            {agreement.currentPeriodEndsAt && (
              <p className="text-sm text-muted-foreground">
                {english ? "Paid through" : "Betaald tot en met"}{" "}
                {formatDate(agreement.currentPeriodEndsAt, locale)}
              </p>
            )}
            {cancellationScheduled && agreement.cancelAt && (
              <p className="text-sm text-muted-foreground">
                {english ? "Ends on" : "Eindigt op"} {formatDate(agreement.cancelAt, locale)}
              </p>
            )}
          </div>
          <Badge variant="outline">{agreement.state}</Badge>
        </div>
        {canRecover && (
          <form action={recoverBillingAgreementAction} className="grid gap-3 border-t pt-4">
            <input type="hidden" name="billingAgreementId" value={agreement.id} />
            <p className="text-sm text-muted-foreground">
              {english
                ? "Complete the outstanding frozen payment in Mollie to replace the payment mandate. Domain ownership and DNS remain unchanged."
                : "Voldoe de openstaande, vastgelegde betaling in Mollie om de betaalmachtiging te vervangen. Domeineigendom en DNS blijven ongewijzigd."}
            </p>
            <Button type="submit" className="w-fit">
              {english ? "Restore payment and service" : "Betaling en dienst herstellen"}
            </Button>
          </form>
        )}
        {canCancel && (
          <form action={cancelBillingAgreementAction} className="grid gap-3 border-t pt-4">
            <input type="hidden" name="billingAgreementId" value={agreement.id} />
            <p className="text-sm text-muted-foreground">
              {english
                ? "Cancellation stops future uncovered billing and domain renewals. Paid or provider-committed domain cycles are completed."
                : "Opzegging stopt toekomstige niet-gedekte betalingen en domeinverlengingen. Betaalde of bij de provider vastgelegde domeincycli worden afgerond."}
            </p>
            <Button type="submit" variant="outline" className="w-fit">
              {english ? "Cancel at period end" : "Opzeggen aan einde betaalperiode"}
            </Button>
          </form>
        )}
        {cancelled && (
          <p className="text-sm text-muted-foreground">
            {english
              ? "The subscription has ended. The customer-owned domain remains with the customer."
              : "Het abonnement is beëindigd. Het klantdomein blijft eigendom van de klant."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
