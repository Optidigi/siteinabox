import type { HTMLAttributes } from "react"
import { cn } from "@siteinabox/ui/lib/utils"

export type StatusBadgeTone = "success" | "destructive" | "neutral"

export const statusBadgeBaseClassName =
  "h-8 px-3 rounded-md shadow-md backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/25"

export const statusBadgeContentClassName =
  "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium"

export const statusBadgeToneClassNames: Record<StatusBadgeTone, string> = {
  success:
    "shadow-success/20 bg-success/75 supports-[backdrop-filter]:bg-success/65 text-success-foreground",
  destructive:
    "shadow-destructive/20 bg-destructive/75 supports-[backdrop-filter]:bg-destructive/65 text-destructive-foreground",
  neutral: "border border-border bg-card text-card-foreground",
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
