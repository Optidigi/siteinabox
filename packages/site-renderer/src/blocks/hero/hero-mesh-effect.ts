/*
 * Paper MeshGradient source parity for SIAB hero backgrounds.
 *
 * The source component renders two MeshGradient surfaces with the same Paper
 * shader: a full-strength base field and a translucent overlay. We keep that
 * visual composition, but the SiteInABox runtime uses an explicit soft-field
 * render budget: two source-speed layers at a bounded pixel resolution, a
 * 30-FPS draw cadence, and no unnecessary high-DPI oversampling. The vanilla
 * Paper ShaderMount is used because the shared renderer is SSR-first and the
 * public renderer/CMS preview already share a DOM runtime entrypoint.
 *
 * Source reference:
 * https://21st.dev/@beratberkayg/components/shader-hero
 */

import { meshGradientFragmentShader as sourceMeshGradientFragmentShader, ShaderMount, type ShaderMountUniforms } from "@paper-design/shaders"
import { mixRgb, readTokenColor, type HeroShaderRgb } from "./hero-color-tokens"

const HERO_MESH_SELECTOR = "[data-siab-hero-mesh-effect]"
const SOURCE_BASE_SPEED = 0.25
const SOURCE_OVERLAY_SPEED = 0.15
const MESH_MIN_PIXEL_RATIO = 1
const MESH_MAX_PIXEL_COUNT = 1920 * 1080
const MESH_TARGET_FPS = 30
const MESH_FRAME_INTERVAL_MS = 1000 / MESH_TARGET_FPS
const MESH_PRELOAD_VIEWPORT_MULTIPLIER = 1

type ShaderColor = readonly [number, number, number, number]

type MeshLayer = {
  element: HTMLDivElement
  mount: ShaderMount
  sourceSpeed: number
  frame: number
}

type HeroMeshCleanup = () => void

const mountedEffects = new WeakMap<HTMLElement, HeroMeshCleanup>()
const deferredEffects = new WeakMap<HTMLElement, HeroMeshCleanup>()

/*
 * Source-parity profile for the 21st.dev Shader Hero. The two shader layers
 * retain their source structure, while their luminance recipe follows the
 * active color mode: light mode uses a light neutral ramp and dark mode keeps
 * the source's dark field. In light mode the clean white slots stay
 * unchromatic while the opposing mid-tone slots carry the stronger theme
 * accent; dark mode keeps its source-like bright accent slots.
 *
 * The published source bundle embeds the pre-0.0.54 Paper MeshGradient
 * fragment shader. The current Paper mount remains on 0.0.80 for its modern
 * visibility and render-budget lifecycle; only the source-era fragment is
 * imported from the explicitly pinned compatibility alias.
 *
 * The source passes `wireframe` to MeshGradient, but Paper's MeshGradient API
 * does not expose a wireframe uniform. The supported shader inputs below are
 * therefore the authoritative parity surface; we do not invent a second
 * wireframe renderer until the reference preview proves that prop has a
 * visible effect.
 */
const SOURCE_BASE_COLORS = [
  [0, 0, 0, 1],
  [0.1019607843, 0.1019607843, 0.1019607843, 1],
  [0.1803921569, 0.1803921569, 0.1803921569, 1],
  [1, 1, 1, 1],
] as const satisfies readonly ShaderColor[]

const SOURCE_OVERLAY_COLORS = [
  [0, 0, 0, 1],
  [1, 1, 1, 1],
  [0.1803921569, 0.1803921569, 0.1803921569, 1],
] as const satisfies readonly ShaderColor[]

const SOURCE_WHITE_RGB: HeroShaderRgb = [1, 1, 1]
const SOURCE_BLACK_RGB: HeroShaderRgb = [0, 0, 0]
const MESH_LIGHT_BASE_ACCENT_TINT = 0.72
const MESH_LIGHT_OVERLAY_ACCENT_TINT = 0.84
const MESH_LIGHT_NEUTRAL_LIFT = 0.72
const MESH_LIGHT_OVERLAY_NEUTRAL_MIX = 0.22
const MESH_DARK_BASE_THEME_TINT = 0.46
const MESH_DARK_OVERLAY_THEME_TINT = 0.46
const MESH_DARK_OVERLAY_SECONDARY_TINT = 0.28
const MESH_DARKEN = 0.04

