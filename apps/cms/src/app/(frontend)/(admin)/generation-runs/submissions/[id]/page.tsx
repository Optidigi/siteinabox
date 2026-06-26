import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { JsonSummaryBlock } from "@/components/generation/JsonSummaryBlock"
import { PageHeader } from "@/components/page-header"
import { statusVariant } from "@/lib/badge-helpers"
import { requireRole } from "@/lib/authGate"
import {
  getIntakeSubmissionForOperations,
  relationId,
  relationLabel,
  relationSlug,
} from "@/lib/queries/generationOperations"
import { AlertCircle, ArrowLeft } from "lucide-react"

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nl-NL")
}

const workflow = (entries: NonNullable<Awaited<ReturnType<typeof getIntakeSubmissionForOperations>>>["statusTransitions"]) =>
  entries?.length ? entries : []

export const dynamic = "force-dynamic"

export default async function IntakeSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["super-admin"])
  const { id } = await params
  const submission = await getIntakeSubmissionForOperations(id)
  if (!submission) notFound()

  const runId = relationId(submission.generationRun)
  const tenantSlug = relationSlug(submission.tenant)
  const tenantId = relationId(submission.tenant)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Intake submission #${submission.id}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(submission.status)}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {submission.status}
            </Badge>
            <span>{submission.businessName}</span>
            <span className="text-muted-foreground">{submission.source}</span>
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href="/generation-runs">
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      {submission.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Intake failed</AlertTitle>
          <AlertDescription>
            Review the summarized error and normalized/raw payload below. Secret-looking fields are redacted before display.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatDate(submission.createdAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Updated</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatDate(submission.updatedAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Generation run</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {runId ? (
              <Link href={`/generation-runs/${runId}`} className="font-medium hover:underline">
                #{runId}
              </Link>
            ) : "-"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tenant</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {tenantSlug ? (
              <Link href={`/sites/${tenantSlug}`} className="font-medium hover:underline">
                {relationLabel(submission.tenant)}
              </Link>
            ) : tenantId ? relationLabel(submission.tenant) : "-"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Contact</div>
            <div className="font-medium">{submission.contactName ?? "-"}</div>
            <div>{submission.contactEmail ?? "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Idempotency key</div>
            <code className="break-all text-xs">{submission.idempotencyKey}</code>
          </div>
          <div>
            <div className="text-muted-foreground">Normalized hash</div>
            <code className="break-all text-xs">{submission.normalizedHash ?? "-"}</code>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={submission.error} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Normalized intake</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={submission.normalized} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Raw intake summary</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={submission.raw} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status transitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {workflow(submission.statusTransitions).map((entry, index) => (
              <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                <span className="text-muted-foreground">{formatDate(entry.at)}</span>
                {entry.message && <span>{entry.message}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
