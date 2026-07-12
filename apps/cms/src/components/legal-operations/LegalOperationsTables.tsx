import Link from "next/link"
import { AlertTriangle, CircleAlert } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import type {
  LegalAcceptanceRow,
  LegalAuditRow,
  LegalAttentionRow,
  LegalDeliveryRow,
  LegalReleaseRow,
  LegalRequirementRow,
  CommunicationPreferenceRow,
  TenantNotificationRow,
  CommunicationPreferenceEventRow,
} from "@/lib/queries/legalOperations"
import { LegalStatus, type LegalStatusTone } from "./LegalStatus"
import { LegalTableFrame } from "./LegalTableFrame"
import { useLocale, useTranslations } from "next-intl"

const statusTone = (status: string): LegalStatusTone => {
  const value = status.toLowerCase()
  if (["failed", "permanent_failure", "mislukt"].some((item) => value.includes(item))) return "destructive"
  if (["pending", "queued", "processing", "retry", "open", "required", "warning", "wacht"].some((item) => value.includes(item))) return "warning"
  if (["sent", "satisfied", "published", "active", "accepted", "verzonden", "voldaan"].some((item) => value.includes(item))) return "success"
  return "neutral"
}

const CellLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {children}
  </Link>
)

const Dash = () => <span className="text-muted-foreground">-</span>

const useLegalFormatting = () => {
  const t = useTranslations("legalOperations")
  const locale = useLocale()
  return {
    t,
    label: (value: string) => t.has(`statuses.${value}`) ? t(`statuses.${value}`) : value,
    dateTime: (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value)) : null,
  }
}

