"use client"

import { BuilderLogo } from "@/components/builder/BuilderLogo"
import { useTranslations } from "next-intl"

export function BuilderAgentStage() {
  const t = useTranslations("auth")
  return (
    <div data-siab-builder-stage className="flex flex-col items-center">
      <BuilderLogo className="mb-6" imgClassName="h-10 sm:h-11" />
      <h1 className="font-heading text-center text-3xl font-bold leading-tight">
        {t("workspaceHeadline")}
      </h1>
    </div>
  )
}
