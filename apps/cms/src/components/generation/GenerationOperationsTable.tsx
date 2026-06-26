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
import { statusVariant } from "@/lib/badge-helpers"
import { extractIssueCount, relationId, relationLabel, relationSlug } from "@/lib/queries/generationOperations"
import type { SiteGenerationRun } from "@/payload-types"
import { AlertCircle, CheckCircle2, Eye, FileWarning, RotateCcw } from "lucide-react"

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nl-NL")
}

const shortHash = (value?: string | null) => {
  if (!value) return "-"
  return value.length > 14 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value
}

const approvalStatus = (run: SiteGenerationRun) => {
  const approval = run.clientApproval
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) return "pending"
  const status = (approval as { status?: unknown }).status
  return typeof status === "string" ? status : "pending"
}

export function GenerationOperationsTable({
  runs,
  emptyState,
}: {
  runs: SiteGenerationRun[]
  emptyState?: React.ReactNode
}) {
  if (runs.length === 0) return <>{emptyState}</>

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Draft records</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const tenantId = relationId(run.tenant)
            const tenantSlug = relationSlug(run.tenant)
            const pageCount = Array.isArray(run.pages) ? run.pages.length : 0
            const validationIssues = extractIssueCount(run.validation)
            const applyIssues = extractIssueCount(run.applyResult)
            const issues = validationIssues + applyIssues
            const isFailed = run.status === "failed"
            const isPreviewReady = run.status === "preview_ready"
            const isNeedsReview = (run.status === "draft_ready" || run.status === "preview_ready") && approvalStatus(run) !== "approved"

            return (
              <TableRow key={run.id}>
                <TableCell>
                  <Badge variant={statusVariant(run.status)}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{run.provider}</div>
                  <div className="text-xs text-muted-foreground">{run.model}</div>
                  <code className="text-xs text-muted-foreground">{shortHash(run.specHash)}</code>
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
                </TableCell>
                <TableCell>
                  <div className="text-sm">{pageCount} pages</div>
                  <div className="text-xs text-muted-foreground">settings {relationId(run.settings) ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex flex-wrap gap-1">
                    {isFailed && (
                      <Badge variant="destructive">
                        <AlertCircle className="size-3" aria-hidden />
                        failed
                      </Badge>
                    )}
                    {isPreviewReady && (
                      <Badge variant="success">
                        <CheckCircle2 className="size-3" aria-hidden />
                        preview
                      </Badge>
                    )}
                    {isNeedsReview && (
                      <Badge variant="warning">
                        <Eye className="size-3" aria-hidden />
                        review
                      </Badge>
                    )}
                    {issues > 0 && (
                      <Badge variant="warning">
                        <FileWarning className="size-3" aria-hidden />
                        {issues}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatDate(run.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/generation-runs/${run.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-start gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <RotateCcw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Retry is not exposed here because the current service only retries during initial processing and then reuses identical failed runs by idempotency key.
      </div>
    </div>
  )
}
