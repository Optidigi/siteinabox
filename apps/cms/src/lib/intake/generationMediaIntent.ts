/**
 * Generation/build-only media intent for provider slots.
 *
 * Tells fixture authors and AI generators what asset kind belongs in a slot.
 * Not a CMS product surface — clients may still upload any image later; the
 * variant layout (e.g. tall dock + object-cover) presents it.
 */
export type GenerationMediaKind = "photo" | "illustration"

export type GenerationMediaIntent = {
  kind: GenerationMediaKind
  /** Short note for generators / humans. */
  note: string
}

/** Keyed by provider variant id → slot field name. */
export const GENERATION_MEDIA_INTENT = {
  "shadcnui-blocks.cta-03": {
    backgroundImage: {
      kind: "illustration",
      note: "Tall device or UI illustration for the docked phone frame — not a random landscape photo.",
    },
  },
  "shadcnui-blocks.cta-04": {
    backgroundImage: {
      kind: "illustration",
      note: "Tall device or UI illustration for the docked phone frame — not a random landscape photo.",
    },
  },
} as const satisfies Record<string, Record<string, GenerationMediaIntent>>

export function generationMediaIntent(
  variantId: string,
  field: string,
): GenerationMediaIntent | undefined {
  const byVariant = GENERATION_MEDIA_INTENT[variantId as keyof typeof GENERATION_MEDIA_INTENT]
  if (!byVariant) return undefined
  return byVariant[field as keyof typeof byVariant] as GenerationMediaIntent | undefined
}
