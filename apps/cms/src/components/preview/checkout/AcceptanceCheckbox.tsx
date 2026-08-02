"use client"

import type { ReactNode } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Checkbox } from "@siteinabox/ui/components/checkbox"
import { cn } from "@siteinabox/ui/lib/utils"

export function AcceptanceCheckbox({
  id,
  checked,
  onCheckedChange,
  title,
  label,
  help,
  requiredLabel,
  describedBy,
  invalid = false,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  label: ReactNode
  help: ReactNode
  requiredLabel: string
  describedBy?: string
  invalid?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 text-sm leading-snug transition-colors hover:bg-muted/30", invalid && "bg-destructive/10 hover:bg-destructive/10")}>
      <Checkbox
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5 size-5 rounded-md"
      />
      <span id={`${id}-label`} className="min-w-0 break-words">
        <strong className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
          {title}
          <Badge variant="secondary" className="min-h-5 px-1.5 text-[0.5625rem]">{requiredLabel}</Badge>
        </strong>
        <span className="mt-1 block text-xs leading-relaxed text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{help}</span>
      </span>
    </div>
  )
}
