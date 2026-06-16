"use client"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@siteinabox/ui/components/dropdown-menu"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

/**
 * Three-state theme toggle: Light / Dark / System.
 *
 * - The trigger button keeps the existing Sun↔Moon swap animation based on the
 *   *resolved* theme (so picking "System" still shows the right icon for what
 *   the OS currently asks for).
 * - The dropdown lets the user pin an explicit theme or fall back to system
 *   preference. `next-themes` persists the choice in localStorage and reacts
 *   to OS changes when "system" is selected.
 */
export function ThemeToggle() {
  const t = useTranslations("common")
  const { theme, setTheme } = useTheme()
  // `theme` is "light" | "dark" | "system" | undefined (during SSR/first
  // paint). Coerce undefined to "system" so the radio group has a defined
  // value on first render. (The trigger icon's brief light-state flash on
  // dark-themed clients is a next-themes hydration concern inherited from
  // the previous toggle — unchanged here.)
  const value = theme ?? "system"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t("changeTheme")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={value} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" /> {t("light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" /> {t("dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" /> {t("system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Compact inline theme switcher (Light / Dark / System) suitable for embedding
 * inside a dropdown row — used in UserMenu on phone where the standalone
 * ThemeToggle button is hidden in the header to reclaim space.
 */
const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeSwitcher() {
  const t = useTranslations("common")
  const { theme, setTheme } = useTheme()
  const themeLabel = {
    light: t("light"),
    dark: t("dark"),
    system: t("system"),
  }

  return (
    <div className="flex w-full items-center gap-1 px-2 py-1.5">
      <span className="text-xs text-muted-foreground mr-auto">{t("theme")}</span>
      {(["light", "dark", "system"] as const).map((mode) => {
        const Icon = themeIcons[mode]
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            className={cn(
              "inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent transition-colors",
              theme === mode && "bg-accent",
            )}
            aria-pressed={theme === mode}
            aria-label={themeLabel[mode]}
            title={themeLabel[mode]}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
