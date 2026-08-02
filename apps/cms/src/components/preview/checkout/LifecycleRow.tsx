"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"

export function LifecycleRow({
  icon: Icon,
  status,
  title,
  detail,
  state,
}: {
  icon: React.ElementType
  status: "complete" | "active" | "pending" | "action_required" | "review" | string
  title: string
  detail: string
  state: string
}) {
  const iconClass = status === "complete"
    ? "bg-success/10 text-success"
    : status === "action_required" || status === "review"
      ? "bg-warning/10 text-warning"
      : status === "active"
        ? "bg-brand text-brand-foreground"
        : "bg-muted text-muted-foreground"
  return (
    <li className="grid min-h-[62px] min-w-0 grid-cols-[30px_minmax(0,1fr)] items-center gap-x-[11px] gap-y-0 border-b px-[13px] py-2.5 last:border-b-0 min-[560px]:grid-cols-[30px_minmax(0,1fr)_auto]">
      <span className={cn("grid size-[30px] place-items-center rounded-[9px]", iconClass)}>
        <Icon className={status === "active" && Icon === Loader2 ? "size-[15px] animate-spin" : "size-[15px]"} aria-hidden />
      </span>
      <span className="min-w-0">
        <strong className="block text-xs leading-snug">{title}</strong>
        <span className="mt-0.5 block text-[0.6875rem] leading-snug text-muted-foreground">{detail}</span>
      </span>
      <span className="col-start-2 text-[0.625rem] font-bold text-muted-foreground min-[560px]:col-start-auto min-[560px]:text-right">{state}</span>
    </li>
  )
}
