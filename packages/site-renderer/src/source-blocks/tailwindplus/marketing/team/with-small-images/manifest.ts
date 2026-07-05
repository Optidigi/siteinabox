import type { TeamBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingTeamWithSmallImagesRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_NAMESPACE = "tailwindplus.marketing.team"
export const TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_ID = "tailwindplus.marketing.team.with-small-images"
export const TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_LEGACY_VARIANT = "tailwindPlusGrid"

export const tailwindPlusMarketingTeamWithSmallImagesProviderBlock = defineProviderBlock<TeamBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_ID,
  blockType: "team",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_TEAM_WITH_SMALL_IMAGES_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-team-with-small-images",
  renderer: TailwindPlusMarketingTeamWithSmallImagesRenderer,
  slots: {
    title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
    intro: { kind: "richtext", status: "optional", exposed: true, sourceField: "intro" },
    members: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "members",
      minItems: 2,
      maxItems: 6,
    },
    memberName: { kind: "text", status: "required", exposed: true, sourceField: "members.name" },
    memberRole: { kind: "text", status: "required", exposed: true, sourceField: "members.role" },
    memberImage: { kind: "image", status: "optional", exposed: true, sourceField: "members.image" },
    memberBio: { kind: "richtext", status: "optional", exposed: false, sourceField: "members.bio" },
    memberLinks: { kind: "repeater", status: "optional", exposed: false, sourceField: "members.links" },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/team-sections",
    sourceComponent: "Marketing / Page Sections / Team Sections / With small images",
    sourceHash: "sha256:45fbdfeeb04b94f7195cd1479fd7d2670e76fe789e41c6a46f30dff1bf25173e",
    capturedAt: "2026-07-05",
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
  },
})
