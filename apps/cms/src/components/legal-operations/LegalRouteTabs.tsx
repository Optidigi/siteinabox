import Link from "next/link"
import { cn } from "@siteinabox/ui/lib/utils"

const legalRoutes = [
  { href: "/legal", label: "Overzicht" },
  { href: "/legal/releases", label: "Publicaties" },
  { href: "/legal/requirements", label: "Klantacties" },
  { href: "/legal/deliveries", label: "Verzendingen" },
  { href: "/legal/acceptances", label: "Acceptatiebewijs" },
  { href: "/legal/audit", label: "Auditlog" },
] as const

export function LegalRouteTabs({ activePath }: { activePath: string }) {
  return (
    <nav aria-label="Juridische onderdelen" className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                {route.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
