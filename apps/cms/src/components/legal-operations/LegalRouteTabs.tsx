import Link from "next/link"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

const legalRoutes = [
  { href: "/legal", key: "overview" },
  { href: "/legal/releases", key: "releases" },
  { href: "/legal/requirements", key: "requirements" },
  { href: "/legal/deliveries", key: "deliveries" },
  { href: "/legal/acceptances", key: "acceptances" },
  { href: "/legal/communications", key: "communications" },
  { href: "/legal/audit", key: "audit" },
] as const

export function LegalRouteTabs({ activePath }: { activePath: string }) {
  const t = useTranslations("legalOperations")
  return (
    <nav aria-label={t("tabs.ariaLabel")} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max border-b border-border">
        {legalRoutes.map((route) => {
          const isActive = route.href === "/legal"
            ? activePath === route.href
            : activePath === route.href || activePath.startsWith(`${route.href}/`)
          return (
            <li key={route.href}>
              <Link
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isActive && "border-foreground text-foreground",
                )}
              >
                {t(`tabs.${route.key}`)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
