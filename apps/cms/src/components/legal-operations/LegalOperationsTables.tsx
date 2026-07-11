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
} from "@/lib/queries/legalOperations"
import { LegalStatus, type LegalStatusTone } from "./LegalStatus"
import { LegalTableFrame } from "./LegalTableFrame"

const statusTone = (status: string): LegalStatusTone => {
  const value = status.toLowerCase()
  if (["failed", "permanent_failure", "mislukt"].some((item) => value.includes(item))) return "destructive"
  if (["pending", "queued", "processing", "retry", "open", "required", "warning", "wacht"].some((item) => value.includes(item))) return "warning"
  if (["sent", "satisfied", "published", "active", "accepted", "verzonden", "voldaan"].some((item) => value.includes(item))) return "success"
  return "neutral"
}

const labels: Record<string, string> = {
  active: "Actief", scheduled: "Gepland", pending: "Openstaand", notified: "Genotificeerd", satisfied: "Voldaan", waived: "Vrijgesteld",
  queued: "In wachtrij", processing: "Bezig", sent: "Naar provider verzonden", failed: "Mislukt", cancelled: "Geannuleerd",
  permanent: "Definitief mislukt", retryable: "Opnieuw proberen", awaiting_response: "Reactie afwachten", explicit_required: "Expliciet vereist", no_qualifying_use: "Gebruik niet vastgesteld",
  mandatory_reaccept: "Expliciete acceptatie", reaccept_on_next_transaction: "Acceptatie bij volgende transactie", notice_and_continued_use: "Kennisgeving en voortgezet gebruik", direct_notice: "Directe kennisgeving", publish_notice: "Publicatiekennisgeving",
  objected: "Bezwaar ontvangen", qualifying_continued_use: "Stilzwijgend aanvaard", explicit_acceptance: "Expliciet aanvaard", transaction_acceptance: "Bij transactie aanvaard",
  administrative: "Administratief", editorial: "Redactioneel", material: "Materieel", initial: "Eerste publicatie", reminder: "Herinnering", enforcement: "Handhaving",
  delivery_retry_requested: "Nieuwe verzendpoging aangevraagd",
}
const label = (value: string) => labels[value] ?? value
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value)) : null

const CellLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {children}
  </Link>
)

const Dash = () => <span className="text-muted-foreground">-</span>

