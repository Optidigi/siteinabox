import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const REPOSITORY = "https://github.com/akash3444/shadcn-ui-blocks.git"
export const COMMIT = "46c2e50bb538c9bc7a8927979d38bae178ae4452"
export const REGISTRY_FILE = "registry-radix.json"
export const PROVIDER = "shadcnui-blocks"
export const NAMESPACE = "shadcnui-blocks"

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const root = resolve(scriptDir, "../..")
export const providerRoot = join(root, "packages/site-renderer/src/providers/shadcnui-blocks")
export const variantsRoot = join(providerRoot, "variants")
export const uiProviderRoot = join(root, "packages/ui/src/providers/shadcnui-blocks/radix-nova")
export const generatedRoot = join(root, "packages/contracts/src/generated")
export const bindingManifestPath = join(providerRoot, "bindings.json")
export const tokenExceptionManifestPath = join(providerRoot, "token-exceptions.json")

export const compatibilityPrimitives = [
  "accordion", "animated-grid-pattern", "avatar", "badge", "button", "card", "carousel", "chart",
  "checkbox", "dot-pattern", "input", "label", "marquee", "navigation-menu", "particles", "popover",
  "select", "separator", "sheet", "tabs", "textarea", "tooltip",
]

export const publicCategories = new Set([
  "banner", "blog", "contact", "cta", "faq", "features", "footer", "hero",
  "integrations", "logo-cloud", "navbar", "pricing", "stats", "team",
  "testimonials", "timeline",
])

/** Upstream names with owned typed components (not upstream literal rewrites). */
export const TYPED_PILOT_UPSTREAM_NAMES = new Set([
  "cta-01",
  "cta-02",
  "cta-03",
  "cta-04",
  "cta-05",
  "cta-06",
  "cta-07",
  "logo-cloud-01",
  "logo-cloud-02",
  "logo-cloud-03",
  "logo-cloud-04",
  "logo-cloud-05",
  "logo-cloud-06",
  "logo-cloud-07",
  "logo-cloud-08",
  "logo-cloud-09",
  "logo-cloud-10",
  "logo-cloud-11",
  "logo-cloud-12",
  "logo-cloud-13",
  "logo-cloud-14",
  "logo-cloud-15",
  "faq-01",
  "faq-02",
  "faq-03",
  "faq-04",
  "faq-05",
  "faq-06",
  "faq-07",
  "faq-08",
  "faq-09",
  "faq-10",
  "faq-11",
  "faq-12",
  "faq-13",
  "faq-14",
  "features-01",
  "features-02",
  "features-03",
  "features-04",
  "features-05",
  "features-06",
  "features-07",
  "features-08",
  "features-09",
  "features-10",
  "features-11",
  "features-12",
  "features-13",
  "features-14",
  "features-15",
  "features-16",
  "features-17",
  "features-18",
  "hero-01",
  "hero-02",
  "hero-03",
  "hero-04",
  "hero-05",
  "hero-06",
  "hero-07",
  "hero-08",
])

/** Upstream names with audited behavior-adapter views (Provider* literals preserved). */
export const LEGACY_BEHAVIOR_ADAPTER_NAMES = new Set(["contact-02"])

export const categoryFor = (name) => name.replace(/-\d+$/, "")
export const isPublic = (name) => publicCategories.has(categoryFor(name)) || /^carousel-block-\d+$/.test(name)
export const isSystem = (name) => /^not-found-\d+$/.test(name)

export const transparentSquare =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E"
