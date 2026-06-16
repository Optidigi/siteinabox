"use client"

import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { Languages } from "lucide-react"
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import { localeLabels, locales, type Locale } from "@/i18n/config"
import { setUserLanguage } from "@/lib/actions/setUserLanguage"
import { useStatusFeedback } from "@/components/status-feedback"

export function LanguageMenu() {
  const router = useRouter()
  const locale = useLocale() as Locale
  const tCommon = useTranslations("common")
  const tAccount = useTranslations("account")
  const status = useStatusFeedback()
  const [pending, startTransition] = useTransition()

  const updateLanguage = (next: string) => {
    if (next === locale) return
    startTransition(async () => {
      try {
        await setUserLanguage(next as Locale)
        status.success(tAccount("languageUpdated"))
        router.refresh()
      } catch {
        status.error(tAccount("languageUpdateFailed"))
      }
    })
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="max-md:py-2.5 max-md:text-base">
        <Languages className="mr-2 h-4 w-4" />
        {tCommon("language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={locale} onValueChange={updateLanguage}>
          {locales.map((item) => (
            <DropdownMenuRadioItem key={item} value={item} disabled={pending}>
              {localeLabels[item]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
