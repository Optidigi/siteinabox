import * as React from "react"
import { hydrateRoot } from "react-dom/client"
import { ShadcnUiExplicitBlockView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/block-views.generated"
import { ShadcnUiChromeView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/views"
import { ShadcnUiNotFoundView } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/system-views"

const root = document.getElementById("provider-parity-root")
const payload = document.getElementById("provider-parity-props")?.textContent
if (!root || !payload) throw new Error("Missing provider parity hydration payload.")
const props = JSON.parse(payload)
const Component = props.kind === "chrome" ? ShadcnUiChromeView : props.kind === "system" ? ShadcnUiNotFoundView : ShadcnUiExplicitBlockView
hydrateRoot(root, React.createElement(Component as React.ComponentType<any>, props))
document.documentElement.dataset.providerHydrated = "true"
