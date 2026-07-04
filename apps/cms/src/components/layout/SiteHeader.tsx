"use client"

import { SidebarTrigger } from "@siteinabox/ui/components/sidebar"
import { Separator } from "@siteinabox/ui/components/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "./UserMenu"
import type { User } from "@/payload-types"
import { usePathname } from "next/navigation"

function isPageEditorPath(pathname: string) {
  return /^\/pages\/(?:new|\d+|edit\/[^/]+)$/.test(pathname)
    || /^\/sites\/[^/]+\/pages\/(?:new|\d+|edit\/[^/]+)$/.test(pathname)
}

export function SiteHeader({ user }: { user: Pick<User, "email" | "name" | "role"> }) {
  const pathname = usePathname() ?? "/"
  const hideMobileNavTrigger = isPageEditorPath(pathname)
  const mobileNavClass = hideMobileNavTrigger ? "max-md:hidden" : undefined

  return (
    <header data-siab-cms-sticky-chrome className="sticky top-0 z-30 flex h-14 md:h-12 items-center gap-2 border-b bg-background px-4">
      <div className={mobileNavClass}>
        <SidebarTrigger />
      </div>
      <Separator orientation="vertical" className={mobileNavClass ? `${mobileNavClass} mx-2 h-4` : "mx-2 h-4"} />
      <div className="flex-1" />
      <div className="max-md:hidden">
        <ThemeToggle />
      </div>
      <UserMenu user={{ email: user.email, name: user.name ?? null, role: user.role }} />
    </header>
  )
}
