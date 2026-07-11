import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@siteinabox/ui/components/collapsible"
import { ChevronDown } from "lucide-react"

export type LegalDetailField = { label: string; value: ReactNode; mono?: boolean }

export function LegalRecordDetail({ title, fields, sensitiveFields = [], footer }: {
  title: string
  fields: LegalDetailField[]
  sensitiveFields?: LegalDetailField[]
  footer?: ReactNode
}) {
  const list = (items: LegalDetailField[]) => <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
    {items.map((field) => <div key={field.label} className="min-w-0">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{field.label}</dt>
      <dd className={field.mono ? "mt-1 break-all font-mono text-sm" : "mt-1 break-words text-sm"}>{field.value || "-"}</dd>
    </div>)}
  </dl>
  return <Card>
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent className="grid gap-6">
      {list(fields)}
      {sensitiveFields.length > 0 && <Collapsible className="group border-t pt-4">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Technische bewijsgegevens tonen
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">{list(sensitiveFields)}</CollapsibleContent>
      </Collapsible>}
      {footer}
    </CardContent>
  </Card>
}
