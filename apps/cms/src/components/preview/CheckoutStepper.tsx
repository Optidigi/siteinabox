import * as React from "react"
import { Check } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export type CheckoutStepperItem<T extends string = string> = {
  id: T
  label: string
  description?: string
  icon?: React.ElementType
}

type CheckoutStepperProps<T extends string = string> = {
  steps: Array<CheckoutStepperItem<T>>
  activeStep: T | null
  variant?: "tiles" | "panel"
  activeHeadingRef?: React.Ref<HTMLHeadingElement>
  onStepSelect?: (step: T) => void
  reachableSteps?: T[]
  progressText?: (current: number, total: number, label: string) => string
  stepText?: (current: number, total: number) => string
}

export function CheckoutStepper<T extends string = string>({
  steps,
  activeStep,
  variant = "tiles",
  activeHeadingRef,
  onStepSelect,
  reachableSteps = [],
  progressText = (current, total, label) => `${current} / ${total} · ${label}`,
  stepText = (current, total) => `Step ${current} of ${total}`,
}: CheckoutStepperProps<T>) {
  const activeIndex = Math.max(0, steps.findIndex((entry) => entry.id === activeStep))
  const current = activeIndex + 1
  const total = steps.length
  const activeEntry = steps[activeIndex]

  if (variant === "panel") {
    return (
      <section
        data-checkout-mobile-progress
        role="progressbar"
        aria-label={activeEntry?.label}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={progressText(current, total, activeEntry?.label ?? "")}
        className="grid min-w-0 gap-2.5 border-b bg-transparent px-[17px] pb-3 pt-3.5 min-[560px]:gap-3 min-[560px]:px-[26px] min-[560px]:pb-[18px] min-[560px]:pt-5"
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {stepText(current, total)}
            </p>
            <h2 ref={activeHeadingRef} tabIndex={-1} className="mt-0.5 text-sm font-bold leading-tight tracking-[-0.012em] outline-none min-[560px]:text-[0.9375rem]">
              {activeEntry?.label}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {activeEntry?.description}
            </p>
          </div>
          <span className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground" aria-hidden>
            {current}/{total}
          </span>
        </div>
        <span data-checkout-progress-fill data-current={current} className="flex h-[3px] w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          {steps.map((entry, index) => (
            <span
              key={entry.id}
              data-checkout-progress-segment
              data-complete={index < current}
              className={cn("h-full flex-1", index < current && "bg-brand")}
            />
          ))}
        </span>
      </section>
    )
  }

  const columns = steps.length === 4
    ? "grid-cols-4"
    : steps.length === 3
      ? "grid-cols-3"
      : "grid-cols-2"

  return (
    <nav
      data-checkout-mobile-progress
      role="progressbar"
      aria-label={activeEntry?.label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={progressText(current, total, activeEntry?.label ?? "")}
      className="mb-4 min-w-0"
    >
      <ol className={cn("grid min-w-0 gap-2", columns)}>
        {steps.map((entry, index) => {
          const StepIcon = entry.icon
          const active = index === activeIndex
          const complete = index < activeIndex
          const reachable = reachableSteps.includes(entry.id)
          const content = (
            <>
              <span className={cn(
                "grid size-7 shrink-0 place-items-center rounded-[8px] bg-muted text-muted-foreground min-[560px]:size-8 min-[560px]:rounded-[9px]",
                active && "bg-brand text-brand-foreground",
                complete && "bg-success/10 text-success",
              )}>
                {complete ? <Check className="size-4" aria-hidden /> : StepIcon ? <StepIcon className="size-4" aria-hidden /> : null}
              </span>
              <span className="grid min-w-0 text-left leading-tight">
                <strong className="truncate text-[0.8125rem] font-[760] max-[355px]:text-[0.6875rem]">{entry.label}</strong>
                {entry.description && <span className="mt-px truncate text-[0.6875rem] font-normal text-muted-foreground max-[560px]:hidden">{entry.description}</span>}
              </span>
            </>
          )
          return (
            <li key={entry.id} aria-label={entry.label} aria-current={active ? "step" : undefined} className={cn(
              "flex min-h-[60px] min-w-0 items-center gap-2 rounded-[11px] border bg-card/75 px-3 py-2.5 text-muted-foreground min-[560px]:min-h-[72px] min-[560px]:gap-3 min-[560px]:rounded-[13px] min-[560px]:px-4 min-[560px]:py-3",
              active && "border-border bg-card text-foreground shadow-sm",
            )}>
              {reachable && !active && onStepSelect ? (
                <Button type="button" aria-label={entry.label} variant="ghost" className="-m-3 flex h-auto min-h-[60px] min-w-0 flex-1 justify-start gap-2 rounded-[11px] px-3 text-inherit hover:bg-transparent min-[560px]:-m-4 min-[560px]:min-h-[72px] min-[560px]:gap-3 min-[560px]:rounded-[13px] min-[560px]:px-4" onClick={() => onStepSelect(entry.id)}>
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
