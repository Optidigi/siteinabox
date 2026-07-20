import * as React from "react"
import { hydrateRoot } from "react-dom/client"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../packages/site-renderer/src/blocks/types"
import { ShadcnUiBannerView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/banner-views"
import { loadShadcnUiExplicitBlockView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/block-client-loaders.generated"
import { ShadcnUiFooterView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/footer-views"
import { ShadcnUiNavbarView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/navbar-views"
import { ShadcnUiNotFoundView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/system-views"

type ProviderParityPayload =
  | { kind: "system"; variant: string; settings: React.ComponentProps<typeof ShadcnUiNotFoundView>["settings"]; pathname?: string }
  | { kind: "chrome"; area: "header" | "footer" | "banner"; variant: string; settings: React.ComponentProps<typeof ShadcnUiNavbarView>["settings"] }
  | { kind: "block"; block: Block; options: BlockRenderOptions; variant: string }

const root = document.getElementById("provider-parity-root")
const payload = document.getElementById("provider-parity-props")?.textContent
if (!root || !payload) throw new Error("Missing provider parity hydration payload.")
const props = JSON.parse(payload) as ProviderParityPayload
const Component = props.kind === "system" ? ShadcnUiNotFoundView
  : props.kind === "chrome" && props.area === "banner" ? ShadcnUiBannerView
  : props.kind === "chrome" && props.area === "header" ? ShadcnUiNavbarView
  : props.kind === "chrome" ? ShadcnUiFooterView
  : await loadShadcnUiExplicitBlockView(props.variant)

const element = props.kind === "block"
  ? React.createElement(Component as React.ComponentType<{ block: Block; options: BlockRenderOptions }>, {
    block: props.block,
    options: props.options,
  })
  : React.createElement(Component as React.ComponentType<typeof props>, props)

hydrateRoot(root, element)
document.documentElement.dataset.providerHydrated = "true"
