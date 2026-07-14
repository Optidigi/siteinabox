import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@siteinabox/ui/lib/utils"

const routes = [
  { href: "/operations", key: "overview" },
  { href: "/operations/intakes", key: "intakes" },
  { href: "/operations/runs", key: "runs" },
] as const

export function OperationsRouteTabs({ activePath }: { activePath: string }) {
  const t = useTranslations("generationOperations")
  return (
    <nav aria-label={t("tabs.ariaLabel")} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max border-b border-border">
        {routes.map((route) => {
          const active = route.href === "/operations"
            ? activePath === route.href
            : activePath === route.href || activePath.startsWith(`${route.href}/`)
          return <li key={route.href}>
            <Link
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active && "border-foreground text-foreground",
              )}
            >
              {t(`tabs.${route.key}`)}
            </Link>
          </li>
        })}
      </ul>
    </nav>
  )
}
