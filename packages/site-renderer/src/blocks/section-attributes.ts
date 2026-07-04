import * as React from "react"
import { cn } from "@siteinabox/ui/lib/utils"
import type { RendererSectionAttributes } from "./types"

function mergeSyntheticEventHandlers<Event extends React.SyntheticEvent>(
  first?: (event: Event) => void,
  second?: (event: Event) => void,
) {
  if (!first) return second
  if (!second) return first
  return (event: Event) => {
    first(event)
    second(event)
  }
}

export function mergeRendererSectionAttributes(
  base: RendererSectionAttributes,
  extra?: RendererSectionAttributes,
): RendererSectionAttributes {
  if (!extra) return base

  const {
    className: baseClassName,
    onClick: baseOnClick,
    onMouseEnter: baseOnMouseEnter,
    onMouseLeave: baseOnMouseLeave,
    onFocusCapture: baseOnFocusCapture,
    onBlurCapture: baseOnBlurCapture,
    ...baseRest
  } = base
  const {
    className: extraClassName,
    onClick: extraOnClick,
    onMouseEnter: extraOnMouseEnter,
    onMouseLeave: extraOnMouseLeave,
    onFocusCapture: extraOnFocusCapture,
    onBlurCapture: extraBlurCapture,
    ...extraRest
  } = extra

  return {
    ...extraRest,
    ...baseRest,
    className: cn(baseClassName, extraClassName),
    onClick: extraOnClick ?? baseOnClick,
    onMouseEnter: mergeSyntheticEventHandlers(baseOnMouseEnter, extraOnMouseEnter),
    onMouseLeave: mergeSyntheticEventHandlers(baseOnMouseLeave, extraOnMouseLeave),
    onFocusCapture: mergeSyntheticEventHandlers(baseOnFocusCapture, extraOnFocusCapture),
    onBlurCapture: mergeSyntheticEventHandlers(baseOnBlurCapture, extraBlurCapture),
  }
}
