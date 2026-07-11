import { Badge } from "@siteinabox/ui/components/badge"
import { cn } from "@siteinabox/ui/lib/utils"

type LegalStatusTone = "neutral" | "info" | "success" | "warning" | "destructive"

const toneClasses: Record<LegalStatusTone, string> = {
  neutral: "border-border bg-transparent text-foreground",
  info: "border-border bg-secondary text-secondary-foreground",
  success: "border-success bg-transparent text-success",
  warning: "border-warning bg-transparent text-warning",
  destructive: "border-destructive bg-transparent text-destructive",
}

export function LegalStatus({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode
  tone?: LegalStatusTone
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-sm", toneClasses[tone], className)}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </Badge>
  )
}

export type { LegalStatusTone }
