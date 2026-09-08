import type { HTMLAttributes } from "react"
import { cn } from "@siteinabox/ui/lib/utils"

export type StatusBadgeTone = "success" | "destructive" | "neutral"

export const statusBadgeBaseClassName =
  "h-8 px-3 rounded-base border-2 border-border shadow-shadow"

export const statusBadgeContentClassName =
  "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium"

export const statusBadgeToneClassNames: Record<StatusBadgeTone, string> = {
  success:
    "bg-success text-success-foreground",
  destructive:
    "bg-destructive text-destructive-foreground",
  neutral: "bg-card text-foreground",
}

export function getStatusBadgeClassName(
  tone: StatusBadgeTone,
  className?: string,
) {
  return cn(
    statusBadgeContentClassName,
    statusBadgeBaseClassName,
    statusBadgeToneClassNames[tone],
    className,
  )
}

export function StatusBadge({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone: StatusBadgeTone }) {
  return (
    <div
      className={getStatusBadgeClassName(tone, className)}
      {...props}
    />
  )
}
