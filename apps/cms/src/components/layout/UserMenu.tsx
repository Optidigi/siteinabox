"use client"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { Avatar, AvatarFallback } from "@siteinabox/ui/components/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@siteinabox/ui/components/dropdown-menu"
import { LogOut, Key, User } from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-toggle"
import { LanguageMenu } from "@/components/layout/LanguageMenu"
import { useStatusFeedback } from "@/components/status-feedback"
import { authClient } from "@/lib/auth-client"

type Props = {
  user: { email: string; name?: string | null; role: "super-admin" | "owner" | "editor" | "viewer" }
}

export function UserMenu({ user }: Props) {
  const t = useTranslations("account")
  const status = useStatusFeedback()
  const [pending, start] = useTransition()
  const initial = (user.name || user.email)[0]?.toUpperCase() ?? "?"

  const onLogout = () => start(async () => {
    const res = await fetch("/api/users/logout", { method: "POST" })
    if (!res.ok) {
      status.error(t("logoutFailed"))
      return
    }
    await authClient.signOut().catch(() => null)
    window.location.replace("/login")
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menuLabel", { name: user.name || user.email })}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring inline-flex items-center justify-center h-7 w-7 max-md:h-11 max-md:w-11"
      >
        <Avatar className="h-7 w-7 max-md:h-9 max-md:w-9">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-md:w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium truncate">{user.name || user.email}</span>
          {user.name && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="md:hidden p-0 focus:bg-transparent"
          onSelect={(e) => e.preventDefault()}
        >
          <ThemeSwitcher />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="md:hidden" />
        <DropdownMenuItem asChild className="max-md:py-2.5 max-md:text-base">
          <a href="/profile"><User className="mr-2 h-4 w-4" /> {t("profile")}</a>
        </DropdownMenuItem>
        {user.role === "super-admin" && (
          <DropdownMenuItem asChild className="max-md:py-2.5 max-md:text-base">
            <a href="/api-key"><Key className="mr-2 h-4 w-4" /> {t("apiKey")}</a>
          </DropdownMenuItem>
        )}
        <LanguageMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={onLogout} className="max-md:py-2.5 max-md:text-base">
          <LogOut className="mr-2 h-4 w-4" /> {pending ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
