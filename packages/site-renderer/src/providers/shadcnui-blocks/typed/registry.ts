import Cta01View from "../variants/cta-01/view"
import Cta02View from "../variants/cta-02/view"
import Cta03View from "../variants/cta-03/view"
import Cta04View from "../variants/cta-04/view"
import Cta05View from "../variants/cta-05/view"
import Cta06View from "../variants/cta-06/view"
import Cta07View from "../variants/cta-07/view"
import Faq01View from "../variants/faq-01/view"
import LogoCloud01View from "../variants/logo-cloud-01/view"

export const TYPED_PILOT_IDS = [
  "shadcnui-blocks.cta-01",
  "shadcnui-blocks.cta-02",
  "shadcnui-blocks.cta-03",
  "shadcnui-blocks.cta-04",
  "shadcnui-blocks.cta-05",
  "shadcnui-blocks.cta-06",
  "shadcnui-blocks.cta-07",
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
  "shadcnui-blocks.cta-02": {
    upstreamName: "cta-02",
    blockType: "cta",
    directFields: ["backgroundImage", "headline", "description", "primary"],
    View: Cta02View,
  },
  "shadcnui-blocks.cta-03": {
    upstreamName: "cta-03",
    blockType: "cta",
    directFields: ["backgroundImage", "headline", "description", "primary"],
    View: Cta03View,
  },
  "shadcnui-blocks.cta-04": {
    upstreamName: "cta-04",
    blockType: "cta",
    directFields: ["backgroundImage", "headline", "description", "primary"],
    View: Cta04View,
  },
  "shadcnui-blocks.cta-05": {
    upstreamName: "cta-05",
    blockType: "cta",
    directFields: ["headline", "description", "primary", "secondary"],
    View: Cta05View,
  },
  "shadcnui-blocks.cta-06": {
    upstreamName: "cta-06",
    blockType: "cta",
    directFields: ["headline", "description", "primary", "secondary"],
    View: Cta06View,
  },
  "shadcnui-blocks.cta-07": {
    upstreamName: "cta-07",
    blockType: "cta",
    directFields: ["headline", "description", "primary"],
    View: Cta07View,
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
