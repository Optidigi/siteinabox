import type { Locale } from "@/i18n/config"

const loaders = {
  en: () => import("@/locales/en.json").then((mod) => mod.default),
  nl: () => import("@/locales/nl.json").then((mod) => mod.default),
} satisfies Record<Locale, () => Promise<IntlMessages>>

export async function loadMessages(locale: Locale): Promise<IntlMessages> {
  const messages = await loaders[locale]()
  if (process.env.NODE_ENV !== "production" && process.env.SIAB_PREVIEW_FIXTURE_MODE === "1") {
    const workflowText = messages.generationOperations.workflowText
    // The generated locale type still describes the legacy dotted keys, while
    // next-intl rejects those keys at runtime. Fixture mode does not render
    // the operations namespace, so deliberately omit only those invalid keys.
    return {
      ...messages,
      generationOperations: {
        ...messages.generationOperations,
        workflowText: Object.fromEntries(
          Object.entries(workflowText).filter(([key]) => !key.includes(".")),
        ),
      },
    } as unknown as IntlMessages
  }
  return messages
}
