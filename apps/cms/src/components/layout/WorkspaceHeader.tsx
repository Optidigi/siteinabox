import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "@siteinabox/ui/lib/utils"

/** Shared workspace chrome; identity and authorized actions stay caller-owned. */
export function WorkspaceHeader({ identity, actions, className, ...props }: Omit<ComponentPropsWithoutRef<"header">, "children"> & {
  identity: ReactNode
  actions?: ReactNode
}) {
  return (
    <header {...props} data-siab-workspace-header className={cn("flex w-full shrink-0 items-center gap-3 border-b-2 border-border bg-card px-4 py-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">{identity}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  )
}
