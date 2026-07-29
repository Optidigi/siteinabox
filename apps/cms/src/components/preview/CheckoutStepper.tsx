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
    <ol className={cn("grid min-w-0 rounded-full border bg-background p-1", columns)}>
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
            className={cn(
              "flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-full px-1 py-1 text-sm font-medium text-muted-foreground sm:gap-2 sm:px-3",
              (active || complete) && "bg-primary text-primary-foreground",
              complete && index + 1 === activeIndex && "rounded-r-none",
              active && index > 0 && "rounded-l-none",
            )}
          >
            {reachable && !active && onStepSelect ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 min-w-11 gap-1 px-1 text-inherit hover:bg-transparent hover:text-inherit sm:gap-2"
                onClick={() => onStepSelect(entry.id)}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="whitespace-normal text-center text-xs leading-tight sm:text-sm">
                  {entry.label}
                </span>
              </Button>
            ) : (
              <>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="whitespace-normal text-center text-xs leading-tight sm:text-sm">
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
