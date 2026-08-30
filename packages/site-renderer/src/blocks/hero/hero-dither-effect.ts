const HERO_DITHER_SELECTOR = "[data-siab-hero-dither-effect]"

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

// Keep the logical grid stable in CSS pixels. The render surface may use a
// lower physical resolution on very large canvases, but the artwork should
// not become denser or sparser merely because devicePixelRatio changed.
const DITHER_SIZE = 2
const DITHER_TIME_SCALE = 0.5
const IDLE_SPEED = 0.23
const HOVER_SPEED = 0.45
const SPEED_RESPONSE_SECONDS = 0.18
const MAX_DEVICE_PIXEL_RATIO = 2
const MAX_RENDER_PIXELS = 4_000_000
const TARGET_FRAME_MS = 1000 / 60

const VERTEX_SHADER_SOURCE = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uPixelSize;
  uniform float uPixelRatio;
  uniform vec3 uColor;

  float bayer4(vec2 cell) {
    vec2 position = floor(fract(cell / 4.0) * 4.0);

    if (position.y < 1.0) {
      if (position.x < 1.0) return 0.0;
      if (position.x < 2.0) return 0.5;
      if (position.x < 3.0) return 0.125;
      return 0.625;
    }

    if (position.y < 2.0) {
      if (position.x < 1.0) return 0.75;
      if (position.x < 2.0) return 0.25;
      if (position.x < 3.0) return 0.875;
      return 0.375;
    }

    if (position.y < 3.0) {
      if (position.x < 1.0) return 0.1875;
      if (position.x < 2.0) return 0.6875;
      if (position.x < 3.0) return 0.0625;
      return 0.5625;
    }

    if (position.x < 1.0) return 0.9375;
    if (position.x < 2.0) return 0.4375;
    if (position.x < 3.0) return 0.8125;
    return 0.3125;
  }

  void main() {
    float pixelSize = max(uPixelSize, 1.0);
    float pixelRatio = max(uPixelRatio, 0.75);
    vec2 centeredPixel = gl_FragCoord.xy - 0.5 * uResolution;
    vec2 pixelized = (floor(centeredPixel / pixelSize) + 0.5) * pixelSize;
    vec2 shapePoint = (pixelized / pixelRatio) * 0.003;
    float time = uTime * 0.5;

    // A compact, cross-coupled warp creates the sharp moving bands of the
    // reference treatment without introducing a noisy second field.
    for (float index = 1.0; index < 6.0; index += 1.0) {
      shapePoint.x += 0.6 / index * cos(index * 2.5 * shapePoint.y + time);
      shapePoint.y += 0.6 / index * cos(index * 1.5 * shapePoint.x + time);
    }

    float density = 0.15 / max(0.001, abs(sin(time - shapePoint.y - shapePoint.x)));
    density = smoothstep(0.02, 1.0, density);
    float threshold = bayer4(centeredPixel / pixelSize) - 0.5;
    float ink = step(0.5, density + threshold);

    gl_FragColor = vec4(uColor, ink);
  }
