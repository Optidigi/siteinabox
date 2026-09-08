import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"
import { blurAfterPointerClick, neoFocus, neoPress } from "../lib/retro"

const NEO_PRESS_VARIANTS = new Set([
  "default",
  "brand",
  "ink",
  "outline",
  "secondary",
  "success",
  "warning",
  "destructive",
])

const buttonVariants = cva(
  // Neobrutalism/brutadmin button, keeping SIAB sizes and type="button".
  `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-base border-2 border-border text-sm font-heading whitespace-nowrap ${neoFocus} disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:active:translate-x-0 disabled:active:translate-y-0 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
  {
    variants: {
      variant: {
        default: "bg-main text-main-foreground",
        brand: "bg-main text-main-foreground",
        ink: "bg-foreground text-background",
        noShadow: "bg-main text-main-foreground",
        reverse:
          "bg-main text-main-foreground transition-[translate,transform,box-shadow] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow",
        outline: "bg-card text-foreground",
        secondary: "bg-card text-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-muted hover:translate-x-0 hover:translate-y-0",
        link: "border-transparent bg-transparent shadow-none text-foreground underline-offset-4 hover:underline hover:translate-x-0 hover:translate-y-0",
      },
      size: {
        default: "h-11 md:h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-base px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-base px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-8 has-[>svg]:px-4",
        touch: "h-11 px-4 has-[>svg]:px-3",
        icon: "size-11 md:size-10",
        "icon-xs": "size-6 rounded-base [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
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
  onPointerUp,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedType = type ?? (asChild ? undefined : "button")
  const pressClass = variant && NEO_PRESS_VARIANTS.has(variant) ? neoPress : undefined
  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerUp?.(event)
    if (event.defaultPrevented) return
    blurAfterPointerClick(event)
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={resolvedType}
      className={cn(buttonVariants({ variant, size }), pressClass, className)}
      {...props}
      {...(asChild
        ? onPointerUp
          ? { onPointerUp }
          : {}
        : { onPointerUp: handlePointerUp })}
    />
  )
}

export { Button, buttonVariants }
