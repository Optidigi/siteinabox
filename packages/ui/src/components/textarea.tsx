import * as React from "react"

import { cn } from "../lib/utils"
import { neoField } from "../lib/retro"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full px-3 py-2 text-base md:text-sm",
        neoField,
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
