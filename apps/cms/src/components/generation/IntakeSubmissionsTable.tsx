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

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nl-NL")
}

export function IntakeSubmissionsTable({
  submissions,
  emptyState,
}: {
  submissions: IntakeSubmission[]
  emptyState?: React.ReactNode
}) {
  if (submissions.length === 0) return <>{emptyState}</>

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Next step</TableHead>
            <TableHead>Received</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => {
            const runId = relationId(submission.generationRun)
            const workflow = workflowSummaryForIntakeSubmission(submission)

            return (
              <TableRow key={submission.id}>
                <TableCell>
                  <Badge variant={workflow.state === "Needs attention" ? "destructive" : "secondary"}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {workflow.state}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{submission.businessName}</div>
                  {runId && (
                    <Link href={`/generation-runs/${runId}`} className="text-xs text-muted-foreground hover:underline">
                      Draft site
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <div>{submission.contactName ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{submission.contactEmail ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{workflow.label}</div>
                  <div className="text-xs text-muted-foreground">{workflow.helper}</div>
                </TableCell>
                <TableCell>{formatDate(submission.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/generation-runs/submissions/${submission.id}`} className="gap-1.5">
                      <ClipboardCheck className="size-3.5" aria-hidden />
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