type MeshPalettes = {
  base: readonly ShaderColor[]
  overlay: readonly ShaderColor[]
}

function shaderColor(color: HeroShaderRgb): ShaderColor {
  return [color[0], color[1], color[2], 1]
}

function shaderRgb(color: ShaderColor): HeroShaderRgb {
  return [color[0], color[1], color[2]]
}

function readMeshColorMode(wrapper: HTMLElement): "light" | "dark" {
  const documentElement = wrapper.ownerDocument.documentElement
  const canvas = wrapper.closest<HTMLElement>(".rt-canvas")
  const canvasMode = canvas?.dataset.rtMode
  if (canvasMode === "light" || canvasMode === "dark") return canvasMode
  return documentElement.dataset.siabColorMode === "dark"
    || documentElement.dataset.rtMode === "dark"
    ? "dark"
    : "light"
}

function readMeshPalettes(wrapper: HTMLElement): MeshPalettes {
  const primary = readTokenColor(wrapper, "--primary", SOURCE_WHITE_RGB)
  const lightAccent = readTokenColor(wrapper, "--siab-accent-500", primary)
  const darkAccent = readTokenColor(wrapper, "--siab-accent-300", primary)
  const mode = readMeshColorMode(wrapper)

  if (mode === "light") {
    const background = readTokenColor(wrapper, "--background", SOURCE_WHITE_RGB)
    const neutral100 = readTokenColor(wrapper, "--siab-neutral-100", background)
    const neutral200 = readTokenColor(wrapper, "--siab-neutral-200", neutral100)
    return {
      base: [
        shaderColor(background),
        shaderColor(mixRgb(neutral200, background, MESH_LIGHT_NEUTRAL_LIFT)),
        shaderColor(mixRgb(neutral200, lightAccent, MESH_LIGHT_BASE_ACCENT_TINT)),
        shaderColor(background),
      ],
      overlay: [
        shaderColor(mixRgb(background, neutral100, MESH_LIGHT_OVERLAY_NEUTRAL_MIX)),
        shaderColor(background),
        shaderColor(mixRgb(neutral200, lightAccent, MESH_LIGHT_OVERLAY_ACCENT_TINT)),
      ],
    }
  }

  const darkSecondaryAccent = readTokenColor(
    wrapper,
    "--siab-accent-secondary-700",
    shaderRgb(SOURCE_OVERLAY_COLORS[2]),
  )

  return {
    base: SOURCE_BASE_COLORS.map((color, index) => shaderColor(
      index === SOURCE_BASE_COLORS.length - 1
        ? mixRgb(SOURCE_WHITE_RGB, darkAccent, MESH_DARK_BASE_THEME_TINT)
        : mixRgb(shaderRgb(color), SOURCE_BLACK_RGB, MESH_DARKEN),
    )),
    overlay: [
      shaderColor(mixRgb(shaderRgb(SOURCE_OVERLAY_COLORS[0]), SOURCE_BLACK_RGB, MESH_DARKEN)),
      shaderColor(mixRgb(SOURCE_WHITE_RGB, darkAccent, MESH_DARK_OVERLAY_THEME_TINT)),
      shaderColor(mixRgb(shaderRgb(SOURCE_OVERLAY_COLORS[2]), darkSecondaryAccent, MESH_DARK_OVERLAY_SECONDARY_TINT)),
    ],
  }
}

function meshPaletteKey(palettes: MeshPalettes): string {
  return [palettes.base, palettes.overlay]
    .flat()
    .map((color) => color.join(","))
    .join("|")
}

