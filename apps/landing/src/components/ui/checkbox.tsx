import * as React from "react"
import { cn } from "@/lib/utils"

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-6 shrink-0 appearance-none rounded-none border-2 border-border bg-input outline-none checked:bg-primary checked:[background-image:linear-gradient(45deg,transparent_42%,#000_42%,#000_55%,transparent_55%),linear-gradient(-45deg,transparent_48%,#000_48%,#000_60%,transparent_60%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