export function LegalAttentionTable({ rows }: { rows: LegalAttentionRow[] }) {
  return (
    <LegalTableFrame title="Aandacht vereist" description="Uitzonderingen die opvolging nodig hebben, op urgentie gerangschikt." isEmpty={rows.length === 0} emptyTitle="Geen open aandachtspunten" emptyDescription="Er zijn momenteel geen juridische uitzonderingen die opvolging nodig hebben.">
      <div className="overflow-x-auto">
        <Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
          <TableHeader><TableRow><TableHead>Prioriteit</TableHead><TableHead>Onderwerp</TableHead><TableHead>Tenant</TableHead><TableHead>Details</TableHead><TableHead>Deadline / leeftijd</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => {
            const Icon = row.severity === "destructive" ? CircleAlert : AlertTriangle
            return <TableRow key={`${row.kind}:${row.id}`}>
              <TableCell>
                <Icon className={row.severity === "destructive" ? "size-4 text-destructive" : "size-4 text-warning"} aria-hidden />
                <span className="sr-only">{row.severity === "destructive" ? "Kritiek" : "Waarschuwing"}</span>
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
  return (
    <LegalTableFrame title="Publicaties" description="Onveranderlijke publicatieregistratie uit de juridische release-pipeline." isEmpty={rows.length === 0} emptyTitle="Geen publicaties" emptyDescription="Er zijn nog geen juridische documenten gepubliceerd.">
      <div className="overflow-x-auto"><Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Wijziging</TableHead><TableHead>Klantactie</TableHead><TableHead>Gepubliceerd</TableHead><TableHead>Ingangsdatum</TableHead><TableHead>Status</TableHead><TableHead>Bron</TableHead></TableRow></TableHeader>
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
  return (
    <LegalTableFrame title="Klantacties" description="Openstaande en afgeronde vereisten per klant en document." isEmpty={rows.length === 0} emptyTitle="Geen klantacties" emptyDescription="Er zijn geen klantacties binnen de huidige selectie.">
      <div className="overflow-x-auto"><Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow><TableHead>Klant</TableHead><TableHead>Document</TableHead><TableHead>Actie</TableHead><TableHead>Reactietermijn</TableHead><TableHead>Geleverd</TableHead><TableHead>Resolutie</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.tenant ?? "Onbekende tenant"}</CellLink><div className="text-xs text-muted-foreground">{row.subjectEmail}</div></TableCell>
          <TableCell>{row.documentLabel}</TableCell><TableCell>{label(row.action)}</TableCell><TableCell>{dateTime(row.objectionDeadlineAt ?? row.enforceAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.noticeDeliveredAt ?? row.notifiedAt) ?? <Dash />}</TableCell><TableCell>{row.resolutionBasis ? label(row.resolutionBasis) : <Dash />}</TableCell>
          <TableCell><LegalStatus tone={statusTone(row.status)}>{label(row.status)}</LegalStatus></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalDeliveriesTable({ rows }: { rows: LegalDeliveryRow[] }) {
  return (
    <LegalTableFrame title="Verzendingen" description="Provider-overdracht, pogingen en fouten voor juridische kennisgevingen." isEmpty={rows.length === 0} emptyTitle="Geen verzendingen" emptyDescription="Er zijn geen juridische kennisgevingen binnen de huidige selectie.">
      <div className="overflow-x-auto"><Table className="min-w-[920px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow><TableHead>Ontvanger</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Pogingen</TableHead><TableHead>Laatste poging</TableHead><TableHead>Volgende poging</TableHead><TableHead>Resultaat</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.recipientMasked}</CellLink><div className="text-xs text-muted-foreground">{row.tenant ?? "Onbekende tenant"}</div></TableCell>
          <TableCell>{label(row.kind)}</TableCell><TableCell><LegalStatus tone={statusTone(row.status)}>{label(row.status)}</LegalStatus></TableCell><TableCell className="tabular-nums">{row.attemptCount}</TableCell>
          <TableCell>{dateTime(row.lastAttemptAt) ?? <Dash />}</TableCell><TableCell>{dateTime(row.nextAttemptAt) ?? <Dash />}</TableCell>
          <TableCell className="max-w-64 whitespace-normal">{row.lastError ? <span className="text-destructive">{row.lastError}</span> : row.sentAt ? `Naar provider verzonden ${dateTime(row.sentAt)}` : row.retryState ? label(row.retryState) : <Dash />}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalAcceptancesTable({ rows }: { rows: LegalAcceptanceRow[] }) {
  return (
    <LegalTableFrame title="Acceptatiebewijs" description="Leesbaar register van wie welke onveranderlijke voorwaarden heeft geaccepteerd." isEmpty={rows.length === 0} emptyTitle="Geen acceptaties" emptyDescription="Er zijn geen acceptatiebewijzen binnen de huidige selectie.">
      <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow><TableHead>Klant</TableHead><TableHead>Account</TableHead><TableHead>Document</TableHead><TableHead>Versie</TableHead><TableHead>Geaccepteerd</TableHead><TableHead>Verklaring</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><CellLink href={row.href}>{row.tenant ?? "Onbekende tenant"}</CellLink></TableCell><TableCell>{row.actorEmailMasked}</TableCell><TableCell>{row.documentLabel}</TableCell><TableCell>{row.documentVersion}</TableCell><TableCell>{dateTime(row.acceptedAt)}</TableCell><TableCell>{row.statementVersion}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </LegalTableFrame>
  )
}

export function LegalAuditTable({ rows }: { rows: LegalAuditRow[] }) {
  return <LegalTableFrame title="Auditlog" description="Onveranderlijke registratie van bevoorrechte juridische beheeracties." isEmpty={rows.length === 0} emptyTitle="Geen beheeracties" emptyDescription="Bevoorrechte herstelacties verschijnen hier.">
    <div className="overflow-x-auto"><Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
      <TableHeader><TableRow><TableHead>Actie</TableHead><TableHead>Doel</TableHead><TableHead>Actor</TableHead><TableHead>Reden</TableHead><TableHead>Tijd</TableHead><TableHead>Request-ID</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}>
        <TableCell><LegalStatus tone="warning">{label(row.action)}</LegalStatus></TableCell><TableCell className="font-mono text-xs">{row.target}</TableCell><TableCell>{row.actorEmailMasked}</TableCell>
        <TableCell className="max-w-80 whitespace-normal">{row.reason}</TableCell><TableCell>{dateTime(row.occurredAt)}</TableCell><TableCell className="font-mono text-xs">{row.requestId}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
  </LegalTableFrame>
}
