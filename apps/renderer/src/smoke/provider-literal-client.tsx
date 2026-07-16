import * as React from "react"
import { hydrateRoot } from "react-dom/client"
import { ShadcnUiPinnedLiteralPreview } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/literal-previews.generated"

const root = document.getElementById("provider-parity-root")
const payload = document.getElementById("provider-parity-props")?.textContent
if (!root || !payload) throw new Error("Missing provider literal preview hydration payload.")
hydrateRoot(root, React.createElement(ShadcnUiPinnedLiteralPreview, JSON.parse(payload)))
document.documentElement.dataset.providerHydrated = "true"
