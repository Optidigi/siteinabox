import Cta01View from "../variants/cta-01/view"
import Faq01View from "../variants/faq-01/view"
import LogoCloud01View from "../variants/logo-cloud-01/view"

export const TYPED_PILOT_IDS = [
  "shadcnui-blocks.cta-01",
  "shadcnui-blocks.logo-cloud-01",
  "shadcnui-blocks.faq-01",
] as const

export type TypedPilotId = (typeof TYPED_PILOT_IDS)[number]

/** Pre-typed pilots that still use Provider* runtime adapters instead of the shared typed helpers. */
export const LEGACY_BEHAVIOR_ADAPTER_IDS = [
  "shadcnui-blocks.contact-02",
  "shadcnui-blocks.features-03",
] as const

export type LegacyBehaviorAdapterId = (typeof LEGACY_BEHAVIOR_ADAPTER_IDS)[number]

export const BEHAVIOR_ADAPTER_IDS = [...TYPED_PILOT_IDS, ...LEGACY_BEHAVIOR_ADAPTER_IDS] as const

type TypedPilotBlockType = "cta" | "logoCloud" | "faq"

type TypedPilotRegistryMetadata = {
  upstreamName: string
  blockType: TypedPilotBlockType
  directFields: readonly string[]
}

export const TYPED_PILOT_REGISTRY = {
  "shadcnui-blocks.cta-01": {
    upstreamName: "cta-01",
    blockType: "cta",
    directFields: ["headline", "description", "primary"],
    View: Cta01View,
  },
  "shadcnui-blocks.logo-cloud-01": {
    upstreamName: "logo-cloud-01",
    blockType: "logoCloud",
    directFields: ["title", "logos"],
    View: LogoCloud01View,
  },
  "shadcnui-blocks.faq-01": {
    upstreamName: "faq-01",
    blockType: "faq",
    directFields: ["title", "items"],
    View: Faq01View,
  },
} as const satisfies Record<TypedPilotId, TypedPilotRegistryMetadata & {
  View: unknown
}>

type _RegistryCoversAllPilots = TypedPilotId extends keyof typeof TYPED_PILOT_REGISTRY ? true : never
type _PilotsCoverRegistry = keyof typeof TYPED_PILOT_REGISTRY extends TypedPilotId ? true : never

export function isTypedPilotId(value: string): value is TypedPilotId {
  return (TYPED_PILOT_IDS as readonly string[]).includes(value)
}
