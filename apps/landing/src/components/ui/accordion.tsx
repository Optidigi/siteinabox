import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "@/lib/utils"

// Smooth, premium easing for the open/close — fast out of the gate, gentle
// settle. Shared by the panel height and the chevron so they move in lockstep.
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col border-2 border-border shadow-[5px_5px_0_#090709]", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "overflow-hidden rounded-none border-0 border-b border-black/10 bg-card text-foreground last:border-b-0 dark:border-b-2 dark:border-black",
        className
      )}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 cursor-pointer items-center justify-between gap-5 px-4 py-3 text-left font-head transition-colors hover:bg-muted/50 data-[open]:bg-yellow data-[open]:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:data-[open]:bg-plum dark:data-[open]:text-white dark:data-[open]:shadow-[inset_4px_0_#f5e900]",
          className
        )}
        {...props}
      >
        {children}
        <span aria-hidden data-slot="accordion-trigger-icon" className="relative size-6 shrink-0 text-current">
          <i className="absolute left-0 top-1/2 h-[3px] w-6 -translate-y-1/2 bg-current" />
          <i className={cn("absolute left-1/2 top-0 h-6 w-[3px] -translate-x-1/2 bg-current transition-transform duration-300 group-data-[open]/accordion-trigger:scale-y-0", EASE)} />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      // Base UI publishes the measured panel height as `--accordion-panel-height`
      // and flags the entering/leaving frames with `data-starting-style` /
      // `data-ending-style`. Transitioning `height` between that var and 0 gives a
      // real slide open/close.
      className={cn(
          "group/panel h-[var(--accordion-panel-height)] overflow-hidden border-t-2 border-border bg-card font-body text-sm text-muted-foreground dark:border-white/10",
        "transition-[height] duration-300",
        EASE,
        "data-[starting-style]:h-0 data-[ending-style]:h-0"
      )}
      {...props}
    >
      <div
        className={cn(
          "px-4 pt-2 pb-4 transition-[opacity,transform] duration-300 ease-out",
          // Fade + nudge the content as the panel opens/closes, synced to the slide.
          "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
          "group-data-[ending-style]/panel:-translate-y-1 group-data-[ending-style]/panel:opacity-0",
          "[&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
