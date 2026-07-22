/** @vitest-environment jsdom */
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { RtRoot } from "@siteinabox/contracts"
import { createEditorSelectSlots } from "@/lib/editor/createEditorSelectSlots"

const rt: RtRoot = {
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: "Hello field" }],
}

describe("createEditorSelectSlots", () => {
  it("emits data-siab-field on rich text, cta, and image slots", () => {
    const slots = createEditorSelectSlots()

    const rich = renderToStaticMarkup(
      <>
        {slots.renderRichText?.({
          name: "hero.headline",
          value: rt,
          variant: "inline",
          as: "span",
          elementPath: { blockIndex: 0, field: "headline" },
        })}
      </>,
    )
    expect(rich).toContain('data-siab-field="headline"')
    expect(rich).toContain("Hello field")

    const cta = renderToStaticMarkup(
      <>
        {slots.renderCta?.({
          name: "hero.cta",
          value: { label: "Book", href: "/book" },
          elementPath: { blockIndex: 0, field: "cta" },
        })}
      </>,
    )
    expect(cta).toContain('data-siab-field="cta"')
    expect(cta).toContain("Book")
    expect(cta).toContain('href="/book"')

    const image = renderToStaticMarkup(
      <>
        {slots.renderImage?.({
          name: "hero.image",
          value: { url: "https://example.test/a.jpg", alt: "Alt" },
          elementPath: { blockIndex: 1, field: "image", itemIndex: 2 },
        })}
      </>,
    )
    expect(image).toContain('data-siab-field="image"')
    expect(image).toContain('data-siab-item-index="2"')
    expect(image).toContain("https://example.test/a.jpg")
  })

  it("emits data-siab-field on icon slots", () => {
    const slots = createEditorSelectSlots()
    const Icon = (props: { className?: string }) => <svg className={props.className} data-testid="icon" />
    const icon = renderToStaticMarkup(
      <>
        {slots.renderIcon?.({
          name: "featureList.features.icon",
          value: "heart",
          icon: Icon as never,
          className: "size-5",
          elementPath: { blockIndex: 0, field: "features", itemIndex: 1, subField: "icon" },
        })}
      </>,
    )
    expect(icon).toContain('data-siab-field="features"')
    expect(icon).toContain('data-siab-item-index="1"')
    expect(icon).toContain('data-siab-sub-field="icon"')
    expect(icon).toContain("size-5")
  })
})
