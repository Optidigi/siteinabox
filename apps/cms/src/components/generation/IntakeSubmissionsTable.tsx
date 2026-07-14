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
import { relationId, workflowSummaryForIntakeSubmission } from "@/lib/queries/generationOperations"
import type { IntakeSubmission } from "@/payload-types"
import { ClipboardCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
}

export function IntakeSubmissionsTable({
  submissions,
  emptyState,
}: {
  submissions: IntakeSubmission[]
  emptyState?: React.ReactNode
}) {
  const t = useTranslations("generationOperations")
  const locale = useLocale()
  if (submissions.length === 0) return <>{emptyState}</>

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[900px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.workflow")}</TableHead>
            <TableHead>{t("columns.business")}</TableHead>
            <TableHead>{t("columns.contact")}</TableHead>
            <TableHead>{t("columns.nextStep")}</TableHead>
            <TableHead>{t("columns.received")}</TableHead>
            <TableHead className="text-right">{t("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => {
            const runId = relationId(submission.generationRun)
            const workflow = workflowSummaryForIntakeSubmission(submission)
            const workflowText = (value: string) => t.has(`workflowText.${value}`) ? t(`workflowText.${value}`) : value

            return (
              <TableRow key={submission.id}>
                <TableCell>
                  <Badge variant={workflow.state === "Needs attention" ? "destructive" : "secondary"}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {t(`states.${workflow.state}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{submission.businessName}</div>
                  {runId && (
                    <Link href={`/operations/runs/${runId}`} className="text-xs text-muted-foreground hover:underline">
                      {t("draftSite")}
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <div>{submission.contactName ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{submission.contactEmail ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{workflowText(workflow.label)}</div>
                  <div className="text-xs text-muted-foreground">{workflowText(workflow.helper)}</div>
                </TableCell>
                <TableCell>{formatDate(submission.createdAt, locale)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/operations/intakes/${submission.id}`} className="gap-1.5">
                      <ClipboardCheck className="size-3.5" aria-hidden />
                      {workflowText(workflow.primaryAction)}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
