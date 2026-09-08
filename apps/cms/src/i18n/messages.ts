import type { Locale } from "@/i18n/config"
import { sanitizeWorkflowTextMessages } from "@/i18n/workflowText"

const loaders = {
  en: () => import("@/locales/en.json").then((mod) => mod.default),
  nl: () => import("@/locales/nl.json").then((mod) => mod.default),
} satisfies Record<Locale, () => Promise<IntlMessages>>

export async function loadMessages(locale: Locale): Promise<IntlMessages> {
  const messages = await loaders[locale]()
  return {
    ...messages,
    generationOperations: {
      ...messages.generationOperations,
      workflowText: sanitizeWorkflowTextMessages(messages.generationOperations.workflowText),
    },
  } as unknown as IntlMessages
}
