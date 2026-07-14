import Link from "next/link"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@siteinabox/ui/components/table"
import { relationId, relationLabel, relationSlug, workflowSummaryForGenerationRun } from "@/lib/queries/generationOperations"
import type { SiteGenerationRun } from "@/payload-types"
import { ExternalLink } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { PreviewAccessQuickSend } from "./PreviewAccessQuickSend"

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
}

const textField = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

export function GenerationOperationsTable({
  runs,
  emptyState,
}: {
  runs: SiteGenerationRun[]
  emptyState?: React.ReactNode
}) {
  const t = useTranslations("generationOperations")
  const locale = useLocale()
  if (runs.length === 0) return <>{emptyState}</>

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[840px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.workflow")}</TableHead>
            <TableHead>{t("columns.site")}</TableHead>
            <TableHead>{t("columns.nextStep")}</TableHead>
            <TableHead>{t("columns.updated")}</TableHead>
            <TableHead className="text-right">{t("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const tenantId = relationId(run.tenant)
            const tenantSlug = relationSlug(run.tenant)
            const pageCount = Array.isArray(run.pages) ? run.pages.length : 0
            const workflow = workflowSummaryForGenerationRun(run)
            const email = textField(run.intakeSubmission, "contactEmail") ?? textField(run.payment, "customerEmail")
            const canSendPreview = workflow.primaryAction === "Send preview" && Boolean(email)
            const workflowText = (value: string) => t.has(`workflowText.${value}`) ? t(`workflowText.${value}`) : value

            return (
              <TableRow key={run.id}>
                <TableCell>
                  <Badge variant={workflow.state === "Needs attention" ? "destructive" : workflow.state === "Live" || workflow.state === "Checkout completed" ? "success" : "secondary"}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {t(`states.${workflow.state}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tenantSlug ? (
                    <Link href={`/sites/${tenantSlug}`} className="font-medium hover:underline">
                      {relationLabel(run.tenant)}
                    </Link>
                  ) : tenantId ? (
                    <span className="font-medium">{relationLabel(run.tenant)}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <div className="text-xs text-muted-foreground">{t("pageCount", { count: pageCount })}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{workflowText(workflow.label)}</div>
                  <div className="text-xs text-muted-foreground">{workflowText(workflow.helper)}</div>
                </TableCell>
                <TableCell>{formatDate(run.updatedAt, locale)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canSendPreview && <PreviewAccessQuickSend generationRunId={run.id} email={email!} label={t("sendPreviewTo", { title: relationLabel(run.tenant) })} />}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/operations/runs/${run.id}`} className="gap-1.5">
                        <ExternalLink className="size-3.5" aria-hidden />
                        {workflowText(workflow.primaryAction)}
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
