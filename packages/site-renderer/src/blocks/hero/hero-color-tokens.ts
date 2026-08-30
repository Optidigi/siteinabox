export type HeroShaderRgb = readonly [number, number, number]

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseRgbColor(value: string): HeroShaderRgb | null {
  const normalized = value.trim()
  const hex = normalized.match(/^#([\da-f]{3,8})$/i)?.[1]
  if (hex) {
    const expanded = hex.length === 3 || hex.length === 4
      ? hex.split("").map((channel) => `${channel}${channel}`).join("")
      : hex
    if (expanded.length === 6 || expanded.length === 8) {
      return [
        Number.parseInt(expanded.slice(0, 2), 16) / 255,
        Number.parseInt(expanded.slice(2, 4), 16) / 255,
        Number.parseInt(expanded.slice(4, 6), 16) / 255,
      ]
    }
  }

  const channels = normalized.match(/^rgba?\(([^)]+)\)$/i)?.[1]
    ?.split(/[\s,\/]+/)
    .filter(Boolean)
    .slice(0, 3)
  if (!channels || channels.length !== 3) return null

  const parsed = channels.map((channel) => {
    const number = Number.parseFloat(channel)
    if (!Number.isFinite(number)) return null
    return channel.endsWith("%") ? number / 100 : number / 255
  })

  if (parsed.some((channel) => channel == null)) return null
  return parsed.map((channel) => clamp(channel ?? 0, 0, 1)) as [number, number, number]
}

export function cssColorToRgb(value: string, wrapper: HTMLElement, fallback: HeroShaderRgb): HeroShaderRgb {
  const direct = parseRgbColor(value)
  if (direct) return direct

  // Let the browser resolve OKLCH, color-mix(), and custom color functions.
  // This runs only when a theme is read or changes, never once per frame.
  const probe = wrapper.ownerDocument.createElement("span")
  probe.style.color = value
  if (probe.style.color) {
    wrapper.append(probe)
    const resolved = wrapper.ownerDocument.defaultView?.getComputedStyle(probe).color ?? ""
    probe.remove()
    const parsed = parseRgbColor(resolved)
    if (parsed) return parsed
  }

  // Older engines may keep wide-gamut values in a non-rgb serialization. The
  // 1x1 canvas path is also event-driven, so it cannot add frame-time work.
  const colorCanvas = wrapper.ownerDocument.createElement("canvas")
  colorCanvas.width = 1
  colorCanvas.height = 1
  const context = colorCanvas.getContext("2d")
  if (!context) return fallback
  const previousFill = context.fillStyle
  context.fillStyle = value
  if (context.fillStyle === previousFill && value !== "#000000" && value !== "#000") return fallback
  context.clearRect(0, 0, 1, 1)
  context.fillRect(0, 0, 1, 1)
  const pixel = context.getImageData(0, 0, 1, 1).data
  if (pixel[3] === 0) return fallback
  return [
    (pixel[0] ?? 0) / 255,
    (pixel[1] ?? 0) / 255,
    (pixel[2] ?? 0) / 255,
  ]
}

export function readTokenColor(wrapper: HTMLElement, property: string, fallback: HeroShaderRgb): HeroShaderRgb {
  const value = wrapper.ownerDocument.defaultView?.getComputedStyle(wrapper).getPropertyValue(property).trim() ?? ""
  return value ? cssColorToRgb(value, wrapper, fallback) : fallback
}

export function mixRgb(first: HeroShaderRgb, second: HeroShaderRgb, amount: number): HeroShaderRgb {
  const ratio = clamp(amount, 0, 1)
  return [
    first[0] + (second[0] - first[0]) * ratio,
    first[1] + (second[1] - first[1]) * ratio,
    first[2] + (second[2] - first[2]) * ratio,
  ]
}
