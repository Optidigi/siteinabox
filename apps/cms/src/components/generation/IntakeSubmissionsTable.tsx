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
import { relationId, relationLabel } from "@/lib/queries/generationOperations"
import type { IntakeSubmission } from "@/payload-types"

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
            <TableHead>Status</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Linked records</TableHead>
            <TableHead>Received</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => {
            const runId = relationId(submission.generationRun)
            const tenantId = relationId(submission.tenant)

            return (
              <TableRow key={submission.id}>
                <TableCell>
                  <Badge variant={statusVariant(submission.status)}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{submission.businessName}</div>
                  <code className="text-xs text-muted-foreground">{submission.normalizedHash ?? submission.idempotencyKey}</code>
                </TableCell>
                <TableCell>
                  <div>{submission.contactName ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{submission.contactEmail ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    Run{" "}
                    {runId ? (
                      <Link href={`/generation-runs/${runId}`} className="font-medium hover:underline">
                        #{runId}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Tenant {tenantId ? relationLabel(submission.tenant) : "-"}</div>
                </TableCell>
                <TableCell>{formatDate(submission.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/generation-runs/submissions/${submission.id}`}>Open</Link>
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