export function LegalAttentionTable({ rows }: { rows: LegalAttentionRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return (
    <LegalTableFrame title={t("attention.title")} description={t("attention.description")} isEmpty={rows.length === 0} emptyTitle={t("attention.emptyTitle")} emptyDescription={t("attention.emptyDescription")}>
      <div className="overflow-x-auto">
        <Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
          <TableHeader><TableRow>{["priority", "subject", "tenant", "details", "deadlineAge", "status"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((row) => {
            const Icon = row.severity === "destructive" ? CircleAlert : AlertTriangle
            return <TableRow key={`${row.kind}:${row.id}`}>
              <TableCell>
                <Icon className={row.severity === "destructive" ? "size-4 text-destructive" : "size-4 text-warning"} aria-hidden />
                <span className="sr-only">{row.severity === "destructive" ? t("critical") : t("warning")}</span>
              </TableCell>
              <TableCell><CellLink href={row.href}>{row.title}</CellLink><div className="mt-0.5 text-xs text-muted-foreground">{row.subject}</div></TableCell>
              <TableCell>{row.tenant ?? <Dash />}</TableCell><TableCell className="max-w-72 whitespace-normal text-muted-foreground">{row.detail}</TableCell>
              <TableCell>{dateTime(row.ageOrDeadline) ?? <Dash />}</TableCell><TableCell><LegalStatus tone={row.severity}>{label(row.status)}</LegalStatus></TableCell>
            </TableRow>
          })}</TableBody>
        </Table>
      </div>
    </LegalTableFrame>
  )
}

export function LegalReleasesTable({ rows }: { rows: LegalReleaseRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return (
    <LegalTableFrame title={t("releases.title")} description={t("releases.description")} isEmpty={rows.length === 0} emptyTitle={t("releases.emptyTitle")} emptyDescription={t("releases.emptyDescription")}>
      <div className="overflow-x-auto"><Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow>{["document", "change", "customerAction", "published", "effectiveAt", "status", "source"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.title}</CellLink><div className="text-xs text-muted-foreground">{row.documentType} · {row.locale} · {row.documentVersion}</div></TableCell>
          <TableCell>{label(row.changeCategory)}</TableCell><TableCell>{label(row.customerAction)}</TableCell><TableCell>{dateTime(row.publishedAt)}</TableCell><TableCell>{dateTime(row.effectiveAt)}</TableCell>
          <TableCell><LegalStatus tone={statusTone(row.state)}>{label(row.state)}</LegalStatus></TableCell><TableCell className="font-mono text-xs">{row.sourceCommit}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalRequirementsTable({ rows }: { rows: LegalRequirementRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return (
    <LegalTableFrame title={t("requirements.title")} description={t("requirements.description")} isEmpty={rows.length === 0} emptyTitle={t("requirements.emptyTitle")} emptyDescription={t("requirements.emptyDescription")}>
      <div className="overflow-x-auto"><Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow>{["customer", "document", "action", "responseDeadline", "delivered", "resolution", "status"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.tenant ?? t("unknownTenant")}</CellLink><div className="text-xs text-muted-foreground">{row.subjectEmail}</div></TableCell>
          <TableCell>{row.documentLabel}</TableCell><TableCell>{label(row.action)}</TableCell><TableCell>{dateTime(row.objectionDeadlineAt ?? row.enforceAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.noticeDeliveredAt ?? row.notifiedAt) ?? <Dash />}</TableCell><TableCell>{row.resolutionBasis ? label(row.resolutionBasis) : <Dash />}</TableCell>
          <TableCell><LegalStatus tone={statusTone(row.status)}>{label(row.status)}</LegalStatus></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalDeliveriesTable({ rows }: { rows: LegalDeliveryRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return (
    <LegalTableFrame title={t("deliveries.title")} description={t("deliveries.description")} isEmpty={rows.length === 0} emptyTitle={t("deliveries.emptyTitle")} emptyDescription={t("deliveries.emptyDescription")}>
      <div className="overflow-x-auto"><Table className="min-w-[920px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow>{["recipient", "type", "status", "attempts", "lastAttempt", "nextAttempt", "result"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.recipientMasked}</CellLink><div className="text-xs text-muted-foreground">{row.tenant ?? t("unknownTenant")}</div></TableCell>
          <TableCell>{label(row.kind)}</TableCell><TableCell><LegalStatus tone={statusTone(row.status)}>{label(row.status)}</LegalStatus></TableCell><TableCell className="tabular-nums">{row.attemptCount}</TableCell>
          <TableCell>{dateTime(row.lastAttemptAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.nextAttemptAt) ?? <Dash />}</TableCell>
          <TableCell className="max-w-64 whitespace-normal">{row.lastError ? <span className="text-destructive">{row.lastError}</span> : row.sentAt ? t("sentAt", { date: dateTime(row.sentAt)! }) : row.retryState ? label(row.retryState) : <Dash />}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalAcceptancesTable({ rows }: { rows: LegalAcceptanceRow[] }) {
  const { t, dateTime } = useLegalFormatting()
  return (
    <LegalTableFrame title={t("acceptances.title")} description={t("acceptances.description")} isEmpty={rows.length === 0} emptyTitle={t("acceptances.emptyTitle")} emptyDescription={t("acceptances.emptyDescription")}>
      <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow>{["customer", "account", "document", "version", "accepted", "statement"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.tenant ?? t("unknownTenant")}</CellLink></TableCell><TableCell>{row.actorEmailMasked}</TableCell><TableCell>{row.documentLabel}</TableCell><TableCell>{row.documentVersion}</TableCell><TableCell>{dateTime(row.acceptedAt)}</TableCell><TableCell>{row.statementVersion}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalAuditTable({ rows }: { rows: LegalAuditRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return <LegalTableFrame title={t("audit.title")} description={t("audit.description")} isEmpty={rows.length === 0} emptyTitle={t("audit.emptyTitle")} emptyDescription={t("audit.emptyDescription")}>
    <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
      <TableHeader><TableRow>{["action", "target", "actor", "reason", "time", "requestId"].map(key => <TableHead key={key}>{t(`columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}>
        <TableCell><LegalStatus tone="warning">{label(row.action)}</LegalStatus></TableCell><TableCell className="font-mono text-xs">{row.target}</TableCell><TableCell>{row.actorEmailMasked}</TableCell>
        <TableCell className="max-w-80 whitespace-normal">{row.reason}</TableCell><TableCell>{dateTime(row.occurredAt)}</TableCell><TableCell className="font-mono text-xs">{row.requestId}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
  </LegalTableFrame>
}

export function CommunicationPreferencesTable({ rows }: { rows: CommunicationPreferenceRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  const state = (value: string) => t(`communicationsUi.states.${value}`)
  return <LegalTableFrame title={t("communicationsUi.preferences.title")} description={t("communicationsUi.preferences.description")} isEmpty={rows.length === 0} emptyTitle={t("communicationsUi.preferences.emptyTitle")} emptyDescription={t("communicationsUi.preferences.emptyDescription")}>
    <div className="overflow-x-auto"><Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
      <TableHeader><TableRow>{["account", "tenant", "marketing", "productNotifications", "source", "consentAt", "updated"].map(key => <TableHead key={key}>{t(`communicationsUi.columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}>
        <TableCell><CellLink href={row.href}>{row.emailMasked}</CellLink>{row.suppressed && <div className="mt-1"><LegalStatus tone="destructive">{state("suppressed")}</LegalStatus></div>}</TableCell>
        <TableCell>{row.tenant ?? <Dash />}</TableCell><TableCell><LegalStatus tone={row.marketing ? "success" : "neutral"}>{state(row.marketing ? "opted_in" : "opted_out")}</LegalStatus></TableCell>
        <TableCell><LegalStatus tone={row.productNotifications ? "success" : "neutral"}>{state(row.productNotifications ? "subscribed" : "unsubscribed")}</LegalStatus></TableCell>
        <TableCell>{row.consentSource ?? <Dash />}</TableCell><TableCell>{dateTime(row.consentAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.updatedAt) ?? <Dash />}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
  </LegalTableFrame>
}

export function TenantNotificationsTable({ rows }: { rows: TenantNotificationRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return <LegalTableFrame title={t("communicationsUi.notifications.title")} description={t("communicationsUi.notifications.description")} isEmpty={rows.length === 0} emptyTitle={t("communicationsUi.notifications.emptyTitle")} emptyDescription={t("communicationsUi.notifications.emptyDescription")}>
    <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
      <TableHeader><TableRow>{["tenant", "account", "notificationCategories", "updated"].map(key => <TableHead key={key}>{t(`communicationsUi.columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><span className="font-medium">{row.tenant ?? t("unknownTenant")}</span></TableCell><TableCell>{row.member}<div className="text-xs text-muted-foreground">{row.emailMasked}</div></TableCell><TableCell className="max-w-md whitespace-normal">{row.categories.length ? row.categories.map(label).join(", ") : t("communicationsUi.states.none")}</TableCell><TableCell>{dateTime(row.updatedAt) ?? <Dash />}</TableCell></TableRow>)}</TableBody>
    </Table></div>
  </LegalTableFrame>
}

export function CommunicationPreferenceEventsTable({ rows }: { rows: CommunicationPreferenceEventRow[] }) {
  const { t, label, dateTime } = useLegalFormatting()
  return <LegalTableFrame title={t("communicationsUi.events.title")} description={t("communicationsUi.events.description")} isEmpty={rows.length === 0} emptyTitle={t("communicationsUi.events.emptyTitle")} emptyDescription={t("communicationsUi.events.emptyDescription")}>
    <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
      <TableHeader><TableRow>{["type", "action", "category", "source", "statement", "asserted", "time"].map(key => <TableHead key={key}>{t(`communicationsUi.columns.${key}`)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{label(row.preferenceType)}</TableCell><TableCell><LegalStatus tone={row.action === "opt_in" || row.action === "subscribe" ? "success" : "neutral"}>{label(row.action)}</LegalStatus></TableCell><TableCell>{row.category ? label(row.category) : <Dash />}</TableCell><TableCell>{row.source}</TableCell><TableCell>{row.statementVersion}</TableCell><TableCell>{dateTime(row.assertedAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.occurredAt) ?? <Dash />}</TableCell></TableRow>)}</TableBody>
    </Table></div>
  </LegalTableFrame>
}
