"use client"
import * as React from "react"
import { Link as LinkIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { cn } from "@siteinabox/ui/lib/utils"

const ACTIVE_CHIP_CLASS = "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"

export const LinkChip: React.FC<{ onOpen: () => void; surface: "floating" | "persistent" }> = ({ onOpen, surface }) => {
  const t = useTranslations("editor")
  const { link } = useActiveTextStyle()
  const cls = surface === "floating"
    ? "rounded-sm p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
    : "rounded-sm p-2 hover:bg-accent text-muted-foreground hover:text-foreground"
  return (
    <button
      type="button"
      className={cn(cls, link && ACTIVE_CHIP_CLASS)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      aria-label={t("link")}
      aria-pressed={link}
    >
      <LinkIcon className="size-4" aria-hidden />
    </button>
  )
}
