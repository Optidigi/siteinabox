"use client"

import type { ComponentProps } from "react"
import { useEffect, useState } from "react"
import { ChartContainer } from "@siteinabox/ui/components/chart"
import { cn } from "@siteinabox/ui/lib/utils"

type ChartContainerProps = ComponentProps<typeof ChartContainer>

export function ClientOnlyChartContainer({ className, ...props }: ChartContainerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        data-chart-placeholder=""
        className={cn("flex aspect-video justify-center text-xs", className)}
      />
    )
  }

  return <ChartContainer className={className} {...props} />
}
