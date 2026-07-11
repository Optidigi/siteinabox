import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { JsonSummaryBlock } from "@/components/generation/JsonSummaryBlock"
import { PageHeader } from "@/components/page-header"
import {
  approveIntakeGenerationInputAction,
  deleteSafeIntakeSubmissionAction,
  generateReviewedIntakeDraftAction,
} from "@/lib/actions/reviewIntakeSubmission"
import { statusVariant } from "@/lib/badge-helpers"
import { requireRole } from "@/lib/authGate"
import { getAdminLocale, getAdminTranslations } from "@/i18n/admin"
import { defaultReviewedGenerationInput } from "@/lib/intake/reviewIntakeSubmission"
import {
  getIntakeSubmissionForOperations,
  relationId,
  relationLabel,
  relationSlug,
  workflowSummaryForIntakeSubmission,
} from "@/lib/queries/generationOperations"
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  Building2,
  FileCheck,
  Palette,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react"

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
}

const workflow = (entries: NonNullable<Awaited<ReturnType<typeof getIntakeSubmissionForOperations>>>["statusTransitions"]) =>
  entries?.length ? entries : []

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

const textValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

const textList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const text = textValue(entry)
    return text ? [text] : []
  })
}

const valueLabel = (value: unknown): string => {
  if (value == null || value === "") return "-"
  if (Array.isArray(value)) return textList(value).join(", ") || "-"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function FieldGrid({ items }: { items: Array<{ label: string; value: unknown }> }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border px-3 py-2">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-medium break-words">{valueLabel(item.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function BulletList({ values, empty = "-" }: { values: unknown; empty?: string }) {
  const items = textList(values)
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="grid gap-2 text-sm">
      {items.map((item) => (
        <li key={item} className="rounded-md border px-3 py-2">{item}</li>
      ))}
    </ul>
  )
}

export const dynamic = "force-dynamic"

export default async function IntakeSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "generationOperations.submissionDetail")
  const operationsT = await getAdminTranslations(user, "generationOperations")
  const locale = getAdminLocale(user)
  const { id } = await params
  const submission = await getIntakeSubmissionForOperations(id)
  if (!submission) notFound()

  const runId = relationId(submission.generationRun)
  const tenantSlug = relationSlug(submission.tenant)
  const tenantId = relationId(submission.tenant)
  const reviewedByLabel = relationLabel(submission.reviewedBy, "-")
  const normalized = asRecord(submission.normalized)
  const companyFacts = asRecord(normalized.companyFacts)
  const intakeBrief = asRecord(normalized.intakeBrief)
  const contact = asRecord(normalized.contact)
  const visualPreferences = asRecord(intakeBrief.visualPreferences)
  const brandSignals = asRecord(normalized.brandSignals)
  let approvedBriefJson: string | null = null
  let reviewedInputApproved = false
  try {
    const reviewedInput = defaultReviewedGenerationInput(submission)
    approvedBriefJson = JSON.stringify(reviewedInput, null, 2)
    reviewedInputApproved = reviewedInput.status === "admin-approved"
  } catch {
    approvedBriefJson = null
  }
  const canDelete = !runId && !tenantId
  const workflowSummary = workflowSummaryForIntakeSubmission(submission)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title", { business: submission.businessName })}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={workflowSummary.state === "Needs attention" ? "destructive" : "secondary"}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {operationsT.has(`workflowText.${workflowSummary.label}`) ? operationsT(`workflowText.${workflowSummary.label}`) : workflowSummary.label}
            </Badge>
            <span>{operationsT.has(`workflowText.${workflowSummary.helper}`) ? operationsT(`workflowText.${workflowSummary.helper}`) : workflowSummary.helper}</span>
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href="/generation-runs">
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("back")}
            </Link>
          </Button>
        }
      />

      {submission.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>{t("failed.title")}</AlertTitle>
          <AlertDescription>
            {t("failed.description")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="size-5" aria-hidden />
            {t("status.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-lg font-semibold">{operationsT.has(`workflowText.${workflowSummary.primaryAction}`) ? operationsT(`workflowText.${workflowSummary.primaryAction}`) : workflowSummary.primaryAction}</div>
            <div className="text-muted-foreground">{operationsT.has(`workflowText.${workflowSummary.helper}`) ? operationsT(`workflowText.${workflowSummary.helper}`) : workflowSummary.helper}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {runId && (
              <Button asChild>
                <Link href={`/generation-runs/${runId}`}>
                  <Sparkles className="mr-1 size-4" aria-hidden />
                  {t("status.openDraft")}
                </Link>
              </Button>
            )}
            {tenantSlug && (
              <Button asChild variant="outline">
                <Link href={`/sites/${tenantSlug}`}>
                  <Building2 className="mr-1 size-4" aria-hidden />
                  {t("status.openSite")}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" aria-hidden />
              {t("businessFacts.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGrid
              items={[
                { label: t("businessFacts.business"), value: companyFacts.companyName ?? normalized.businessName ?? submission.businessName },
                { label: t("businessFacts.activity"), value: companyFacts.mainActivity ?? normalized.industry },
                { label: t("businessFacts.area"), value: intakeBrief.serviceArea ?? normalized.serviceArea },
                { label: t("businessFacts.website"), value: companyFacts.website ?? normalized.primaryDomain },
                { label: t("businessFacts.contact"), value: contact.name ?? submission.contactName },
                { label: t("businessFacts.email"), value: contact.email ?? submission.contactEmail },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="size-5" aria-hidden />
              {t("brief.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="mb-2 text-sm font-medium">{t("brief.servicesGoals")}</div>
              <BulletList values={intakeBrief.services ?? normalized.goals} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">{t("brief.callsToAction")}</div>
              <BulletList values={intakeBrief.callsToAction} />
            </div>
            {textValue(intakeBrief.audience) && (
              <div className="text-sm">
                <div className="font-medium">{t("brief.audience")}</div>
                <p className="mt-1 text-muted-foreground">{textValue(intakeBrief.audience)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5" aria-hidden />
              {t("design.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGrid
              items={[
                { label: t("design.logo"), value: visualPreferences.logoText ?? visualPreferences.logoMode },
                { label: t("design.colorSource"), value: visualPreferences.colorSourceValue ?? visualPreferences.colorSourceType ?? brandSignals.colors },
                { label: t("design.palette"), value: visualPreferences.selectedPalette },
                { label: t("design.shape"), value: visualPreferences.shape },
                { label: t("design.typography"), value: visualPreferences.typography ?? brandSignals.fonts },
                { label: t("design.tone"), value: intakeBrief.tone ?? brandSignals.tone },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="size-5" aria-hidden />
              {t("notes.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <div className="font-medium">{t("notes.customer")}</div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{textValue(intakeBrief.notes) ?? "-"}</p>
            </div>
            <div>
              <div className="font-medium">{t("notes.internal")}</div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{submission.reviewNotes ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("advanced.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:text-foreground">
              {t("advanced.summary")}
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 rounded-md border p-3">
                <div>
                  <div className="font-medium">{t("recovery.title")}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("recovery.description")}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <form action={approveIntakeGenerationInputAction.bind(null, submission.id)} className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                      <FileCheck className="size-4" aria-hidden />
                      {t("recovery.approveBrief")}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t("recovery.approveDescription")}
                    </p>
                    <Textarea
                      id="reviewNotes"
                      name="reviewNotes"
                      rows={4}
                      defaultValue={submission.reviewNotes ?? ""}
                      placeholder={t("notes.internal")}
                    />
                    {approvedBriefJson ? (
                      <textarea name="reviewedGenerationInput" defaultValue={approvedBriefJson} hidden readOnly />
                    ) : null}
                    <Button type="submit" variant="outline" className="mt-3 w-full" disabled={!approvedBriefJson || Boolean(runId)}>
                      {t("recovery.approveBrief")}
                    </Button>
                    {runId && (
                      <p className="mt-2 text-xs text-muted-foreground">{t("recovery.draftLinked")}</p>
                    )}
                  </form>

                  <form action={generateReviewedIntakeDraftAction.bind(null, submission.id)} className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                      <Sparkles className="size-4" aria-hidden />
                      {t("recovery.rerun")}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t("recovery.rerunDescription")}
                    </p>
                    <Button type="submit" variant="outline" className="w-full" disabled={!reviewedInputApproved || Boolean(runId)}>
                      {t("recovery.rerun")}
                    </Button>
                    {!reviewedInputApproved && (
                      <p className="mt-2 text-xs text-muted-foreground">{t("recovery.reviewRequired")}</p>
                    )}
                    {runId && (
                      <p className="mt-2 text-xs text-muted-foreground">{t("recovery.draftLinked")}</p>
                    )}
                  </form>

                  <form action={deleteSafeIntakeSubmissionAction.bind(null, submission.id)} className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-destructive">
                      <Trash2 className="size-4" aria-hidden />
                      {t("recovery.deleteSafe")}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t("recovery.deleteDescription")}
                    </p>
                    <input
                      name="confirmDelete"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="DELETE"
                      disabled={!canDelete}
                    />
                    <Button type="submit" variant="destructive" className="mt-3 w-full" disabled={!canDelete}>
                      {t("recovery.delete")}
                    </Button>
                    {!canDelete && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("recovery.deleteBlocked")}
                      </p>
                    )}
                  </form>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">{t("technical.received")}</div>
                  <div className="font-medium">{formatDate(submission.createdAt, locale)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.updated")}</div>
                  <div className="font-medium">{formatDate(submission.updatedAt, locale)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.run")}</div>
                  {runId ? (
                    <Link href={`/generation-runs/${runId}`} className="font-medium hover:underline">
                      #{runId}
                    </Link>
                  ) : "-"}
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.tenant")}</div>
                  {tenantSlug ? (
                    <Link href={`/sites/${tenantSlug}`} className="font-medium hover:underline">
                      {relationLabel(submission.tenant)}
                    </Link>
                  ) : tenantId ? relationLabel(submission.tenant) : "-"}
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.requestKey")}</div>
                  <code className="break-all text-xs">{submission.idempotencyKey}</code>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.fingerprint")}</div>
                  <code className="break-all text-xs">{submission.normalizedHash ?? "-"}</code>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("technical.reviewed")}</div>
                  <div className="font-medium">{formatDate(submission.reviewedAt, locale)}</div>
                  <div>{reviewedByLabel}</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium">{t("technical.error")}</div>
                  <JsonSummaryBlock value={submission.error} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">{t("technical.normalizedSummary")}</div>
                  <JsonSummaryBlock value={submission.normalized} />
                </div>
                <div className="lg:col-span-2">
                  <div className="mb-2 text-sm font-medium">{t("technical.rawSummary")}</div>
                  <JsonSummaryBlock value={submission.raw} />
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">{t("technical.workflowHistory")}</div>
                <div className="flex flex-col gap-2">
                  {workflow(submission.statusTransitions).map((entry, index) => (
                    <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Badge variant={statusVariant(entry.status)}>{t.has(`intakeStatuses.${entry.status}`) ? t(`intakeStatuses.${entry.status}`) : entry.status}</Badge>
                      <span className="text-muted-foreground">{formatDate(entry.at, locale)}</span>
                      {entry.message && <span>{entry.message}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
