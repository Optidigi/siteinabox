"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronsUpDown, Globe } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export type SiteSwitcherSite = {
  name: string
  slug: string
}

function rewriteSitePath(pathname: string, nextSlug: string): string {
  if (!/^\/sites\/[^/]+/.test(pathname)) return `/sites/${nextSlug}`
  return pathname.replace(/^\/sites\/[^/]+/, `/sites/${nextSlug}`)
}

/**
 * Site-scoped chrome switcher. With one site, renders a compact pill.
 * With multiple sites (super-admin), opens a menu that keeps the current
 * path suffix under the newly selected site.
 */
export function SiteSwitcher({
  current,
  sites,
  className,
}: {
  current: SiteSwitcherSite
  sites: SiteSwitcherSite[]
  className?: string
}) {
  const t = useTranslations("app")
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const options = sites.length > 0 ? sites : [current]
  const canSwitch = options.length > 1

  if (!canSwitch) {
    return (
      <Link
        href={`/sites/${current.slug}`}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 truncate rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted",
          className,
        )}
      >
        <Globe className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{current.name}</span>
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 max-w-[14rem] gap-1.5 px-2 text-xs font-normal", className)}
          aria-label={t("switchSite", { name: current.name })}
        >
          <Globe className="h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{current.name}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]" data-siab-editor-ui>
        {options.map((site) => (
          <DropdownMenuItem
            key={site.slug}
            className={site.slug === current.slug ? "bg-accent" : undefined}
            onClick={() => {
              if (site.slug === current.slug) return
              router.push(rewriteSitePath(pathname, site.slug))
            }}
          >
            <span className="truncate">{site.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