`

type Rgb = readonly [number, number, number]

type RenderMetrics = {
  width: number
  height: number
  pixelRatio: number
  cellSize: number
}

type StaticFallbackReason = "reduced-motion" | "webgl-unavailable" | "webgl-health" | "context-lost"

type DitherSurface = {
  readonly animated: boolean
  readonly fallbackReason: StaticFallbackReason | null
  /** Performs a one-time output health check; it is never used per frame. */
  readonly probe: () => boolean
  resize: (metrics: RenderMetrics) => void
  draw: (phase: number) => void
  destroy: () => void
}

type HeroDitherCleanup = () => void

const mountedEffects = new WeakMap<HTMLElement, HeroDitherCleanup>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function cssTokenColor(element: HTMLElement, property: string, fallback: string): string {
  const value = element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue(property).trim()
  return value || fallback
}

function createCanvas(documentRef: Document): HTMLCanvasElement {
  const canvas = documentRef.createElement("canvas")
  canvas.className = "hero-lead-dither-canvas"
  canvas.setAttribute("aria-hidden", "true")
  canvas.dataset.siabHeroDitherCanvas = "true"
  return canvas
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  return program
}

function parseRgbColor(value: string): Rgb | null {
  const match = value.match(/^rgba?\(([^)]+)\)$/i)
  if (!match?.[1]) return null

  const channels = match[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3)
  if (channels.length !== 3) return null

  const parsed = channels.map((channel) => {
    const number = Number.parseFloat(channel)
    if (!Number.isFinite(number)) return null
    return channel.endsWith("%") ? number / 100 : number / 255
  })

  if (parsed.some((channel) => channel == null)) return null
  return parsed.map((channel) => clamp(channel ?? 0, 0, 1)) as [number, number, number]
}

function cssColorToRgb(value: string, element: HTMLElement, fallback: Rgb): Rgb {
  // Resolve through the browser's CSS engine first. This avoids a synchronous
  // canvas readback on mobile GPUs for the normal hex/rgb theme tokens.
  const probe = element.ownerDocument.createElement("span")
  probe.style.color = value
  if (probe.style.color) {
    element.append(probe)
    const resolved = element.ownerDocument.defaultView?.getComputedStyle(probe).color ?? ""
    probe.remove()
    const parsed = parseRgbColor(resolved)
    if (parsed) return parsed
  }

  // A few older engines serialize wide-gamut color functions without an rgb()
  // representation. Keep a one-pixel canvas fallback for those tokens only;
  // the common path above does not invoke readback and is safe for mobile.
  const colorProbe = element.ownerDocument.createElement("canvas")
  colorProbe.width = 1
  colorProbe.height = 1
  const context = colorProbe.getContext("2d")
  if (!context) return fallback
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)

  const pixel = context.getImageData(0, 0, 1, 1).data
  if (pixel[3] === 0) return fallback
  return [
    (pixel[0] ?? 0) / 255,
    (pixel[1] ?? 0) / 255,
    (pixel[2] ?? 0) / 255,
  ]
}

function createWebglSurface(canvas: HTMLCanvasElement, wrapper: HTMLElement): DitherSurface | null {
  let gl: WebGLRenderingContext | null = null
  let renderer = "webgl"
  try {
    const webgl2 = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    })
    gl = webgl2 ?? canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    })
    renderer = webgl2 ? "webgl2" : "webgl"
  } catch {
    return null
  }
  if (!gl) return null
  const renderContext = gl

  const program = createProgram(gl)
  const buffer = gl.createBuffer()
  const positionLocation = program ? gl.getAttribLocation(program, "aPosition") : -1
  if (!program || !buffer || positionLocation < 0) {
    if (buffer) gl.deleteBuffer(buffer)
    if (program) gl.deleteProgram(program)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )
  gl.useProgram(program)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  const resolutionLocation = gl.getUniformLocation(program, "uResolution")
  const timeLocation = gl.getUniformLocation(program, "uTime")
  const pixelSizeLocation = gl.getUniformLocation(program, "uPixelSize")
  const pixelRatioLocation = gl.getUniformLocation(program, "uPixelRatio")
  const colorLocation = gl.getUniformLocation(program, "uColor")
  let metrics: RenderMetrics = { width: 1, height: 1, pixelRatio: 1, cellSize: DITHER_SIZE }
  let previousColor = ""
  let color: Rgb = [0.49, 0.23, 0.88]

  canvas.dataset.siabHeroDitherRenderer = renderer
  canvas.dataset.siabHeroDitherStatus = "animated"
  wrapper.dataset.siabHeroDitherStatus = "animated"

  function hasVisibleFrame(): boolean {
    if (renderContext.isContextLost()) return false

    const probeSize = Math.min(64, metrics.width, metrics.height)
    const probeX = Math.max(0, Math.floor((metrics.width - probeSize) / 2))
    const probeY = Math.max(0, Math.floor((metrics.height - probeSize) / 2))
    const pixels = new Uint8Array(probeSize * probeSize * 4)

    try {
      // This is deliberately a single post-draw probe. Reading pixels on every
      // animation frame would force a GPU/CPU sync and defeat the mobile-safe
      // rendering path.
      renderContext.flush()
      renderContext.readPixels(probeX, probeY, probeSize, probeSize, renderContext.RGBA, renderContext.UNSIGNED_BYTE, pixels)
      if (renderContext.getError() !== renderContext.NO_ERROR) return false
    } catch {
      return false
    }

    for (let index = 3; index < pixels.length; index += 4) {
      if ((pixels[index] ?? 0) > 0) return true
    }
    return false
  }

  return {
    animated: true,
    fallbackReason: null,
    probe: hasVisibleFrame,
    resize(nextMetrics) {
      metrics = nextMetrics
      canvas.width = metrics.width
      canvas.height = metrics.height
      gl.viewport(0, 0, metrics.width, metrics.height)
    },
    draw(phase) {
      const nextColor = cssTokenColor(wrapper, "--primary", "#7c3aed")
      if (nextColor !== previousColor) {
        previousColor = nextColor
        color = cssColorToRgb(nextColor, wrapper, color)
      }

      gl.viewport(0, 0, metrics.width, metrics.height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      gl.uniform2f(resolutionLocation, metrics.width, metrics.height)
      gl.uniform1f(timeLocation, phase)
      gl.uniform1f(pixelSizeLocation, metrics.cellSize)
      gl.uniform1f(pixelRatioLocation, metrics.pixelRatio)
      gl.uniform3f(colorLocation, color[0], color[1], color[2])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    destroy() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function ditherThreshold(cellX: number, cellY: number): number {
  const x = Math.floor(positiveModulo(cellX, 4))
  const y = Math.floor(positiveModulo(cellY, 4))
  return (BAYER_4X4[y * 4 + x] ?? 0) / 16 - 0.5
}

/**
 * CPU equivalent of the WebGL fragment field. It is used only for the
 * one-frame fallback, so unsupported or reduced-motion devices retain the
 * same artwork instead of receiving a separate generic dot pattern.
 */
function ditherDensity(pointX: number, pointY: number, phase: number): number {
  let shapeX = pointX * 0.003
  let shapeY = pointY * 0.003
  const time = phase * DITHER_TIME_SCALE

  for (let index = 1; index < 6; index += 1) {
    shapeX += 0.6 / index * Math.cos(index * 2.5 * shapeY + time)
    shapeY += 0.6 / index * Math.cos(index * 1.5 * shapeX + time)
  }

  return smoothstep(0.02, 1, 0.15 / Math.max(0.001, Math.abs(Math.sin(time - shapeY - shapeX))))
}

function drawCanvasDither(
  context: CanvasRenderingContext2D,
  wrapper: HTMLElement,
  metrics: RenderMetrics,
  phase: number,
) {
  context.clearRect(0, 0, metrics.width, metrics.height)
  context.fillStyle = cssTokenColor(wrapper, "--primary", "#7c3aed")
  context.imageSmoothingEnabled = false

  const cellSize = Math.max(metrics.cellSize, 1)
  const columns = Math.ceil(metrics.width / cellSize)
  const rows = Math.ceil(metrics.height / cellSize)
  const pixelRatio = Math.max(metrics.pixelRatio, 0.75)

  for (let row = 0; row < rows; row += 1) {
    const y = row * cellSize
    const sampleY = Math.min(metrics.height - 0.5, y + cellSize * 0.5)
    const glY = metrics.height - sampleY
    const pointY = (glY - 0.5 * metrics.height) / pixelRatio

    for (let column = 0; column < columns; column += 1) {
      const x = column * cellSize
      const sampleX = Math.min(metrics.width - 0.5, x + cellSize * 0.5)
      const pointX = (sampleX - 0.5 * metrics.width) / pixelRatio
      const density = ditherDensity(pointX, pointY, phase)
      const threshold = ditherThreshold(
        (sampleX - 0.5 * metrics.width) / cellSize,
        (glY - 0.5 * metrics.height) / cellSize,
      )

      if (density + threshold >= 0.5) {
        context.fillRect(x, y, Math.min(cellSize, metrics.width - x), Math.min(cellSize, metrics.height - y))
      }
    }
  }
}

function createStaticCanvasSurface(
  canvas: HTMLCanvasElement,
  wrapper: HTMLElement,
  fallbackReason: StaticFallbackReason,
): DitherSurface | null {
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true })
  if (!context) return null

  let metrics: RenderMetrics = { width: 1, height: 1, pixelRatio: 1, cellSize: DITHER_SIZE }
  canvas.dataset.siabHeroDitherRenderer = "static"
  canvas.dataset.siabHeroDitherStatus = fallbackReason
  wrapper.dataset.siabHeroDitherStatus = fallbackReason

  return {
    animated: false,
    fallbackReason,
    probe: () => true,
    resize(nextMetrics) {
      metrics = nextMetrics
      canvas.width = metrics.width
      canvas.height = metrics.height
    },
    draw(phase) {
      drawCanvasDither(context, wrapper, metrics, phase)
    },
    destroy() {
      canvas.width = 0
      canvas.height = 0
    },
  }
}

function renderMetrics(wrapper: HTMLElement, windowRef: Window): RenderMetrics {
  const bounds = wrapper.getBoundingClientRect()
  const cssWidth = Math.max(1, bounds.width)
  const cssHeight = Math.max(1, bounds.height)
  const requestedPixelRatio = clamp(windowRef.devicePixelRatio || 1, 1, MAX_DEVICE_PIXEL_RATIO)
  const pixelLimitRatio = Math.sqrt(MAX_RENDER_PIXELS / (cssWidth * cssHeight))
  const pixelRatio = Math.min(requestedPixelRatio, Math.max(0.75, pixelLimitRatio))

  return {
    width: Math.max(1, Math.round(cssWidth * pixelRatio)),
    height: Math.max(1, Math.round(cssHeight * pixelRatio)),
    pixelRatio,
    cellSize: DITHER_SIZE * pixelRatio,
  }
}

function mountHeroDitherEffect(wrapper: HTMLElement): HeroDitherCleanup | null {
  const view = wrapper.ownerDocument.defaultView
  if (!view) return null
  const windowRef = view

  const motionQuery = windowRef.matchMedia("(prefers-reduced-motion: reduce)")
  const hoverTarget = wrapper.closest<HTMLElement>("[data-siab-effect-hover-target], [data-siab-hero-design]") ?? wrapper
  let canvas = createCanvas(wrapper.ownerDocument)
  let surface: DitherSurface | null = null
  let metrics = renderMetrics(wrapper, windowRef)
  let animationFrame: number | null = null
  let lastFrameTime = -Infinity
  let lastAnimationTimestamp: number | null = null
  let phase = 0
  let destroyed = false
  let hovered = false
  let animationSpeed = IDLE_SPEED
  let contextLostHandler: ((event: Event) => void) | null = null

  const themeObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => surface?.draw(phase))
  const themeRoots = [
    wrapper.ownerDocument.documentElement,
    wrapper.closest<HTMLElement>(".rt-canvas"),
  ].filter((root, index, roots): root is HTMLElement => Boolean(root) && roots.indexOf(root) === index)

  function stopAnimation() {
    if (animationFrame != null) windowRef.cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  function removeContextLostListener() {
    if (contextLostHandler) canvas.removeEventListener("webglcontextlost", contextLostHandler)
    contextLostHandler = null
  }

  function resize() {
    metrics = renderMetrics(wrapper, windowRef)
    surface?.resize(metrics)
    surface?.draw(phase)
  }

  function activateStatic(fallbackReason: StaticFallbackReason) {
    stopAnimation()
    removeContextLostListener()
    surface?.destroy()
    canvas.remove()
    canvas = createCanvas(wrapper.ownerDocument)
    wrapper.append(canvas)
    surface = createStaticCanvasSurface(canvas, wrapper, fallbackReason)
    if (!surface) {
      canvas.remove()
      return
    }
    resize()
  }

  function onContextLost(event: Event) {
    event.preventDefault()
    activateStatic("context-lost")
  }

  function activateWebgl() {
    stopAnimation()
    removeContextLostListener()
    surface?.destroy()
    canvas.remove()
    canvas = createCanvas(wrapper.ownerDocument)
    wrapper.append(canvas)
    surface = createWebglSurface(canvas, wrapper)

    if (!surface) {
      activateStatic("webgl-unavailable")
      return
    }

    contextLostHandler = onContextLost
    canvas.addEventListener("webglcontextlost", contextLostHandler)
    resize()
    if (!surface.probe()) {
      activateStatic("webgl-health")
      return
    }
    start()
  }

  function advance(timestamp: number) {
    if (lastAnimationTimestamp === null) {
      lastAnimationTimestamp = timestamp
      return
    }

    const elapsed = clamp((timestamp - lastAnimationTimestamp) / 1000, 0, 0.1)
    const targetSpeed = hovered ? HOVER_SPEED : IDLE_SPEED
    const response = clamp(elapsed / SPEED_RESPONSE_SECONDS, 0, 1)
    animationSpeed += (targetSpeed - animationSpeed) * response
    phase += elapsed * animationSpeed
    lastAnimationTimestamp = timestamp
  }

  function animate(timestamp: number) {
    if (destroyed || !surface?.animated) return
    if (timestamp - lastFrameTime >= TARGET_FRAME_MS) {
      lastFrameTime = timestamp
      advance(timestamp)
      surface.draw(phase)
    }
    animationFrame = windowRef.requestAnimationFrame(animate)
  }

  function start() {
    stopAnimation()
    lastFrameTime = -Infinity
    lastAnimationTimestamp = null
    surface?.draw(phase)
    if (surface?.animated && !motionQuery.matches) {
      animationFrame = windowRef.requestAnimationFrame(animate)
    }
  }

  function onMotionPreferenceChange() {
    if (motionQuery.matches) {
      if (surface?.animated) activateStatic("reduced-motion")
      else start()
      return
    }

    if (surface?.fallbackReason === "reduced-motion") {
      activateWebgl()
      return
    }
    start()
  }

  function onPointerEnter() {
    hovered = true
  }

  function onPointerLeave() {
    hovered = false
  }

  hoverTarget.addEventListener("pointerenter", onPointerEnter)
  hoverTarget.addEventListener("pointerleave", onPointerLeave)
  windowRef.addEventListener("resize", resize)
  motionQuery.addEventListener("change", onMotionPreferenceChange)
  for (const root of themeRoots) {
    themeObserver?.observe(root, {
      attributes: true,
      attributeFilter: ["data-rt-mode", "data-siab-color-mode", "data-theme-color", "data-theme-shape", "style"],
    })
  }

  let resizeObserver: ResizeObserver | null = null
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(wrapper)
  }

  if (motionQuery.matches) activateStatic("reduced-motion")
  else activateWebgl()

  return () => {
    destroyed = true
    stopAnimation()
    resizeObserver?.disconnect()
    themeObserver?.disconnect()
    windowRef.removeEventListener("resize", resize)
    motionQuery.removeEventListener("change", onMotionPreferenceChange)
    removeContextLostListener()
    hoverTarget.removeEventListener("pointerenter", onPointerEnter)
    hoverTarget.removeEventListener("pointerleave", onPointerLeave)
    surface?.destroy()
    canvas.remove()
  }
}

function elementsForRoot(root: ParentNode): HTMLElement[] {
  const elements: HTMLElement[] = []
  if (root instanceof HTMLElement && root.matches(HERO_DITHER_SELECTOR)) elements.push(root)
  elements.push(...Array.from(root.querySelectorAll<HTMLElement>(HERO_DITHER_SELECTOR)))
  return elements
}

/** Mounts the shared dither effect in static public pages and CMS preview frames. */
export function initializeHeroDitherEffects(root: ParentNode = document): HeroDitherCleanup {
  const cleanups: HeroDitherCleanup[] = []

  for (const element of elementsForRoot(root)) {
    if (mountedEffects.has(element)) continue
    const cleanup = mountHeroDitherEffect(element)
    if (!cleanup) continue
    mountedEffects.set(element, cleanup)
    cleanups.push(() => {
      cleanup()
      if (mountedEffects.get(element) === cleanup) mountedEffects.delete(element)
    })
  }

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
