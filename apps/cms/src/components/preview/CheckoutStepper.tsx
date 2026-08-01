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
  progressText?: (current: number, total: number, label: string) => string
}

export function CheckoutStepper<T extends string = string>({
  steps,
  activeStep,
  onStepSelect,
  reachableSteps = [],
  progressText = (current, total, label) => `${current} / ${total} · ${label}`,
}: CheckoutStepperProps<T>) {
  const activeIndex = steps.findIndex((entry) => entry.id === activeStep)
  const columns = steps.length === 4
    ? "grid-cols-4"
    : steps.length === 3
      ? "grid-cols-3"
      : "grid-cols-2"
  const progressWidth = activeIndex >= steps.length - 1
    ? "w-full"
    : steps.length === 4
      ? activeIndex === 0 ? "w-1/4" : activeIndex === 1 ? "w-1/2" : "w-3/4"
      : steps.length === 3
        ? activeIndex === 0 ? "w-1/3" : "w-2/3"
        : "w-1/2"
  return (
    <>
      <div
        data-checkout-mobile-progress
        role="progressbar"
        aria-label={steps[activeIndex]?.label}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={progressText(activeIndex + 1, steps.length, steps[activeIndex]?.label ?? "")}
        className="-mr-3.5 grid min-w-0 grid-cols-[auto_minmax(3rem,1fr)] items-center gap-3 border-b px-0 pb-1 text-[0.6875rem] font-semibold min-[880px]:hidden"
      >
        <span className="min-w-0 truncate">
          {progressText(activeIndex + 1, steps.length, steps[activeIndex]?.label ?? "")}
        </span>
        <span className="h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className={cn("block h-full rounded-full bg-primary motion-safe:transition-[width]", progressWidth)} />
        </span>
      </div>
    <ol className={cn("hidden min-w-0 gap-0.5 rounded-md border bg-muted p-0.5 min-[880px]:grid", columns)}>
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
    </>
  )
}
