import { renderEmailLayout } from "@/lib/email/emailLayout"

export const COMMERCE_NOTIFICATION_TEMPLATE_VERSION = "commerce-2026-07-29.1"

export type CommerceNotificationKind =
  | "payment_received"
  | "domain_verification_required"
  | "site_live_handoff"
  | "upcoming_charge_7d"
  | "payment_failed_0d"
  | "payment_overdue_3d"
  | "payment_overdue_7d"
  | "payment_overdue_13d"
  | "service_suspended_14d"
  | "service_restored"
  | "cancellation_scheduled"
  | "cancellation_effective"
  | "domain_renewal_90d"
  | "domain_renewal_60d"
  | "domain_renewal_30d"
  | "domain_renewal_14d"
  | "domain_renewal_7d"
  | "domain_renewal_admin_7d"
  | "domain_renewal_1d"
  | "domain_renewed"

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

const date = (value: string) => new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "long",
  timeZone: "Europe/Amsterdam",
}).format(new Date(value))

const money = (minor: number | null | undefined, currency = "EUR") =>
  minor == null
    ? "niet beschikbaar"
    : new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency,
      }).format(minor / 100)

const billingCopy = (
  kind: CommerceNotificationKind,
  eventAt: string,
): { subject: string; title: string; message: string } => {
  if (kind === "payment_received") {
    return {
      subject: "Betaling ontvangen voor Site in a Box",
      title: "Betaling ontvangen",
      message: "Je betaling is door Mollie bevestigd. De domeinregistratie en technische controles worden nu automatisch uitgevoerd. Je kunt de voortgang in de checkout volgen.",
    }
  }
  if (kind === "domain_verification_required") {
    return {
      subject: "Actie vereist: verifieer de domeinhouder",
      title: "Domeinhouderverificatie vereist",
      message: `Open de verificatie-e-mail van de registrar en rond de controle af. Zonder deze bevestiging activeren we de website niet. De actuele voortgang staat in de checkout.`,
    }
  }
  if (kind === "upcoming_charge_7d") {
    return {
      subject: "Je volgende Site in a Box-betaling",
      title: "Volgende betaling over 7 dagen",
      message: `Op ${date(eventAt)} starten we de volgende automatische betaling voor je abonnement.`,
    }
  }
  if (kind === "payment_failed_0d") {
    return {
      subject: "Betaling voor Site in a Box mislukt",
      title: "Betaling mislukt",
      message: `De betaling van ${date(eventAt)} is niet gelukt. We proberen deze tijdens de betaaltermijn opnieuw.`,
    }
  }
  if (kind.startsWith("payment_overdue_")) {
    const days = kind === "payment_overdue_3d" ? 3 : kind === "payment_overdue_7d" ? 7 : 13
    return {
      subject: "Herinnering: betaling voor Site in a Box openstaand",
      title: "Betalingsherinnering",
      message: `De betaling staat ${days} dagen open. De website blijft tot en met de betaaltermijn van 14 dagen beschikbaar.`,
    }
  }
  if (kind === "service_suspended_14d") {
    return {
      subject: "Site in a Box tijdelijk opgeschort",
      title: "Dienst tijdelijk opgeschort",
      message: "De betaling staat 14 dagen open. De website is tijdelijk opgeschort; het klantdomein blijft eigendom van de klant.",
    }
  }
  if (kind === "service_restored") {
    return {
      subject: "Site in a Box is hersteld",
      title: "Dienst hersteld",
      message: "De betaling is verwerkt en de website is weer actief.",
    }
  }
  if (kind === "cancellation_scheduled") {
    return {
      subject: "Opzegging van Site in a Box bevestigd",
      title: "Opzegging ingepland",
      message: `Het abonnement eindigt aan het einde van de betaalde periode op ${date(eventAt)}. Reeds betaalde of bij de provider vastgelegde domeinverlengingen worden afgerond.`,
    }
  }
  return {
    subject: "Abonnement van Site in a Box beëindigd",
    title: "Abonnement beëindigd",
    message: `Het abonnement is beëindigd op ${date(eventAt)}. Het klantdomein blijft eigendom van de klant.`,
  }
}

