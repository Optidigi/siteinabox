import type { HeroBlock } from "@siteinabox/contracts"
import type { RtRoot } from "@siteinabox/contracts/rich-text"
import {
  getProviderBlockDefinition,
  getSourceBackedVariantRenderer,
  isProviderBlockVariant,
  isSourceBackedVariant,
  TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID,
  TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_LEGACY_VARIANT,
} from "../index"

const rt: RtRoot = {
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: "Headline" }] }],
}

const activeBlock = {
  blockType: "hero",
  designVariant: TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID,
  headline: rt,
} satisfies HeroBlock

const legacyBlock = {
  blockType: "hero",
  designVariant: TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_LEGACY_VARIANT,
  headline: rt,
} satisfies HeroBlock

const unsupportedBlock = {
  blockType: "hero",
  designVariant: "unknown",
  headline: rt,
} satisfies HeroBlock

export const providerRegistryTypecheck = {
  activeDefinition: getProviderBlockDefinition(activeBlock)?.id,
  legacyDefinition: getProviderBlockDefinition(legacyBlock)?.id,
  activeRenderer: getSourceBackedVariantRenderer(activeBlock),
  legacyRenderer: getSourceBackedVariantRenderer(legacyBlock),
  activeIsProvider: isProviderBlockVariant(activeBlock),
  legacyIsProvider: isSourceBackedVariant(legacyBlock),
  unsupportedDefinition: getProviderBlockDefinition(unsupportedBlock),
} as const
