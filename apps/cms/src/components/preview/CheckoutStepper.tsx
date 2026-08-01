import * as React from "react"
import { Check } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export type CheckoutStepperItem<T extends string = string> = {
  id: T
  label: string
  description?: string
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
  const ActiveIcon = steps[activeIndex]?.icon
  const columns = steps.length === 4
    ? "grid-cols-4"
    : steps.length === 3
      ? "grid-cols-3"
      : "grid-cols-2"

  return (
    <nav
      data-checkout-mobile-progress
      role="progressbar"
      aria-label={steps[activeIndex]?.label}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={activeIndex + 1}
      aria-valuetext={progressText(activeIndex + 1, steps.length, steps[activeIndex]?.label ?? "")}
      className="-mr-3 mb-4 min-w-0 min-[880px]:mr-0"
    >
      <div className="grid min-h-11 min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(3rem,1fr)] items-center gap-2.5 rounded-xl border bg-card/70 px-3 min-[880px]:hidden">
        <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground">{ActiveIcon && <ActiveIcon className="size-3.5" aria-hidden />}</span>
        <span className="min-w-0 truncate text-xs font-semibold">{steps[activeIndex]?.label}</span>
        <span className="h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden><span className={cn("block h-full rounded-full bg-brand", activeIndex > 0 ? "w-full" : "w-1/2")} /></span>
      </div>
      <ol className={cn("hidden min-w-0 gap-2 min-[880px]:grid", columns)}>
        {steps.map((entry, index) => {
          const StepIcon = entry.icon
          const active = index === activeIndex
          const complete = activeIndex >= 0 && index < activeIndex
          const reachable = reachableSteps.includes(entry.id)
          const content = (
            <>
              <span className={cn(
                "grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground min-[560px]:size-7",
                active && "bg-brand text-brand-foreground",
                complete && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              )}>
                {complete ? <Check className="size-3.5" aria-hidden /> : <StepIcon className="size-3.5" aria-hidden />}
              </span>
              <span className="grid min-w-0 text-left leading-tight">
                <strong className="truncate text-[0.6875rem] font-semibold min-[560px]:text-[0.8125rem]">{entry.label}</strong>
                {entry.description && <span className="mt-0.5 hidden truncate text-[0.6875rem] font-normal text-muted-foreground min-[560px]:block">{entry.description}</span>}
              </span>
            </>
          )
          return (
            <li
              key={entry.id}
              aria-label={entry.label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl border bg-card/70 px-2 text-muted-foreground min-[560px]:min-h-[52px] min-[560px]:gap-2.5 min-[560px]:px-3",
                active && "border-border bg-card text-foreground shadow-sm",
              )}
            >
              {reachable && !active && onStepSelect ? (
                <Button
                  type="button"
                  aria-label={entry.label}
                  variant="ghost"
                  className="-m-2 flex h-auto min-h-11 min-w-0 flex-1 justify-start gap-1.5 rounded-xl px-2 text-inherit hover:bg-transparent min-[560px]:-m-3 min-[560px]:gap-2.5 min-[560px]:px-3"
                  onClick={() => onStepSelect(entry.id)}
                >
                  {content}
                </Button>
              ) : content}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