function shaderUniforms(colors: readonly ShaderColor[]): ShaderMountUniforms {
  return {
    u_colors: colors.map((color) => [...color]),
    u_colorsCount: colors.length,
    u_distortion: 0.8,
    u_swirl: 0.1,

    // Paper's MeshGradient uses defaultObjectSizing when no sizing props are
    // supplied: contain, scale 1, no rotation or offset, centered origin.
    u_fit: 1,
    u_scale: 1,
    u_rotation: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: 0,
    u_offsetY: 0,
    u_worldWidth: 0,
    u_worldHeight: 0,
  }
}

function visibleRatio(element: HTMLElement, windowRef: Window): number {
  const rect = element.getBoundingClientRect()
  const visibleHeight = Math.max(0, Math.min(rect.bottom, windowRef.innerHeight) - Math.max(rect.top, 0))
  return rect.height > 0 ? visibleHeight / rect.height : 0
}

function preloadDistance(windowRef: Window): number {
  return Math.max(1, Math.round(windowRef.innerHeight * MESH_PRELOAD_VIEWPORT_MULTIPLIER))
}

function withinPreloadWindow(element: HTMLElement, windowRef: Window): boolean {
  const rect = element.getBoundingClientRect()
  const preloadPixels = preloadDistance(windowRef)
  return rect.top < windowRef.innerHeight + preloadPixels && rect.bottom > -preloadPixels
}

function createLayer(
  wrapper: HTMLElement,
  layerName: "base" | "overlay",
  colors: readonly ShaderColor[],
  sourceSpeed: number,
): MeshLayer {
  const element = wrapper.ownerDocument.createElement("div")
  element.className = `hero-mesh-layer hero-mesh-layer-${layerName}`
  element.dataset.siabHeroMeshLayer = layerName
  element.setAttribute("aria-hidden", "true")
  wrapper.append(element)

  try {
    /*
     * Match the source-era React MeshGradient shader and frame-0 start, while
     * explicitly bounding this soft background's render budget. Paper's
     * default minimum pixel ratio is 2; that is unnecessary for a blurred
     * background and can multiply work on high-DPI displays. The local 30 FPS
     * clock below owns animation cadence, so Paper's native RAF remains off.
     */
    const mount = new ShaderMount(
      element,
      sourceMeshGradientFragmentShader,
      shaderUniforms(colors),
      undefined,
      0,
      0,
      MESH_MIN_PIXEL_RATIO,
      MESH_MAX_PIXEL_COUNT,
    )

    mount.canvasElement.className = "hero-mesh-canvas"
    mount.canvasElement.dataset.siabHeroMeshCanvas = "true"
    mount.canvasElement.dataset.siabHeroMeshRenderer = "paper-shaders"
    return { element, mount, sourceSpeed, frame: 0 }
  } catch (error) {
    element.remove()
    throw error
  }
}

