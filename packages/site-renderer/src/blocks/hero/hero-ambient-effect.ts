/*
 * The field recipe is adapted from the public Flavers static-mesh shader by
 * Nicolas Pelletier and the Paper Shaders static mesh gradient reference:
 * https://21st.dev/@nicolassalok1/components/flavers
 * https://shaders.paper.design/static-mesh-gradient
 * The adapted shader logic is released under Apache-2.0 by Paper Design:
 * https://github.com/paper-design/shaders
 *
 * The Sitegen runtime, token palette, and WebGL lifecycle are owned here
 * so the effect remains theme-aware and safe in preview/public rendering
 * without adding a shader dependency.
 */

import { clamp, readTokenColor, type HeroShaderRgb } from "./hero-color-tokens"

const HERO_AMBIENT_SELECTOR = "[data-siab-hero-ambient-effect]"
const AMBIENT_TARGET_FPS = 30
const AMBIENT_FRAME_MS = 1000 / AMBIENT_TARGET_FPS
const MAX_DEVICE_PIXEL_RATIO = 2
const MAX_RENDER_PIXELS = 2_000_000

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER_SOURCE = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec3 uColors[8];
  uniform vec4 uScene; // resolution.xy, time, color count
  uniform vec4 uShape; // scale, intensity, paramA, warp
  uniform vec4 uSurface; // detail, contrast, brightness, saturation
  uniform vec4 uFinish; // hue, vignette, blur, grain
  uniform vec4 uTransform; // seed, rotation, drift, OKLab toggle
  uniform vec4 uSpace; // offset.xy, pointer.xy
  uniform vec4 uCursor; // presence, effect, strength, radius

  #define uResolution uScene.xy
  #define uTime uScene.z
  #define uColorCount uScene.w
  #define uScale uShape.x
  #define uIntensity uShape.y
  #define uParamA uShape.z
  #define uWarp uShape.w
  #define uDetail uSurface.x
  #define uContrast uSurface.y
  #define uBrightness uSurface.z
  #define uSaturation uSurface.w
  #define uHue uFinish.x
  #define uVignette uFinish.y
  #define uBlur uFinish.z
  #define uGrain uFinish.w
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  #define uSeed uTransform.x
  #else
  #define uSeed mod(uTransform.x, 31.0)
  #endif
  #define uRotate uTransform.y
  #define uDrift uTransform.z
  #define uOklab uTransform.w
  #define uOffset uSpace.xy
  #define uMouse uSpace.zw
  #define uCursorPresence uCursor.x
  #define uCursorEffect uCursor.y
  #define uCursorStrength uCursor.z
  #define uCursorRadius uCursor.w

  float hash21(vec2 point) {
    #ifndef GL_FRAGMENT_PRECISION_HIGH
    point = mod(point, 31.0);
    #endif
    point = fract(point * vec2(234.34, 435.345));
    point += dot(point, point + 34.23);
    return fract(point.x * point.y);
  }

  vec2 hash22(vec2 point) {
    #ifndef GL_FRAGMENT_PRECISION_HIGH
    point = mod(point, 31.0);
    #endif
    float value = sin(dot(point, vec2(41.0, 289.0)));
    return fract(vec2(15731.743, 7892.321) * value);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 smoothLocal = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), smoothLocal.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), smoothLocal.x),
      smoothLocal.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int index = 0; index < 5; index += 1) {
      value += amplitude * noise(point);
      point = point * 2.03 + vec2(17.0, 9.2);
      amplitude *= 0.5;
    }

    return value;
  }

  float grainHash(vec2 point) {
    vec3 point3 = fract(vec3(point.xyx) * 0.1031);
    point3 += dot(point3, point3.yzx + 33.33);
    return fract((point3.x + point3.y) * point3.z);
  }

  vec3 shade(vec2 uv, vec2 point, float time) {
    vec3 color = uColors[0] * 0.2;
    float weight = 0.2;

    for (int index = 0; index < 8; index += 1) {
      if (float(index) >= uColorCount) break;
      float colorIndex = float(index);
      vec2 center = (hash22(vec2(colorIndex, uSeed)) - 0.5) * (0.7 + uIntensity * 1.4);
      float influence = exp(-dot(point - center, point - center) * mix(13.0, 2.0, uParamA));
      color += uColors[index] * influence;
      weight += influence;
    }

    return color / weight;
  }

  vec3 srgbToLinear(vec3 color) {
    return mix(
      color / 12.92,
      pow((color + 0.055) / 1.055, vec3(2.4)),
      step(0.04045, color)
    );
  }

  vec3 linearToSrgb(vec3 color) {
    return mix(
      color * 12.92,
      1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
      step(0.0031308, color)
    );
  }

  vec3 linToOklab(vec3 color) {
    float l = 0.4122214708 * color.r + 0.5363325363 * color.g + 0.0514459929 * color.b;
    float m = 0.2119034982 * color.r + 0.6806995451 * color.g + 0.1073969566 * color.b;
    float s = 0.0883024619 * color.r + 0.2817188376 * color.g + 0.6299787005 * color.b;
    l = pow(max(l, 0.0), 1.0 / 3.0);
    m = pow(max(m, 0.0), 1.0 / 3.0);
    s = pow(max(s, 0.0), 1.0 / 3.0);
    return vec3(
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    );
  }

  vec3 oklabToLin(vec3 color) {
    float l = color.x + 0.3963377774 * color.y + 0.2158037573 * color.z;
    float m = color.x - 0.1055613458 * color.y - 0.0638541728 * color.z;
    float s = color.x - 0.0894841775 * color.y - 1.2914855480 * color.z;
    l = l * l * l;
    m = m * m * m;
    s = s * s * s;
    return vec3(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
  }

  vec3 mixColour(vec3 first, vec3 second, float amount) {
    if (uOklab > 0.5) {
      vec3 firstLab = linToOklab(srgbToLinear(first));
      vec3 secondLab = linToOklab(srgbToLinear(second));
      return clamp(linearToSrgb(oklabToLin(mix(firstLab, secondLab, amount))), 0.0, 1.0);
    }
    return mix(first, second, amount);
  }

  vec3 palette(float value) {
    float count = max(uColorCount - 1.0, 1.0);
    float scaled = clamp(value, 0.0, 1.0) * count;
    vec3 color = uColors[0];
    for (int index = 0; index < 7; index += 1) {
      if (float(index) < count) {
        color = mixColour(
          color,
          uColors[index + 1],
          smoothstep(0.0, 1.0, clamp(scaled - float(index), 0.0, 1.0))
        );
      }
    }
    return color;
  }

  vec3 hueRotate(vec3 color, float angle) {
    const mat3 toYiq = mat3(
      0.299, 0.596, 0.211,
      0.587, -0.274, -0.523,
      0.114, -0.322, 0.312
    );
    const mat3 toRgb = mat3(
      1.0, 1.0, 1.0,
      0.956, -0.272, -1.106,
      0.621, -0.647, 1.703
    );
    vec3 yiq = toYiq * color;
    float cosine = cos(angle);
    float sine = sin(angle);
    yiq = vec3(yiq.x, yiq.y * cosine - yiq.z * sine, yiq.y * sine + yiq.z * cosine);
    return toRgb * yiq;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 screenUv = uv;
    vec2 point = (gl_FragCoord.xy - 0.5 * uResolution.xy)
      / min(uResolution.x, uResolution.y);
    float cursorMask = 0.0;

    if (uCursorPresence > 0.001) {
      vec2 cursor = (0.5 * uMouse * uResolution.xy)
        / min(uResolution.x, uResolution.y);
      vec2 cursorDelta = point - cursor;
      if (uCursorEffect < 0.5) {
        point += cursor * uCursorPresence * uCursorStrength * 0.55;
      } else {
        float cursorDistance = length(cursorDelta);
        vec2 cursorDirection = cursorDelta / max(cursorDistance, 0.0001);
        cursorMask = uCursorPresence
          * (1.0 - smoothstep(0.0, uCursorRadius, cursorDistance));
        if (uCursorEffect < 1.5) {
          point -= cursorDirection * cursorMask * uCursorStrength * 0.24;
        } else if (uCursorEffect < 2.5) {
          float cursorAngle = cursorMask * uCursorStrength * 2.2;
          float cosine = cos(cursorAngle);
          float sine = sin(cursorAngle);
          point = cursor + mat2(cosine, -sine, sine, cosine) * cursorDelta;
        } else if (uCursorEffect < 3.5) {
          float ripple = sin(
            cursorDistance / max(uCursorRadius, 0.001) * 18.0 - uTime * 5.0
          );
          point -= cursorDirection * ripple * cursorMask * uCursorStrength * 0.07;
        }
      }
    }

    uv = point * min(uResolution.x, uResolution.y) / uResolution.xy + 0.5;
    point *= uScale;
    if (abs(uRotate) > 0.0001) {
      float cosine = cos(uRotate);
      float sine = sin(uRotate);
      point = mat2(cosine, -sine, sine, cosine) * point;
    }
    point += uOffset;
    if (uDrift > 0.0001) {
      // The runtime already scales uTime by the profile speed. Keep the
      // shader's motion at unit rate so profile tuning remains predictable
      // instead of becoming an accidental minute-long drift cycle.
      point += uDrift * vec2(sin(uTime), cos(uTime * 0.78));
    }
    if (uWarp > 0.0) {
      point += uWarp * (
        vec2(
          fbm(point * uDetail + uSeed),
          fbm(point * uDetail + vec2(5.2, 1.3))
        ) - 0.5
      );
    }

    vec3 color;
    if (uBlur > 0.0) {
      float edge = uBlur;
      float pixelEdge = edge * uScale;
      vec2 uvEdge = vec2(edge) * min(uResolution.x, uResolution.y) / uResolution.xy;
      color = shade(uv, point, uTime) * 0.36;
      color += shade(uv + vec2(uvEdge.x, 0.0), point + vec2(pixelEdge, 0.0), uTime) * 0.16;
      color += shade(uv - vec2(uvEdge.x, 0.0), point - vec2(pixelEdge, 0.0), uTime) * 0.16;
      color += shade(uv + vec2(0.0, uvEdge.y), point + vec2(0.0, pixelEdge), uTime) * 0.16;
      color += shade(uv - vec2(0.0, uvEdge.y), point - vec2(0.0, pixelEdge), uTime) * 0.16;
    } else {
      color = shade(uv, point, uTime);
    }

    if (abs(uContrast - 1.0) > 0.0001) {
      color = (color - 0.5) * uContrast + 0.5;
    }
    if (abs(uSaturation - 1.0) > 0.0001) {
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, uSaturation);
    }
    if (abs(uHue) > 0.0001) color = hueRotate(color, uHue);
    if (abs(uBrightness) > 0.0001) color += uBrightness;
    if (uVignette > 0.0001) {
      float vignetteDistance = length(screenUv - 0.5) * 1.41421356;
      color *= 1.0 - uVignette * smoothstep(0.35, 1.0, vignetteDistance);
    }
    if (uCursorPresence > 0.001 && uCursorEffect > 3.5) {
      color += (vec3(0.18) + color * 0.12) * cursorMask * uCursorStrength;
    }
    if (uGrain > 0.0001) {
      color += (
        grainHash(gl_FragCoord.xy + vec2(uSeed * 17.0, uSeed * 31.0)) - 0.5
      ) * uGrain;
    }
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

type Rgb = HeroShaderRgb

// The four token slots are populated from the active SIAB theme below. These
// values are only parse fallbacks for browsers that cannot resolve a token
// serialization; they are not a second visual renderer.
const TOKEN_PARSE_FALLBACK_PALETTE = [
  [0.000, 0.000, 0.000],
  [0.122, 0.318, 1.000],
  [0.000, 0.898, 1.000],
  [0.918, 0.992, 1.000],
] as const

const AMBIENT_PROFILES = {
  default: {
    scale: 1.90,
    intensity: 0.95,
    paramA: 0.58,
    warp: 0.30,
    // Speed advances shader time; drift controls the distance of the slow
    // field translation. Keeping these separate makes visual tuning safe.
    speed: 0.50,
    drift: 0.10,
  },
  // Hero 04 is a taller, content-driven composition. A higher shader scale
  // keeps its full-section mesh visually comparable to the shorter heroes.
  framed: {
    scale: 2.75,
    intensity: 0.95,
    paramA: 0.58,
    warp: 0.30,
    speed: 0.50,
    drift: 0.10,
  },
} as const

type AmbientProfile = (typeof AMBIENT_PROFILES)[keyof typeof AMBIENT_PROFILES]

function ambientProfileFor(wrapper: HTMLElement): AmbientProfile {
  const profileId = wrapper.closest<HTMLElement>("[data-siab-hero-ambient-profile]")?.dataset.siabHeroAmbientProfile
  return profileId === "framed" ? AMBIENT_PROFILES.framed : AMBIENT_PROFILES.default
}

type RenderMetrics = {
  width: number
  height: number
  pixelRatio: number
}

type AmbientSurface = {
  readonly interactive: boolean
  readonly probe: () => boolean
  readonly refresh: () => void
  setPointer: (x: number, y: number, presence: number) => void
  resize: (metrics: RenderMetrics) => void
  draw: (time: number) => void
  destroy: () => void
}

type HeroAmbientCleanup = () => void

const mountedEffects = new WeakMap<HTMLElement, HeroAmbientCleanup>()

function createCanvas(documentRef: Document): HTMLCanvasElement {
  const canvas = documentRef.createElement("canvas")
  canvas.className = "hero-ambient-mesh-canvas"
  canvas.setAttribute("aria-hidden", "true")
  canvas.dataset.siabHeroAmbientCanvas = "true"
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

function readPalette(wrapper: HTMLElement): readonly Rgb[] {
  const fallback = TOKEN_PARSE_FALLBACK_PALETTE
  const background = readTokenColor(wrapper, "--background", fallback[0])
  const primary = readTokenColor(wrapper, "--primary", fallback[1])
  const deepAccent = readTokenColor(wrapper, "--siab-accent-700", primary)
  const accent = readTokenColor(wrapper, "--siab-accent-500", primary)
  const highlight = readTokenColor(wrapper, "--siab-accent-300", fallback[3])

  return [background, deepAccent, accent, highlight]
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

function paletteKey(palette: readonly Rgb[]): string {
  return palette.map((color) => color.join(",")).join("|")
}

function createWebglSurface(canvas: HTMLCanvasElement, wrapper: HTMLElement): AmbientSurface | null {
  let gl: WebGLRenderingContext | null = null
  try {
    const webgl2 = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true })
    gl = webgl2 ?? canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true })
  } catch {
    return null
  }
  if (!gl) return null
  const renderContext = gl
  const profile = ambientProfileFor(wrapper)
  const program = createProgram(gl)
  const buffer = gl.createBuffer()
  const positionLocation = program ? gl.getAttribLocation(program, "a_position") : -1
  if (!program || !buffer || positionLocation < 0) {
    if (buffer) gl.deleteBuffer(buffer)
    if (program) gl.deleteProgram(program)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.useProgram(program)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
  gl.clearColor(0, 0, 0, 0)

  const colorsLocation = gl.getUniformLocation(program, "uColors[0]")
  const sceneLocation = gl.getUniformLocation(program, "uScene")
  const shapeLocation = gl.getUniformLocation(program, "uShape")
  const surfaceLocation = gl.getUniformLocation(program, "uSurface")
  const finishLocation = gl.getUniformLocation(program, "uFinish")
  const transformLocation = gl.getUniformLocation(program, "uTransform")
  const spaceLocation = gl.getUniformLocation(program, "uSpace")
  const cursorLocation = gl.getUniformLocation(program, "uCursor")
  if (
    !colorsLocation
    || !sceneLocation
    || !shapeLocation
    || !surfaceLocation
    || !finishLocation
    || !transformLocation
    || !spaceLocation
    || !cursorLocation
  ) {
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    return null
  }

  let metrics: RenderMetrics = { width: 1, height: 1, pixelRatio: 1 }
  let palette: readonly Rgb[] = readPalette(wrapper)
  let lastPaletteKey = paletteKey(palette)
  let pointerX = 0
  let pointerY = 0
  let pointerPresence = 0
  canvas.dataset.siabHeroAmbientRenderer = "webgl"
  canvas.dataset.siabHeroAmbientStatus = "interactive"
  wrapper.dataset.siabHeroAmbientStatus = "interactive"

  function refreshPalette() {
    const nextPalette = readPalette(wrapper)
    const nextKey = paletteKey(nextPalette)
    if (nextKey === lastPaletteKey) return
    palette = nextPalette
    lastPaletteKey = nextKey
  }

  function hasVisibleFrame(): boolean {
    return !renderContext.isContextLost() && renderContext.getError() === renderContext.NO_ERROR
  }

  return {
    interactive: true,
    probe: hasVisibleFrame,
    refresh: refreshPalette,
    setPointer(x, y, presence) {
      pointerX = clamp(x, -1, 1)
      pointerY = clamp(y, -1, 1)
      pointerPresence = clamp(presence, 0, 1)
    },
    resize(nextMetrics) {
      metrics = nextMetrics
      canvas.width = metrics.width
      canvas.height = metrics.height
      gl.viewport(0, 0, metrics.width, metrics.height)
    },
    draw(time) {
      gl.viewport(0, 0, metrics.width, metrics.height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      const shaderPalette = [...palette]
      const lastColor = shaderPalette[shaderPalette.length - 1] ?? [1, 1, 1] as const
      while (shaderPalette.length < 8) shaderPalette.push(lastColor)
      gl.uniform3fv(colorsLocation, new Float32Array(shaderPalette.flatMap((color) => [...color])))
      gl.uniform4f(sceneLocation, metrics.width, metrics.height, time, 4)
      gl.uniform4f(shapeLocation, profile.scale, profile.intensity, profile.paramA, profile.warp)
      gl.uniform4f(surfaceLocation, 3.68, 1.08, 0.00, 1.00)
      gl.uniform4f(finishLocation, 0.00, 0.00, 0.000, 0.10)
      gl.uniform4f(transformLocation, 6769.0, 1.29, profile.drift, 0.0)
      gl.uniform4f(spaceLocation, 0.00, 0.00, pointerX, pointerY)
      gl.uniform4f(cursorLocation, pointerPresence, 2.0, 0.65, 0.46)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    destroy() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
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
  }
}

function mountHeroAmbientEffect(wrapper: HTMLElement): HeroAmbientCleanup | null {
  const view = wrapper.ownerDocument.defaultView
  if (!view) return null
  const windowRef = view
  const documentRef = wrapper.ownerDocument
  const profile = ambientProfileFor(wrapper)
  const motionQuery = windowRef.matchMedia("(prefers-reduced-motion: reduce)")
  const canvas = createCanvas(wrapper.ownerDocument)
  wrapper.append(canvas)

  let surface: AmbientSurface | null = null
  let metrics = renderMetrics(wrapper, windowRef)
  let scheduledRender: number | null = null
  let animationFrame: number | null = null
  let lastDrawTimestamp: number | null = null
  let phase = 0
  let isInViewport = true
  let destroyed = false
  let contextLostHandler: ((event: Event) => void) | null = null
  let intersectionObserver: IntersectionObserver | null = null

  const themeObserver = typeof MutationObserver === "undefined"
    ? null
    : new MutationObserver(() => {
        surface?.refresh()
        drawNow()
      })
  const themeRoots = [
    wrapper.ownerDocument.documentElement,
    wrapper.closest<HTMLElement>(".rt-canvas"),
  ].filter((root, index, roots): root is HTMLElement => Boolean(root) && roots.indexOf(root) === index)

  function cancelScheduledRender() {
    if (scheduledRender != null) windowRef.cancelAnimationFrame(scheduledRender)
    scheduledRender = null
  }

  function stopAnimation() {
    if (animationFrame != null) windowRef.cancelAnimationFrame(animationFrame)
    animationFrame = null
    lastDrawTimestamp = null
  }

  function drawNow() {
    cancelScheduledRender()
    surface?.draw(phase)
  }

  function scheduleInteractiveRender() {
    if (
      destroyed
      || !surface?.interactive
      || animationFrame != null
      || scheduledRender != null
      || documentRef.visibilityState !== "visible"
    ) return

    scheduledRender = windowRef.requestAnimationFrame(() => {
      scheduledRender = null
      if (destroyed || !surface?.interactive || documentRef.visibilityState !== "visible") return
      surface.draw(phase)
    })
  }

  function animate(timestamp: number) {
    if (
      destroyed
      || !surface?.interactive
      || motionQuery.matches
      || documentRef.visibilityState !== "visible"
      || !isInViewport
    ) {
      animationFrame = null
      return
    }

    // Keep the render cadence capped independently from simulation time. The
    // timestamp must represent the last actual draw, not the last RAF callback;
    // otherwise high-refresh displays discard the time spent between skipped
    // draws and make the same effect appear slower.
    if (lastDrawTimestamp === null || timestamp - lastDrawTimestamp >= AMBIENT_FRAME_MS) {
      const elapsed = lastDrawTimestamp === null
        ? 0
        : Math.max((timestamp - lastDrawTimestamp) / 1000, 0)
      lastDrawTimestamp = timestamp
      phase += elapsed * profile.speed
      surface.draw(phase)
    }

    animationFrame = windowRef.requestAnimationFrame(animate)
  }

  function startAnimation() {
    stopAnimation()
    if (
      destroyed
      || !surface?.interactive
      || motionQuery.matches
      || documentRef.visibilityState !== "visible"
      || !isInViewport
    ) {
      surface?.draw(phase)
      return
    }

    surface.draw(phase)
    animationFrame = windowRef.requestAnimationFrame(animate)
  }

  function removeContextLostListener() {
    if (contextLostHandler) canvas.removeEventListener("webglcontextlost", contextLostHandler)
    contextLostHandler = null
  }

  function resize() {
    metrics = renderMetrics(wrapper, windowRef)
    surface?.resize(metrics)
    drawNow()
  }

  function disableAmbient(status: "webgl-unavailable" | "webgl-health" | "context-lost") {
    stopAnimation()
    cancelScheduledRender()
    removeContextLostListener()
    surface?.destroy()
    surface = null
    canvas.remove()
    wrapper.dataset.siabHeroAmbientStatus = status
  }

  function onContextLost(event: Event) {
    event.preventDefault()
    disableAmbient("context-lost")
  }

  function activateWebgl() {
    stopAnimation()
    cancelScheduledRender()
    removeContextLostListener()
    surface?.destroy()
    surface = createWebglSurface(canvas, wrapper)
    if (!surface) {
      disableAmbient("webgl-unavailable")
      return
    }

    contextLostHandler = onContextLost
    canvas.addEventListener("webglcontextlost", contextLostHandler)
    resize()
    if (!surface.probe()) {
      disableAmbient("webgl-health")
      return
    }
    startAnimation()
  }

  function onVisibilityChange() {
    if (documentRef.visibilityState === "visible") startAnimation()
    else stopAnimation()
  }

  function onMotionPreferenceChange() {
    if (motionQuery.matches) {
      stopAnimation()
      drawNow()
      return
    }
    startAnimation()
  }

  function updatePointer(event: PointerEvent, presence: number) {
    const bounds = wrapper.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2
    surface?.setPointer(x, y, presence)
    scheduleInteractiveRender()
  }

  function onPointerEnter(event: PointerEvent) {
    updatePointer(event, 1)
  }

  function onPointerMove(event: PointerEvent) {
    updatePointer(event, 1)
  }

  function onPointerLeave() {
    surface?.setPointer(0, 0, 0)
    scheduleInteractiveRender()
  }

  windowRef.addEventListener("resize", resize)
  documentRef.addEventListener("visibilitychange", onVisibilityChange)
  motionQuery.addEventListener("change", onMotionPreferenceChange)
  wrapper.addEventListener("pointerenter", onPointerEnter)
  wrapper.addEventListener("pointermove", onPointerMove)
  wrapper.addEventListener("pointerleave", onPointerLeave)
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

  if (typeof IntersectionObserver !== "undefined") {
    isInViewport = false
    intersectionObserver = new IntersectionObserver((entries) => {
      isInViewport = entries.some((entry) => entry.isIntersecting)
      if (isInViewport) startAnimation()
      else stopAnimation()
    }, { rootMargin: "120px" })
    intersectionObserver.observe(wrapper)
  }

  activateWebgl()

  return () => {
    destroyed = true
    stopAnimation()
    cancelScheduledRender()
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    themeObserver?.disconnect()
    windowRef.removeEventListener("resize", resize)
    documentRef.removeEventListener("visibilitychange", onVisibilityChange)
    motionQuery.removeEventListener("change", onMotionPreferenceChange)
    wrapper.removeEventListener("pointerenter", onPointerEnter)
    wrapper.removeEventListener("pointermove", onPointerMove)
    wrapper.removeEventListener("pointerleave", onPointerLeave)
    removeContextLostListener()
    surface?.destroy()
    canvas.remove()
  }
}

function elementsForRoot(root: ParentNode): HTMLElement[] {
  const elements: HTMLElement[] = []
  if (root instanceof HTMLElement && root.matches(HERO_AMBIENT_SELECTOR)) elements.push(root)
  elements.push(...Array.from(root.querySelectorAll<HTMLElement>(HERO_AMBIENT_SELECTOR)))
  return elements
}

/** Mounts the Flavers-inspired mesh in public pages and CMS preview frames. */
export function initializeHeroAmbientEffects(root: ParentNode = document): HeroAmbientCleanup {
  const cleanups: HeroAmbientCleanup[] = []

  for (const element of elementsForRoot(root)) {
    if (mountedEffects.has(element)) continue
    const cleanup = mountHeroAmbientEffect(element)
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
