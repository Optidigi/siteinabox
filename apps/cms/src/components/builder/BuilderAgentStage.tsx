"use client"

import { BuilderLogo } from "@/components/builder/BuilderLogo"
import { BUILDER_STAGE_HEADLINE } from "@/lib/builder/thread"

export function BuilderAgentStage() {
  return (
    <div data-siab-builder-stage className="flex flex-col items-center">
      <BuilderLogo className="mb-6" imgClassName="h-10 sm:h-11" />
      <h1 className="font-heading text-center text-3xl font-bold leading-tight">
        {BUILDER_STAGE_HEADLINE}
      </h1>
    </div>
  )
}
