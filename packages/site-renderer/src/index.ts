export * from "./analytics"
export * from "./blocks"
export { initializeHeroDitherEffects } from "./blocks/hero/hero-dither-effect"
export * from "./media"
export * from "./rich-text"
export * from "./seo"
export * from "./SitePageRenderer"
export { NavbarRenderer } from "./chrome/Navbar"
export { FooterRenderer } from "./chrome/Footer"
export { ConsentRenderer } from "./chrome/Consent"
export {
  createPreviewConsentRuntime,
  initializeConsentBehavior,
  type ConsentAnalyticsApi,
  type ConsentRuntime,
  type ConsentSelection,
  type ConsentSelectionInput,
  type ConsentSnapshot,
} from "./chrome/consent-behavior"
export { initializeNavbarBehavior } from "./chrome/navbar-behavior"
export * from "./legal/LegalDocumentPage"
export * from "./ClientSitePageRenderer"
export * from "./icons/SiteIcons"
export * from "./theme"
export * from "./fixtures/v1"

const HERO_AMBIENT_SELECTOR = "[data-siab-hero-ambient-effect]"
const HERO_MESH_SELECTOR = "[data-siab-hero-mesh-effect]"

/**
 * Loads the ambient shader chunk only for pages that actually render the
 * Ambient background treatment. The preview can call this after a snapshot
 * changes; dynamic import() is cached by the browser after the first use.
 */
export function initializeHeroAmbientEffectsWhenPresent(root: ParentNode = document): Promise<(() => void) | null> {
  if (!root.querySelector(HERO_AMBIENT_SELECTOR)) return Promise.resolve(null)
  return import("./blocks/hero/hero-ambient-effect").then(({ initializeHeroAmbientEffects }) => initializeHeroAmbientEffects(root))
}

/**
 * Loads the mesh shader chunk only for pages that actually render the Mesh
 * gradient background treatment. The same lazy entrypoint is used by public
 * rendering and the CMS preview frame.
 */
export function initializeHeroMeshEffectsWhenPresent(root: ParentNode = document): Promise<(() => void) | null> {
  const load = () => import("./blocks/hero/hero-mesh-effect").then(({ initializeHeroMeshEffects }) => initializeHeroMeshEffects(root))
  if (root.querySelector(HERO_MESH_SELECTOR)) return load()

  // Theme toolbar updates can replace the iframe snapshot and its markers in
  // the commit immediately after this effect runs. Give React one paint to
  // finish that replacement before deciding that mesh mode is absent.
  if (typeof window === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!root.querySelector(HERO_MESH_SELECTOR)) {
          resolve(null)
          return
        }
        void load().then(resolve)
      })
    })
  })
}
