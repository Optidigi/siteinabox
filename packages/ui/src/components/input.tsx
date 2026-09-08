import * as React from "react"

import { cn } from "../lib/utils"
import { neoField } from "../lib/retro"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 px-3 py-2 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-heading md:h-10 md:text-sm",
        neoField,
        "shadow-shadow aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
