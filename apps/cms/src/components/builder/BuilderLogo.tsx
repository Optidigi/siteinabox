"use client"

import { cn } from "@/lib/utils"

type BuilderLogoProps = {
  className?: string
  imgClassName?: string
  title?: string
}

export function BuilderLogo({ className, imgClassName, title }: BuilderLogoProps) {
  const mark = cn(
    "w-auto object-contain object-left",
    imgClassName ?? "h-14 max-w-[16rem] sm:h-16",
  )

  return (
    <span title={title} className={cn("inline-flex shrink-0 items-center", className)}>
      <img src="/logos/logo-light.svg" alt="Site in a Box" className={cn(mark, "dark:hidden")} />
      <img src="/logos/logo-dark.svg" alt="" aria-hidden className={cn(mark, "hidden dark:block")} />
    </span>
  )
}
