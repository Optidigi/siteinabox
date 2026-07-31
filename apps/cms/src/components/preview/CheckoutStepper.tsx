import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export type CheckoutStepperItem<T extends string = string> = {
  id: T
  label: string
  icon: React.ElementType
}

type CheckoutStepperProps<T extends string = string> = {
  steps: Array<CheckoutStepperItem<T>>
  activeStep: T | null
  onStepSelect?: (step: T) => void
  reachableSteps?: T[]
}

export function CheckoutStepper<T extends string = string>({
  steps,
  activeStep,
  onStepSelect,
  reachableSteps = [],
}: CheckoutStepperProps<T>) {
  const activeIndex = steps.findIndex((entry) => entry.id === activeStep)
  const columns = steps.length === 4
    ? "grid-cols-4"
    : steps.length === 3
      ? "grid-cols-3"
      : "grid-cols-2"
  return (
    <ol className={cn("grid min-w-0 gap-0.5 rounded-md border bg-muted p-0.5", columns)}>
      {steps.map((entry, index) => {
        const Icon = entry.icon
        const active = index === activeIndex
        const complete = activeIndex >= 0 && index < activeIndex
        const reachable = reachableSteps.includes(entry.id)
        return (
          <li
            key={entry.id}
            aria-label={entry.label}
            aria-current={active ? "step" : undefined}
            className={cn("flex min-h-8 min-w-0 items-center justify-center rounded-[calc(var(--radius)-2px)] px-1 text-[0.625rem] font-semibold text-muted-foreground sm:text-xs", active && "bg-card text-foreground shadow-xs", complete && "text-foreground")}
          >
            {reachable && !active && onStepSelect ? (
              <Button
                type="button"
                variant="ghost"
                className="flex min-h-8 min-w-0 items-center justify-center gap-1.5 bg-transparent px-1 text-inherit"
                onClick={() => onStepSelect(entry.id)}
              >
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border bg-background", complete && "border-primary bg-primary text-primary-foreground")}><Icon className="size-3" aria-hidden /></span>
                <span className="truncate text-center">
                  {entry.label}
                </span>
              </Button>
            ) : (
              <>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border bg-background", complete && "border-primary bg-primary text-primary-foreground")}><Icon className="size-3" aria-hidden /></span>
                <span className="truncate text-center">
                  {entry.label}
                </span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