export function commerceNotificationTemplate(input: {
  kind: CommerceNotificationKind
  eventAt: string
  tenantName: string
  domainName?: string | null
  currency?: string | null
  providerOperationPriceNetMinor?: number | null
  includedAllowanceNetMinor?: number | null
  surchargeNetMinor?: number | null
  vatAmountMinor?: number | null
  grossAmountMinor?: number | null
  financialCoverageState?: string | null
  providerRenewalMode?: string | null
  providerAutorenew?: string | null
  registrarSafeCutoffAt?: string | null
  paymentChargeAt?: string | null
  providerBalanceAvailableMinor?: number | null
  providerBalanceReservedMinor?: number | null
  providerBalanceCurrency?: string | null
  providerBalanceCheckedAt?: string | null
  adminExceptionCode?: string | null
}) {
  const currency = input.currency ?? "EUR"
  const domainReminder = input.kind.match(/^domain_renewal_(90|60|30|14|7|1)d$/)
  const copy = domainReminder
    ? {
        subject: `Domeinverlenging ${input.domainName ?? ""}`.trim(),
        title: "Domeinverlenging",
        message: input.kind === "domain_renewal_90d"
          ? `${input.domainName ?? "Het domein"} heeft een indicatieve verlengstatus voor ${date(input.eventAt)}. Uiterlijk bij de 60-dagenmelding volgt de actuele prijs en eventuele toeslag.`
          : input.kind === "domain_renewal_60d"
            ? [
                `${input.domainName ?? "Het domein"} staat gepland voor verlenging op ${date(input.eventAt)}.`,
                `Providerprijs excl. btw: ${money(input.providerOperationPriceNetMinor, currency)}.`,
                `Inbegrepen domeinvergoeding: ${money(input.includedAllowanceNetMinor, currency)}.`,
                `Toeslag excl. btw: ${money(input.surchargeNetMinor, currency)}.`,
                `Btw: ${money(input.vatAmountMinor, currency)}.`,
                `Bruto nu te betalen: ${money(input.grossAmountMinor, currency)}.`,
                `Dekkingsstatus: ${input.financialCoverageState ?? "onbekend"}.`,
              ].join(" ")
            : `${input.domainName ?? "Het domein"} staat gepland voor verlenging op ${date(input.eventAt)}. De verlenging gebruikt uitsluitend de vastgelegde provideruitvoeringsmodus.`,
      }
    : input.kind === "domain_renewal_admin_7d"
      ? {
          subject: `Actiedossier domeinverlenging: ${input.domainName ?? ""}`.trim(),
          title: "Domeinverlenging over 7 dagen",
          message: [
            `${input.domainName ?? "Het domein"} bereikt de operationele verlengdatum op ${date(input.eventAt)}.`,
            `Dekking: ${input.financialCoverageState ?? "onbekend"}.`,
            `Uitvoeringsmodus: ${input.providerRenewalMode ?? "onbekend"}; provider-autorenew: ${input.providerAutorenew ?? "onbekend"}.`,
            `Veilige registrarcutoff: ${input.registrarSafeCutoffAt ? date(input.registrarSafeCutoffAt) : "niet beschikbaar"}.`,
            `Betaalmoment: ${input.paymentChargeAt ? date(input.paymentChargeAt) : "niet beschikbaar"}.`,
            `Providerbalans: ${money(input.providerBalanceAvailableMinor, input.providerBalanceCurrency ?? currency)} beschikbaar; ${money(input.providerBalanceReservedMinor, input.providerBalanceCurrency ?? currency)} gereserveerd.`,
            `Balans gecontroleerd: ${input.providerBalanceCheckedAt ? date(input.providerBalanceCheckedAt) : "niet beschikbaar"}.`,
            `Uitzondering: ${input.adminExceptionCode ?? "geen"}.`,
          ].join(" "),
        }
    : input.kind === "domain_renewed"
      ? {
          subject: `Domein verlengd: ${input.domainName ?? ""}`.trim(),
          title: "Domein verlengd",
          message: `${input.domainName ?? "Het domein"} is verlengd. De providerbevestiging en financiële dekking zijn gereconcilieerd.`,
        }
      : billingCopy(input.kind, input.eventAt)
  const tenantName = escapeHtml(input.tenantName)
  const message = escapeHtml(copy.message)
  return {
    subject: copy.subject.replace(/[\r\n]+/g, " ").trim(),
    html: renderEmailLayout({
      eyebrow: "Site in a Box",
      title: copy.title,
      body: [
        "<p>Hallo,</p>",
        `<p>Deze melding gaat over <strong>${tenantName}</strong>.</p>`,
        `<p>${message}</p>`,
        '<p>Vragen? Neem contact op via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>',
        "<p>Site in a Box</p>",
      ].join("\n"),
      footer: "standard",
    }),
    text: [
      "Hallo,",
      "",
      `Deze melding gaat over ${input.tenantName}.`,
      copy.message,
      "",
      "Vragen: info@siteinabox.nl",
      "",
      "Site in a Box",
    ].join("\n"),
  }
}