function mountHeroMeshEffect(wrapper: HTMLElement): HeroMeshCleanup | null {
  const windowRef = wrapper.ownerDocument.defaultView
  if (!windowRef || typeof windowRef.ResizeObserver === "undefined") return null

  const motionQuery = windowRef.matchMedia("(prefers-reduced-motion: reduce)")
  const layers: MeshLayer[] = []
  const contextLostCanvases: HTMLCanvasElement[] = []
  let destroyed = false
  let motionListenerAttached = false
  let documentVisibilityListenerAttached = false
  let themeObserver: MutationObserver | null = null
  let viewportObserver: IntersectionObserver | null = null
  let animationFrameId: number | null = null
  let lastDrawTimestamp: number | null = null
  let isInViewport = typeof windowRef.IntersectionObserver === "undefined"
    ? true
    : visibleRatio(wrapper, windowRef) > 0

  const stopAnimation = () => {
    if (animationFrameId !== null) {
      windowRef.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    lastDrawTimestamp = null
  }

  const shouldAnimate = () =>
    !destroyed && !motionQuery.matches && !windowRef.document.hidden && isInViewport

  const startAnimation = () => {
    if (!shouldAnimate() || animationFrameId !== null) return

    lastDrawTimestamp = windowRef.performance.now()
    const tick = (timestamp: number) => {
      if (!shouldAnimate()) {
        stopAnimation()
        return
      }

      const previousDrawTimestamp = lastDrawTimestamp ?? timestamp
      if (timestamp - previousDrawTimestamp >= MESH_FRAME_INTERVAL_MS) {
        const elapsed = timestamp - previousDrawTimestamp
        lastDrawTimestamp = timestamp

        for (const layer of layers) {
          layer.frame += elapsed * layer.sourceSpeed
          layer.mount.setFrame(layer.frame)
        }
      }

      animationFrameId = windowRef.requestAnimationFrame(tick)
    }

    animationFrameId = windowRef.requestAnimationFrame(tick)
  }

  const updateMotion = () => {
    if (shouldAnimate()) startAnimation()
    else stopAnimation()
  }

  wrapper.dataset.siabHeroMeshStatus = "pending"

  const onContextLost = (event: Event) => {
    event.preventDefault()
    disableMesh("context-lost")
  }

  const disableMesh = (status: "webgl-unavailable" | "context-lost") => {
    if (destroyed) return
    destroyed = true
    stopAnimation()
    if (motionListenerAttached) motionQuery.removeEventListener("change", updateMotion)
    if (documentVisibilityListenerAttached) windowRef.document.removeEventListener("visibilitychange", updateMotion)
    themeObserver?.disconnect()
    themeObserver = null
    viewportObserver?.disconnect()
    viewportObserver = null
    for (const canvas of contextLostCanvases) canvas.removeEventListener("webglcontextlost", onContextLost)
    for (const layer of layers) layer.mount.dispose()
    for (const layer of layers) layer.element.remove()
    wrapper.dataset.siabHeroMeshStatus = status
  }

  const initialPalettes = readMeshPalettes(wrapper)
  let currentPaletteKey = meshPaletteKey(initialPalettes)

  try {
    const base = createLayer(
      wrapper,
      "base",
      initialPalettes.base,
      SOURCE_BASE_SPEED,
    )
    layers.push(base)

    const overlay = createLayer(
      wrapper,
      "overlay",
      initialPalettes.overlay,
      SOURCE_OVERLAY_SPEED,
    )
    layers.push(overlay)
  } catch {
    disableMesh("webgl-unavailable")
    return () => undefined
  }

  for (const layer of layers) {
    layer.mount.setFrame(0)
    layer.mount.canvasElement.addEventListener("webglcontextlost", onContextLost)
    contextLostCanvases.push(layer.mount.canvasElement)
  }

  wrapper.dataset.siabHeroMeshStatus = "interactive"

  const refreshThemePalette = () => {
    const nextPalettes = readMeshPalettes(wrapper)
    const nextPaletteKey = meshPaletteKey(nextPalettes)
    if (nextPaletteKey === currentPaletteKey) return
    currentPaletteKey = nextPaletteKey
    layers[0]?.mount.setUniforms(shaderUniforms(nextPalettes.base))
    layers[1]?.mount.setUniforms(shaderUniforms(nextPalettes.overlay))
  }

  if (typeof windowRef.MutationObserver !== "undefined") {
    themeObserver = new windowRef.MutationObserver(refreshThemePalette)
    const themeRoots = [
      wrapper.ownerDocument.documentElement,
      wrapper.closest<HTMLElement>(".rt-canvas"),
    ].filter((root, index, roots): root is HTMLElement => Boolean(root) && roots.indexOf(root) === index)
    for (const root of themeRoots) {
      themeObserver.observe(root, {
        attributes: true,
        attributeFilter: ["data-rt-mode", "data-siab-color-mode", "data-theme-color", "style"],
      })
    }
  }

  if (typeof windowRef.IntersectionObserver !== "undefined") {
    viewportObserver = new windowRef.IntersectionObserver(([entry]) => {
      isInViewport = entry?.isIntersecting ?? true
      updateMotion()
    }, { threshold: 0 })
    viewportObserver.observe(wrapper)
  }

  motionQuery.addEventListener("change", updateMotion)
  motionListenerAttached = true
  windowRef.document.addEventListener("visibilitychange", updateMotion)
  documentVisibilityListenerAttached = true
  updateMotion()

  return () => {
    if (destroyed) return
    destroyed = true
    stopAnimation()
    motionQuery.removeEventListener("change", updateMotion)
    if (documentVisibilityListenerAttached) windowRef.document.removeEventListener("visibilitychange", updateMotion)
    themeObserver?.disconnect()
    themeObserver = null
    viewportObserver?.disconnect()
    viewportObserver = null
    for (const canvas of contextLostCanvases) canvas.removeEventListener("webglcontextlost", onContextLost)
    for (const layer of layers) layer.mount.dispose()
    for (const layer of layers) layer.element.remove()
    delete wrapper.dataset.siabHeroMeshStatus
  }
}

function elementsForRoot(root: ParentNode): HTMLElement[] {
  const elements: HTMLElement[] = []
  if (root instanceof HTMLElement && root.matches(HERO_MESH_SELECTOR)) elements.push(root)
  elements.push(...Array.from(root.querySelectorAll<HTMLElement>(HERO_MESH_SELECTOR)))
  return elements
}

function mountWhenVisible(element: HTMLElement): HeroMeshCleanup | null {
  const windowRef = element.ownerDocument.defaultView
  if (!windowRef) return null

  let activeCleanup: HeroMeshCleanup | null = null
  let positionFrameId: number | null = null
  let cancelled = false
  let failed = false

  const mount = () => {
    if (cancelled || activeCleanup || failed) return
    activeCleanup = mountHeroMeshEffect(element)
    if (!activeCleanup) {
      failed = true
      return
    }
    mountedEffects.set(element, activeCleanup)
    if (element.dataset.siabHeroMeshStatus === "webgl-unavailable") failed = true
  }

  const release = () => {
    if (!activeCleanup || failed) return
    const cleanup = activeCleanup
    activeCleanup = null
    cleanup()
    if (mountedEffects.get(element) === cleanup) mountedEffects.delete(element)
    element.dataset.siabHeroMeshStatus = "deferred"
  }

  const checkPosition = () => {
    positionFrameId = null
    if (cancelled || failed) return
    if (withinPreloadWindow(element, windowRef)) mount()
    else release()
  }

  const schedulePositionCheck = () => {
    if (cancelled || positionFrameId !== null) return
    positionFrameId = windowRef.requestAnimationFrame(checkPosition)
  }

  windowRef.addEventListener("scroll", schedulePositionCheck, { passive: true })
  windowRef.addEventListener("resize", schedulePositionCheck)
  element.dataset.siabHeroMeshStatus = "deferred"
  checkPosition()

  const cleanup = () => {
    cancelled = true
    if (positionFrameId !== null) {
      windowRef.cancelAnimationFrame(positionFrameId)
      positionFrameId = null
    }
    windowRef.removeEventListener("scroll", schedulePositionCheck)
    windowRef.removeEventListener("resize", schedulePositionCheck)
    deferredEffects.delete(element)
    if (activeCleanup) {
      const active = activeCleanup
      activeCleanup = null
      active()
      if (mountedEffects.get(element) === active) mountedEffects.delete(element)
    }
    delete element.dataset.siabHeroMeshStatus
  }
  deferredEffects.set(element, cleanup)
  return cleanup
}

/** Mounts the source-shaped monochrome mesh in public pages and CMS previews. */
export function initializeHeroMeshEffects(root: ParentNode = document): HeroMeshCleanup {
  const cleanups: HeroMeshCleanup[] = []

  for (const element of elementsForRoot(root)) {
    if (mountedEffects.has(element) || deferredEffects.has(element)) continue
    const cleanup = mountWhenVisible(element)
    if (cleanup) cleanups.push(cleanup)
  }

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
