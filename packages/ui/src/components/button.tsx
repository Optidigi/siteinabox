import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  // `cursor-pointer` is added back here (shadcn omits it intentionally per
  // Apple HIG, but it's the most common UX complaint — operators expect a
  // pointer cursor on actionable elements). The existing
  // `disabled:pointer-events-none` already prevents the cursor on disabled
  // buttons, so this is safe.
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      // Hover contrast — third pass. Light mode (/75 + shadow-md) was
      // operator-confirmed fine; dark mode destructive specifically still
      // looked unchanged. Two reasons:
      //   - dark-mode `bg-destructive` starts at /60 already, so the
      //     /60 → /75 hover jump is only +0.15 alpha on a saturated red
      //     (perceptually near-zero).
      //   - `shadow-md` is mostly invisible in dark mode (black shadow on
      //     near-black background).
      // Fix: an explicit `dark:hover:` rule that takes the bg to FULL
      // opacity (/60 → /100 = +0.40 alpha = clearly visible). Light mode
      // keeps its existing /75 + shadow combo unchanged.
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/75",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/30",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/85 focus-visible:ring-warning/30",
        destructive:
          "bg-destructive text-white hover:bg-destructive/75 hover:shadow-md focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:hover:bg-destructive dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/65",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // `default` / `lg` / `icon` / `icon-lg` bump to 44 px on mobile and
        // stay at desktop density from md+. The smaller variants
        // (xs/sm/icon-xs/icon-sm) intentionally stay below the floor —
        // callers opt into them in dense / table-cell contexts where
        // the trade-off is taken deliberately.
        default: "h-11 md:h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-11 md:h-10 rounded-md px-6 has-[>svg]:px-4",
        touch: "h-11 px-4 has-[>svg]:px-3",
        icon: "size-11 md:size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  // Default `type` to "button" so a Button rendered inside a <form> doesn't
  // submit it on click. The HTML default for <button> inside a form is
  // "submit", which has bitten this codebase repeatedly: any toolbar/icon
  // button (PreviewToolbar mode toggles, etc.) accidentally submits on
  // click. Real submit buttons (PublishControls Save, Login Sign-in, etc.)
  // explicitly set `type="submit"` so they're unaffected by this default.
  // When `asChild` is true the Slot is rendered as a non-button element
  // (often <a>) — the type attribute is meaningless there, so omit it to
  // avoid leaking a noisy DOM attribute onto anchor tags.
  const resolvedType = type ?? (asChild ? undefined : "button")

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={resolvedType}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
