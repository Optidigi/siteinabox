import * as React from "react"
import { hydrateRoot } from "react-dom/client"
import { ShadcnUiPinnedLiteralReference } from "../../../../packages/site-renderer/src/providers/shadcnui-blocks/literal-references.generated"

const root = document.getElementById("provider-parity-root")
const payload = document.getElementById("provider-parity-props")?.textContent
if (!root || !payload) throw new Error("Missing provider reference hydration payload.")
const props = JSON.parse(payload)
hydrateRoot(root, React.createElement(ShadcnUiPinnedLiteralReference, props))
document.documentElement.dataset.providerHydrated = "true"
