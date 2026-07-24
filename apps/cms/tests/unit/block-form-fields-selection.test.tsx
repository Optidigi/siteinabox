/** @vitest-environment jsdom */
import * as React from "react"
import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FormProvider, useForm } from "react-hook-form"
import type { RtManifest } from "@/lib/richText/manifest"
import { BlockFormFields } from "@/components/editor/fields/block-form-fields"

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key
    translate.has = () => false
    return translate
  },
}))

vi.mock("@/components/editor/richText/LexicalField", () => ({
  LexicalField: () => <div data-testid="lexical-field" />,
}))

const manifest = {
  version: 1,
  inlineMarks: {},
  blockTypes: { paragraph: true },
  blocks: [{
    slug: "hero",
    fields: [{ name: "headline", label: "Headline", kind: "text" }],
  }],
} satisfies RtManifest

const block = {
  id: "hero-1",
  blockType: "hero",
  designVariant: "shadcnui-blocks.hero-01",
  headline: {
    t: "root",
    variant: "inline",
    children: [{ t: "text", v: "Hello" }],
  },
} as const

function Inspector({
  blockIndex,
  revealHighlight,
}: {
  blockIndex: number
  revealHighlight: boolean
}) {
  const form = useForm({
    defaultValues: {
      blocks: [block, block],
    },
  })
  return (
    <FormProvider {...form}>
      <div data-testid="inspector-scroll-root">
        <BlockFormFields
          block={block}
          blockIndex={blockIndex}
          manifest={manifest}
          highlightPath={{ blockIndex, field: "headline" }}
          revealHighlight={revealHighlight}
        />
      </div>
    </FormProvider>
  )
}

describe("BlockFormFields canvas selection highlighting", () => {
  const scrolled: Element[] = []
  const scrollOptions: Array<ScrollIntoViewOptions | boolean | undefined> = []

  beforeEach(() => {
    scrolled.length = 0
    scrollOptions.length = 0
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(function (
        this: Element,
        options?: ScrollIntoViewOptions | boolean,
      ) {
        scrolled.push(this)
        scrollOptions.push(options)
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("highlights without scrolling for canvas origin and still reveals parent origin", async () => {
    const { container, rerender } = render(<Inspector blockIndex={0} revealHighlight />)
    await waitFor(() => expect(scrolled).toHaveLength(1))
    expect(scrollOptions).toEqual([{ behavior: "smooth", block: "center" }])

    const inspectorRoot = container.querySelector<HTMLElement>("[data-testid=inspector-scroll-root]")!
    inspectorRoot.scrollTop = 31
    document.documentElement.scrollTop = 47
    scrolled.length = 0
    scrollOptions.length = 0

    rerender(<Inspector blockIndex={1} revealHighlight={false} />)

    await waitFor(() => {
      expect(container.querySelector('[data-siab-inspector-field-selected="true"]')).toBeTruthy()
    })
    expect(scrolled).toEqual([])
    expect(scrollOptions).toEqual([])
    expect(inspectorRoot.scrollTop).toBe(31)
    expect(document.documentElement.scrollTop).toBe(47)
  })
})
