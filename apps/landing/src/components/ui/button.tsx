import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  cn(
    "group/button font-body font-bold inline-flex cursor-pointer items-center justify-center gap-2 rounded-none whitespace-nowrap select-none transition-[transform,background-color,box-shadow,color] duration-150",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-invalid:border-destructive",
    // Icons keep their own size; we only set a default when none is given so
    // RetroUI's h-4/size-4 icons aren't overridden.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        default:
          "border-2 border-black bg-primary text-primary-foreground shadow-md transition duration-200 hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-primary-hover hover:shadow-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        secondary:
          "border-2 border-black bg-secondary text-secondary-foreground shadow-md transition duration-200 hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-secondary-hover hover:shadow-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        destructive:
          "border-2 border-black bg-destructive text-destructive-foreground shadow-md transition duration-200 hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-destructive/90 hover:shadow-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        outline:
          "border-2 bg-transparent shadow-md transition duration-200 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-sm active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        ghost: "bg-transparent hover:bg-accent",
        link: "bg-transparent hover:underline",
      },
      size: {
        default: "px-4 py-1.5 text-base",
        xs: "px-2 py-0.5 text-xs",
        sm: "px-3 py-1 text-sm",
        lg: "min-h-[60px] px-7 py-3 text-lg leading-[1.2]",
        icon: "p-2",
        "icon-xs": "p-1",
        "icon-sm": "p-1.5",
        "icon-lg": "p-3",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
