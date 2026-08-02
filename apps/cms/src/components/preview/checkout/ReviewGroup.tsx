"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export type ReviewGroupDetail = {
  label: string
  value: string
  full?: boolean
}

export function ReviewGroup({
  group,
  icon: Icon,
  title,
  summary,
  details,
  attention,
  onEdit,
  editLabel,
  missingLabel,
}: {
  group: string
  icon: React.ElementType
  title: string
  summary: string
  details: ReviewGroupDetail[]
  attention: boolean
  onEdit: (trigger: HTMLElement) => void
  editLabel: string
  missingLabel: string
}) {
  return (
    <section data-details-group={group} className="grid min-w-0 grid-cols-[1.875rem_minmax(0,1fr)_auto] items-start gap-2.5 border-b py-[18px] transition-colors hover:bg-muted/25 focus-within:bg-muted/25">
      <span className={cn("grid size-[30px] place-items-center rounded-[9px] bg-success/10 text-success", attention && "bg-destructive/10 text-destructive")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="grid min-w-0 gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {attention && <Badge variant="outline" className="border-warning/50 bg-warning/10 text-[0.625rem] text-foreground">{missingLabel}</Badge>}
        </div>
        <p className="min-w-0 [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground">{summary}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="min-h-9 shrink-0 gap-1 px-2 text-xs text-muted-foreground" onClick={(event) => onEdit(event.currentTarget)} aria-label={`${editLabel} ${title}`}>
        <Pencil className="size-3.5" aria-hidden />
        <span className="hidden min-[360px]:inline">{editLabel}</span>
      </Button>
      <dl className="col-start-2 col-end-4 mt-2 grid min-w-0 grid-cols-1 gap-x-5 gap-y-2 min-[560px]:grid-cols-2">
        {details.map((detail) => <ReviewDetail key={`${detail.label}-${detail.value}`} {...detail} />)}
      </dl>
    </section>
  )
}

export function ReviewDetail({ label, value, full = false }: ReviewGroupDetail) {
  return (
    <div className={cn("min-w-0", full && "min-[560px]:col-span-2")}>
      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.07em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere] text-xs leading-relaxed text-foreground">{value || "—"}</dd>
    </div>
  )
}
