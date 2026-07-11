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

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
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
    <div className="rounded-lg border">
      <Table>
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

            return (
              <TableRow key={run.id}>
                <TableCell>
                  <Badge variant={workflow.state === "Needs attention" ? "destructive" : workflow.state === "Live" || workflow.state === "Checkout completed" ? "success" : "secondary"}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {workflow.state}
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
                  <div className="font-medium">{workflow.label}</div>
                  <div className="text-xs text-muted-foreground">{workflow.helper}</div>
                </TableCell>
                <TableCell>{formatDate(run.updatedAt, locale)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/generation-runs/${run.id}`} className="gap-1.5">
                      <ExternalLink className="size-3.5" aria-hidden />
                      {workflow.primaryAction}
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
