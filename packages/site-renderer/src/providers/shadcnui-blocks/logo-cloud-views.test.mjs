import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { previewInlineText } from "./typed/fixtures.ts"
import {
  logoCloudFamilyCmsLike,
  logoCloudFamilyLong,
  logoCloudFamilyMaxItems,
  logoCloudFamilyMissingImage,
  logoCloudFamilySparse,
  logoCloudFamilyLogo,
} from "./typed/fixtures/logo-cloud-family.ts"
import { LogoCloud01 } from "./variants/logo-cloud-01/logo-cloud.tsx"
import LogoCloud01View from "./variants/logo-cloud-01/view.tsx"
import { LogoCloud02 } from "./variants/logo-cloud-02/logo-cloud.tsx"
import LogoCloud02View from "./variants/logo-cloud-02/view.tsx"
import { LogoCloud03 } from "./variants/logo-cloud-03/logo-cloud.tsx"
import LogoCloud03View from "./variants/logo-cloud-03/view.tsx"
import { LogoCloud04 } from "./variants/logo-cloud-04/logo-cloud.tsx"
import LogoCloud04View from "./variants/logo-cloud-04/view.tsx"
import { LogoCloud05 } from "./variants/logo-cloud-05/logo-cloud.tsx"
import LogoCloud05View from "./variants/logo-cloud-05/view.tsx"
import { LogoCloud06 } from "./variants/logo-cloud-06/logo-cloud.tsx"
import LogoCloud06View from "./variants/logo-cloud-06/view.tsx"
import { LogoCloud07 } from "./variants/logo-cloud-07/logo-cloud.tsx"
import LogoCloud07View from "./variants/logo-cloud-07/view.tsx"
import { LogoCloud08 } from "./variants/logo-cloud-08/logo-cloud.tsx"
import LogoCloud08View from "./variants/logo-cloud-08/view.tsx"
import { LogoCloud09 } from "./variants/logo-cloud-09/logo-cloud.tsx"
import LogoCloud09View from "./variants/logo-cloud-09/view.tsx"
import { LogoCloud10 } from "./variants/logo-cloud-10/logo-cloud.tsx"
import LogoCloud10View from "./variants/logo-cloud-10/view.tsx"
import { LogoCloud11 } from "./variants/logo-cloud-11/logo-cloud.tsx"
import LogoCloud11View from "./variants/logo-cloud-11/view.tsx"
import { LogoCloud12 } from "./variants/logo-cloud-12/logo-cloud.tsx"
import LogoCloud12View from "./variants/logo-cloud-12/view.tsx"
import { LogoCloud13 } from "./variants/logo-cloud-13/logo-cloud.tsx"
import LogoCloud13View from "./variants/logo-cloud-13/view.tsx"
import { LogoCloud14 } from "./variants/logo-cloud-14/logo-cloud.tsx"
import LogoCloud14View from "./variants/logo-cloud-14/view.tsx"
import { LogoCloud15 } from "./variants/logo-cloud-15/logo-cloud.tsx"
import LogoCloud15View from "./variants/logo-cloud-15/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const logoCloudFamily = [
  {
    id: "shadcnui-blocks.logo-cloud-01",
    Component: LogoCloud01,
    View: LogoCloud01View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 4,
    distinctive: /gap-14/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-02",
    Component: LogoCloud02,
    View: LogoCloud02View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 8,
    distinctive: /gap-x-14/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-03",
    Component: LogoCloud03,
    View: LogoCloud03View,
    cmsLike: logoCloudFamilyCmsLike,
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 5,
    distinctive: /shadow-foreground\/4/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-04",
    Component: LogoCloud04,
    View: LogoCloud04View,
    cmsLike: { intro: logoCloudFamilyCmsLike.intro, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /border-dashed/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-05",
    Component: LogoCloud05,
    View: LogoCloud05View,
    cmsLike: { intro: logoCloudFamilyCmsLike.intro, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /bg-muted\/50/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-06",
    Component: LogoCloud06,
    View: LogoCloud06View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 8,
    distinctive: /\[--duration:20s\]/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-07",
    Component: LogoCloud07,
    View: LogoCloud07View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 8,
    distinctive: /\[--duration:40s\]/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-08",
    Component: LogoCloud08,
    View: LogoCloud08View,
    cmsLike: { intro: logoCloudFamilyCmsLike.intro, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /grayscale-100/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-09",
    Component: LogoCloud09,
    View: LogoCloud09View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 8,
    distinctive: /rounded-xl bg-muted/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-10",
    Component: LogoCloud10,
    View: LogoCloud10View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 6,
    distinctive: /shadow-xs\/1/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-11",
    Component: LogoCloud11,
    View: LogoCloud11View,
    cmsLike: { intro: logoCloudFamilyCmsLike.intro, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /dark:border-foreground\/15/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-12",
    Component: LogoCloud12,
    View: LogoCloud12View,
    cmsLike: logoCloudFamilyCmsLike,
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /w-\[calc\(100%\+4rem\)\]/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-13",
    Component: LogoCloud13,
    View: LogoCloud13View,
    cmsLike: { intro: logoCloudFamilyCmsLike.intro, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /\[--gap:0px\]/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-14",
    Component: LogoCloud14,
    View: LogoCloud14View,
    cmsLike: logoCloudFamilyCmsLike,
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    distinctive: /max-w-\[20ch\]/,
  },
  {
    id: "shadcnui-blocks.logo-cloud-15",
    Component: LogoCloud15,
    View: LogoCloud15View,
    cmsLike: { title: logoCloudFamilyCmsLike.title, logos: logoCloudFamilyCmsLike.logos },
    sparse: logoCloudFamilySparse,
    long: logoCloudFamilyLong,
    maxItems: 8,
    distinctive: /var\(--provider-accent-400/,
  },
]

for (const variant of logoCloudFamily) {
  test(`${variant.id} public render outputs layout markup with resolved logos`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, />Trusted worldwide|Trusted by teams/)
    assert.match(html, /acme\.svg/)
  })

  test(`${variant.id} sparse content renders provided logos`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, /solo\.svg/)
  })

  test(`${variant.id} missing image omits logo without crashing`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...logoCloudFamilyMissingImage,
      blockIndex: 0,
    })))
  })

  test(`${variant.id} long fields do not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
      mediaResolver,
    })))
  })

  if (variant.maxItems) {
    test(`${variant.id} maximum content caps logos at ${variant.maxItems}`, () => {
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        logos: logoCloudFamilyMaxItems(variant.maxItems + 1).logos,
        blockIndex: 0,
        mediaResolver,
      }))
      assert.match(html, /logo1\.svg/)
      assert.doesNotMatch(html, new RegExp(`logo${variant.maxItems + 1}\\.svg`))
    })
  }

  test(`${variant.id} view maps block to typed component with provider attributes`, () => {
    const block = {
      blockType: "logoCloud",
      title: previewInlineText("Partner logos"),
      intro: previewInlineText("Trusted by many."),
      cta: logoCloudFamilyCmsLike.cta,
      logos: [logoCloudFamilyLogo("Acme")],
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, />Partner logos|Trusted by many\.|acme\.svg/)
  })
}

test("logo-cloud-01 editSlots use itemIndex for nested logo images", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    title: logoCloudFamilyCmsLike.title,
    logos: [
      logoCloudFamilyCmsLike.logos[0],
      { name: "Missing", image: undefined },
    ],
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", { "data-edit-rich": elementPath.field })
      },
      renderImage: ({ elementPath }) => {
        called.push(`image:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-image": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set(["rich:title", "image:logos:0:image", "image:logos:1:image"]),
  )
  assert.match(html, /data-edit-rich="title"/)
  assert.match(html, /data-edit-image="logos:0:image"/)
  assert.match(html, /data-edit-image="logos:1:image"/)
})

test("logo-cloud variants do not use LiteralProviderVariantView", async () => {
  const { readFile } = await import("node:fs/promises")
  for (const variant of logoCloudFamily) {
    const upstream = variant.id.replace("shadcnui-blocks.", "")
    const source = await readFile(new URL(`./variants/${upstream}/view.tsx`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/)
  }
})
