import { cn } from "@siteinabox/ui/lib/utils"

type Props = {
  children: React.ReactNode
  className?: string
}

/**
 * Sticky bottom container for primary form actions. On phone, anchors
 * children (typically the submit button) above the soft keyboard
 * region with safe-area padding. On desktop, behaves as a regular
 * non-sticky inline container.
 *
 * Opt-in: apply only to forms taller than ~3 fields where the submit
 * would otherwise scroll out of view on phone.
 *
 * Inside dialogs the parent should use the inner-scroll wrapper from
 * Phase 1 so this footer stays visible while the body scrolls.
 *
 * Usage:
 *   <StickyFormFooter>
 *     <Button type="submit" size="touch" className="w-full md:w-auto">Save</Button>
 *   </StickyFormFooter>
 */
export function StickyFormFooter({ children, className }: Props) {
  return (
    <div
      className={cn(
        // Phone: sticky above keyboard region with safe-area padding
        "max-md:sticky max-md:bottom-0 max-md:bg-background max-md:border-t max-md:px-4 max-md:py-3 max-md:pb-[max(env(safe-area-inset-bottom),0.75rem)] max-md:-mx-4",
        // Desktop: inline flow, right-aligned actions
        "md:flex md:items-center md:justify-end md:gap-2 md:pt-4",
        // Phone layout: full-width buttons
        "flex flex-col gap-2 max-md:items-stretch",
        className,
      )}
    >
      {children}
    </div>
  )
}
