import * as React from "react"
import type { MediaRef } from "@siteinabox/contracts"
import { useProviderBlockModel } from "./content"

type ProviderMediaSource = { src: string; width?: number; height?: number; __providerMedia?: { value?: MediaRef; field: string; itemIndex: number; subField: string; alt: string } }

type ImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | ProviderMediaSource
  fill?: boolean
  priority?: boolean
}

const transparentSquare = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E"

export default function Image({ src, fill = false, priority, loading, style, ...props }: ImageProps) {
  const model = useProviderBlockModel()
  const binding = typeof src === "object" ? src.__providerMedia : undefined
  if (model && binding && model.options.editSlots?.renderImage) {
    const fillClasses = fill ? "absolute inset-0 h-full w-full" : ""
    return model.options.editSlots.renderImage({
      name: `${model.block.blockType}.${binding.field}`,
      value: binding.value,
      alt: binding.alt,
      className: [fillClasses, props.className].filter(Boolean).join(" "),
      loading: priority ? "eager" : loading ?? "lazy",
      elementPath: { blockIndex: model.options.index, field: binding.field, itemIndex: binding.itemIndex, subField: binding.subField },
    })
  }
  const rawValue = typeof src === "string" ? src : src?.src ?? transparentSquare
  const value = rawValue.startsWith("about:blank") ? transparentSquare : rawValue
  const width = props.width ?? (typeof src === "object" ? src.width : undefined)
  const height = props.height ?? (typeof src === "object" ? src.height : undefined)
  const fillStyle = fill
    ? { position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent", ...style } as React.CSSProperties
    : style
  return <img {...props} alt={binding?.alt ?? props.alt ?? ""} src={value} width={fill ? undefined : width} height={fill ? undefined : height} style={fillStyle} loading={priority ? "eager" : loading ?? "lazy"} decoding={props.decoding ?? "async"} />
}
