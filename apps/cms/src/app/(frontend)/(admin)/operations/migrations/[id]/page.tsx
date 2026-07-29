import Link from "next/link"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Label } from "@siteinabox/ui/components/label"
import config from "@/payload.config"
import type { DomainMigration } from "@/payload-types"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import {
  classifySiteinaboxIncidentAction,
  completeMigrationOperatorWorkAction,
  failMigrationOperatorWorkAction,
  requestDomainMigrationRollbackAction,
  startMigrationOperatorWorkAction,
} from "../actions"

export const dynamic = "force-dynamic"

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const redactedActions = (value: unknown) => {
  const entries = Array.isArray(value)
    ? value
    : Object.entries(record(value) ?? {}).map(([action, state]) => ({
        action,
        ...record(state),
      }))
  return entries.flatMap((entry) => {
    const item = record(entry)
    const action = typeof item?.action === "string" ? item.action : null
    const status = typeof item?.status === "string" ? item.status : null
    if (!action || !status) return []
    return [{
      action,
      status,
      deadlineAt: typeof item?.deadlineAt === "string"
        ? item.deadlineAt
        : null,
    }]
  })
}

export default async function OperationMigrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ result?: string }>
}) {
  await requireRole(["super-admin"])
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const payload = await getPayload({ config })
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as DomainMigration | null
  if (!migration) notFound()
  const result = (await searchParams).result
  const actions = redactedActions(migration.customerActions)
  const canClassifyIncident = [
    "ready_to_prepare",
    "preparing",
    "awaiting_provider",
    "ready_for_cutover",
  ].includes(migration.state)
  const canStart = migration.state === "paused_supplemental_order" &&
    ["paid_authorized", "non_billable_incident_authorized"].includes(
      migration.operatorWorkAuthorizationState,
    ) &&
    !migration.operatorWorkStartedAt
  const canFinish = migration.state === "paused_supplemental_order" &&
    Boolean(migration.operatorWorkStartedAt) &&
    !migration.operatorWorkCompletedAt
  const canRollback = ["cutover_in_progress", "verifying"].includes(
    migration.state,
  ) && migration.rollbackWriteState !== "confirmed"

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Migratie ${migration.domainNameAscii}`}
        subtitle="Redacted operatorweergave; geheimen en volledige DNS-evidence blijven verborgen."
      />
      <OperationsRouteTabs activePath="/operations/migrations" />
      {result && (
        <Alert role="status">
          <AlertTitle>Actieresultaat</AlertTitle>
          <AlertDescription>{result}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span>Veilige migratiesamenvatting</span>
            <Badge variant="outline">{migration.state}</Badge>
          </CardTitle>
          <CardDescription>
            Bronhashes bewijzen de bevroren invoer zonder zonerecords te tonen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Classificatie</dt><dd>{migration.acceptedClassification}</dd></div>
            <div><dt className="text-muted-foreground">Operatorautorisatie</dt><dd>{migration.operatorWorkAuthorizationState}</dd></div>
            <div><dt className="text-muted-foreground">Bronmechanisme</dt><dd>{migration.sourceMechanism}</dd></div>
            <div><dt className="text-muted-foreground">Bronbewijs</dt><dd className="font-mono">{migration.sourceZoneHash?.slice(0, 16) ?? "nog niet bevroren"}…</dd></div>
            <div><dt className="text-muted-foreground">Providerstatus</dt><dd>{migration.providerTransferState}</dd></div>
            <div><dt className="text-muted-foreground">Cloudflarestatus</dt><dd>{migration.cloudflareZoneState}</dd></div>
            <div><dt className="text-muted-foreground">Cutover</dt><dd>{migration.cutoverWriteState}</dd></div>
            <div><dt className="text-muted-foreground">Rollback</dt><dd>{migration.rollbackWriteState}</dd></div>
            {migration.operatorWorkScope && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Begrensde werkomschrijving</dt>
                <dd className="whitespace-pre-wrap">{migration.operatorWorkScope}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klantacties</CardTitle>
          <CardDescription>
            Alleen actiecode, status en deadline; geen codes of aangeleverde bestanden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen openstaande klantacties.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {actions.map((action) => (
                <li key={action.action} className="flex flex-wrap justify-between gap-2 rounded-md border p-3">
                  <span>{action.action}</span>
                  <span>{action.status}{action.deadlineAt ? ` · ${action.deadlineAt}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Begrensde operatoracties</CardTitle>
          <CardDescription>
            Start alleen betaald of expliciet niet-factureerbaar incidentherstel.
            Vermeld nooit transfercodes, persoonsgegevens of providerpayloads.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {canClassifyIncident && (
            <form action={classifySiteinaboxIncidentAction} className="grid gap-2">
              <input type="hidden" name="migrationId" value={migration.id} />
              <Label htmlFor="migration-work-scope">Siteinabox-incident: begrensde herstelomvang</Label>
              <select id="migration-work-scope" name="workScopeCode" required className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="restore_siab_website_records">Herstel door Siteinabox gewijzigde webrecords</option>
                <option value="repair_siab_zone_configuration">Herstel door Siteinabox gemaakte zoneconfiguratie</option>
                <option value="recover_siab_cutover_orchestration">Herstel Siteinabox-cutoverorkestratie</option>
              </select>
              <Button type="submit" variant="outline" className="w-fit">
                Classificeer als niet-factureerbaar incident
              </Button>
            </form>
          )}
          {canStart && (
            <form action={startMigrationOperatorWorkAction}>
              <input type="hidden" name="migrationId" value={migration.id} />
              <Button type="submit">Start geautoriseerd operatorwerk</Button>
            </form>
          )}
          {canFinish && (
            <>
              <form action={completeMigrationOperatorWorkAction} className="grid gap-2">
                <input type="hidden" name="migrationId" value={migration.id} />
                <Label htmlFor="migration-completion-code">Begrensde afrondingscode</Label>
                <select id="migration-completion-code" name="completionCode" required className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="source_verified_and_ready">Bron volledig geverifieerd en gereed</option>
                  <option value="operator_step_completed">Geautoriseerde operatorstap voltooid</option>
                  <option value="incident_recovery_completed">Siteinabox-incidentherstel voltooid</option>
                </select>
                <Button type="submit" className="w-fit">Rond af en hervat automatisering</Button>
              </form>
              <form action={failMigrationOperatorWorkAction} className="grid gap-2">
                <input type="hidden" name="migrationId" value={migration.id} />
                <Label htmlFor="migration-failure-code">Reden van mislukking</Label>
                <select id="migration-failure-code" name="failureCode" required className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="provider_access_failed">Providerautorisatie of toegang mislukt</option>
                  <option value="zone_conflict">Zoneconflict</option>
                  <option value="customer_correction_required">Correctie door klant vereist</option>
                  <option value="incident_recovery_failed">Incidentherstel mislukt</option>
                </select>
                <Button type="submit" variant="destructive" className="w-fit">Leg mislukking vast</Button>
              </form>
            </>
          )}
          {canRollback && (
            <form action={requestDomainMigrationRollbackAction} className="grid gap-2">
              <input type="hidden" name="migrationId" value={migration.id} />
              <Label htmlFor="migration-rollback-reason">Rollbackreden</Label>
              <select id="migration-rollback-reason" name="reasonCode" required className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="operator_detected_service_regression">Service-regressie vastgesteld</option>
                <option value="operator_detected_dns_mismatch">DNS-afwijking vastgesteld</option>
                <option value="customer_impact_reported">Klantimpact gemeld</option>
              </select>
              <Button type="submit" variant="destructive" className="w-fit">
                Vraag automatische rollback aan
              </Button>
            </form>
          )}
          {!canClassifyIncident && !canStart && !canFinish && !canRollback && (
            <p className="text-sm text-muted-foreground">
              Voor deze status is geen handmatige actie toegestaan.
            </p>
          )}
          <Button asChild variant="outline" className="w-fit">
            <Link href="/operations/migrations">Terug naar migraties</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
