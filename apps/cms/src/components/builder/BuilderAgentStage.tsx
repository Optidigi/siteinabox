"use client"

import { builderCopy } from "./copy"
import type { Locale } from "@/i18n/config"

import { BuilderLogo } from "@/components/builder/BuilderLogo"

export function BuilderAgentStage({ locale = "nl" }: { locale?: Locale }) {
  return (
    <div data-siab-builder-stage className="flex flex-col items-center">
      <BuilderLogo className="mb-6" imgClassName="h-10 sm:h-11" />
      <h1 className="font-heading text-center text-3xl font-bold leading-tight">
        {builderCopy[locale].headline}
      </h1>
    </div>
  )
}
