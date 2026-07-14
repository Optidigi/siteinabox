import type { ReactNode } from "react"
import { FileSearch } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { EmptyState } from "@/components/empty-state"

export function OperationsTableFrame({ title, description, isEmpty, emptyTitle, emptyDescription, children }: {
  title: string
  description?: string
  isEmpty: boolean
  emptyTitle: string
  emptyDescription: string
  children: ReactNode
}) {
  return <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className={isEmpty ? undefined : "p-0"}>
      {isEmpty
        ? <EmptyState icon={<FileSearch className="size-9 text-muted-foreground" aria-hidden />} title={emptyTitle} description={emptyDescription} className="py-10" />
        : children}
    </CardContent>
  </Card>
}
