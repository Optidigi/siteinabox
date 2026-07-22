"use client"

import * as React from "react"
import type { BlockEditSlots, RendererElementPath } from "@siteinabox/site-renderer"
import { RichTextRenderer, defaultMediaResolver } from "@siteinabox/site-renderer"

const fieldSelectAttributes = (path: RendererElementPath) => ({
  "data-siab-field": path.field,
  ...(path.itemIndex != null ? { "data-siab-item-index": String(path.itemIndex) } : {}),
  ...(path.subField ? { "data-siab-sub-field": path.subField } : {}),
})

/**
 * Editor-frame-only BlockEditSlots: wrap live renderer output with
 * `data-siab-field` markers so canvas clicks can deep-link the inspector.
 * Does not enable inline editing — select + preview only.
 */
export function createEditorSelectSlots(): BlockEditSlots {
  return {
    renderRichText: (props) => {
      const Tag = (props.as ?? (props.variant === "block" ? "div" : "span")) as "div" | "span"
      // Prefer a real box over `contents` so click hit-testing + closest() stay reliable.
      const className = props.className === "contents" ? undefined : props.className
      return (
        <Tag className={className} {...fieldSelectAttributes(props.elementPath)}>
          {props.value ? (
            <RichTextRenderer
              value={props.value}
              blockMode={props.blockMode ?? (props.variant === "inline" ? "inline" : "normal")}
            />
          ) : null}
        </Tag>
      )
    },
    renderCta: (props) => {
      const href = props.value?.href?.trim() ?? ""
      const label = props.value?.label?.trim() ?? ""
      if (!href || !label) {
        return <span {...fieldSelectAttributes(props.elementPath)} />
      }
      // Return a single <a> so Button asChild / Slot wrappers keep working.
      return (
        <a
          href={href}
          className={props.className}
          style={props.style}
          onClick={(event) => event.preventDefault()}
          {...fieldSelectAttributes(props.elementPath)}
        >
          {label}
        </a>
      )
    },
    renderImage: (props) => {
      const resolved = props.value ? defaultMediaResolver(props.value) : null
      if (!resolved?.src) {
        return <span {...fieldSelectAttributes(props.elementPath)} className={props.className} />
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element -- editor select marker wrap
        <img
          src={resolved.src}
          alt={props.alt ?? resolved.alt ?? ""}
          className={props.className}
          loading={props.loading}
          decoding={props.decoding}
          {...fieldSelectAttributes(props.elementPath)}
        />
      )
    },
    renderText: (props) => (
      <span className={props.className === "contents" ? undefined : props.className} {...fieldSelectAttributes(props.elementPath)}>
        {props.value ?? props.placeholder ?? null}
      </span>
    ),
    renderIcon: (props) => {
      const Icon = props.icon
      return (
        <span
          className={props.triggerClassName === "contents" ? undefined : props.triggerClassName}
          {...fieldSelectAttributes(props.elementPath)}
        >
          {Icon ? (
            <Icon
              className={props.className}
              size={props.size}
              strokeWidth={props.strokeWidth}
              aria-hidden
            />
          ) : null}
        </span>
      )
    },
  }
}
