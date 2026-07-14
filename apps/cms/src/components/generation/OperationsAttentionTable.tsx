import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import { useLocale, useTranslations } from "next-intl"
import type { OperationsAttentionRow } from "@/lib/queries/generationOperations"
import { OperationsTableFrame } from "./OperationsTableFrame"

export function OperationsAttentionTable({ rows }: { rows: OperationsAttentionRow[] }) {
  const t = useTranslations("generationOperations")
  const locale = useLocale()
  const workflowText = (value: string) => t.has(`workflowText.${value}`) ? t(`workflowText.${value}`) : value
  const dateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value))
    : "-"
  return <OperationsTableFrame
    title={t("attention.title")}
    description={t("attention.description")}
    isEmpty={rows.length === 0}
    emptyTitle={t("attention.emptyTitle")}
    emptyDescription={t("attention.emptyDescription")}
  >
    <div className="overflow-x-auto">
      <Table className="min-w-[760px] [&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
        <TableHeader><TableRow>
          <TableHead>{t("columns.priority")}</TableHead>
          <TableHead>{t("columns.clientSite")}</TableHead>
          <TableHead>{t("columns.workflow")}</TableHead>
          <TableHead>{t("columns.nextStep")}</TableHead>
          <TableHead>{t("columns.updated")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}>
          <TableCell><AlertTriangle className="size-4 text-warning" aria-hidden /><span className="sr-only">{t("attention.warning")}</span></TableCell>
          <TableCell><Link href={row.href} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.title}</Link><div className="mt-0.5 text-xs text-muted-foreground">{t(`types.${row.kind}`)}</div></TableCell>
          <TableCell>{workflowText(row.subject)}</TableCell>
          <TableCell className="max-w-96 whitespace-normal text-muted-foreground">{workflowText(row.detail)}</TableCell>
          <TableCell>{dateTime(row.updatedAt)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </OperationsTableFrame>
}
