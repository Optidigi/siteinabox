import * as React from "react"

import { cn } from "@siteinabox/ui/lib/utils"
import { Card, CardContent } from "@siteinabox/ui/components/card"

type Props = React.ComponentProps<"div"> & {
  /**
   * Right-side media. Pass a logo, hero image, branding panel, or any JSX.
   * Hidden on phone (< md) — left column is the only thing visible there.
   * If omitted, the right column renders as an empty muted panel on desktop.
   */
  media?: React.ReactNode
}

/**
 * Two-column auth shell: form on the left, media (logo / image / branding)
 * on the right. Mirrors shadcn's `login-04` block but is content-agnostic —
 * pass your own auth form as `children` and your own logo or image as
 * `media`. Stacks to a single column on phone widths.
 *
 * Usage:
 *   <Login04 media={<img src="/branding/admin.svg" alt="" className="…" />}>
 *     <LoginForm />
 *   </Login04>
 */
export function Login04({ media, children, className, ...props }: Props) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">{children}</div>
          <div className="relative hidden bg-muted md:block">{media}</div>
        </CardContent>
      </Card>
    </div>
  )
}
