import * as React from "react"

type ImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string; width?: number; height?: number }
  fill?: boolean
  priority?: boolean
}

export default function Image({ src, fill: _fill, priority, loading, ...props }: ImageProps) {
  const rawValue = typeof src === "string" ? src : src.src
  const value = rawValue.startsWith("about:blank") ? "data:image/gif;base64,R0lGODlhAQABAAAAACw=" : rawValue
  const width = props.width ?? (typeof src === "object" ? src.width : undefined)
  const height = props.height ?? (typeof src === "object" ? src.height : undefined)
  return <img {...props} src={value} width={width} height={height} loading={priority ? "eager" : loading ?? "lazy"} decoding={props.decoding ?? "async"} />
}
