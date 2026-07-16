import * as React from "react"
import { hydrateRoot } from "react-dom/client"
import { ShadcnUiBannerView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/banner-views"
import { loadShadcnUiExplicitBlockView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/block-client-loaders.generated"
import { ShadcnUiFooterView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/footer-views"
import { ShadcnUiNavbarView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/navbar-views"
import { ShadcnUiNotFoundView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/system-views"

const root = document.getElementById("provider-parity-root")
const payload = document.getElementById("provider-parity-props")?.textContent
if (!root || !payload) throw new Error("Missing provider parity hydration payload.")
const props = JSON.parse(payload)
const Component = props.kind === "system" ? ShadcnUiNotFoundView
  : props.kind === "chrome" && props.area === "banner" ? ShadcnUiBannerView
  : props.kind === "chrome" && props.area === "header" ? ShadcnUiNavbarView
  : props.kind === "chrome" ? ShadcnUiFooterView
  : await loadShadcnUiExplicitBlockView(props.variant)
hydrateRoot(root, React.createElement(Component as React.ComponentType<any>, props.kind === "block" ? { block: props.block, options: props.options } : props))
document.documentElement.dataset.providerHydrated = "true"
