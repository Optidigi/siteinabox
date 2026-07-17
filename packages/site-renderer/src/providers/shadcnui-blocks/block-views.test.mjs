import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { v1FixturePage } from "../../fixtures/v1.ts"
import { ShadcnUiExplicitBlockView } from "./block-views.generated.tsx"
import { ShadcnUiPinnedLiteralPreview } from "./literal-previews.generated.tsx"
import inventory from "./inventory.json" with { type: "json" }
globalThis.React = React

const fixtures = new Map(v1FixturePage.blocks.map((block) => [block.blockType, block]))

test("all 132 public content variants have explicit structured-data dispatch", () => {
  const variants = inventory.variants.filter((variant) => variant.role === "block")
  assert.equal(variants.length, 132)
  for (const variant of variants) {
    const block = fixtures.get(variant.blockType)
    assert.ok(block, `fixture for ${variant.blockType}`)
    let html
    try {
      html = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, { block, options: { index: 0, formAction: "/forms/provider-test" }, variant: variant.id }))
    } catch (error) {
      throw new Error(`${variant.id}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
    assert.match(html, new RegExp(`data-provider-variant="${variant.id}"`), variant.id)
    assert.doesNotMatch(html, /images\.unsplash\.com|logoipsum|placehold\.co|github\.com\/akash3444/, variant.id)
    assert.doesNotMatch(html, /John Doe|Jane Smith|People love using it|Ship better UI without|Today(?:&apos;|')s Posts|Perfect for individuals/, `${variant.id} leaked upstream demo copy`)
  }
})

test("structured content variants do not retain multi-word upstream demo copy", () => {
  const decode = (value) => value
    .replaceAll("&amp;", "&").replaceAll("&apos;", "'").replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"').replaceAll("&nbsp;", " ").replaceAll(/\s+/g, " ").trim()
  for (const variant of inventory.variants.filter((candidate) => candidate.role === "block")) {
    const block = fixtures.get(variant.blockType)
    const upstream = renderToStaticMarkup(React.createElement(ShadcnUiPinnedLiteralPreview, { variant: variant.id }))
    const structured = decode(renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, { block, options: { index: 0, formAction: "/forms/provider-test" }, variant: variant.id })))
    const structuredData = decode(JSON.stringify(block))
    const phrases = [...upstream.matchAll(/>([^<>]+)</g)]
      .map((match) => decode(match[1]))
      .filter((phrase) => phrase.length >= 18 && phrase.split(/\s+/).length >= 3 && !/[{};]/.test(phrase) && !structuredData.includes(phrase))
    for (const phrase of phrases) assert.equal(structured.includes(phrase), false, `${variant.id} leaked upstream phrase: ${phrase}`)
  }
})

test("literal parity views use the isolated reference token mode", () => {
  const html = renderToStaticMarkup(React.createElement(ShadcnUiPinnedLiteralPreview, { variant: "shadcnui-blocks.hero-01" }))
  assert.match(html, /data-provider-token-mode="reference"/)
  assert.doesNotMatch(html, /data-provider-token-mode="theme"/)
})

test("literal views preserve CMS edit-slot boundaries", () => {
  const hero = {
    ...fixtures.get("hero"),
    image: { id: "hero-media", url: "/media/hero.jpg", width: 1200, height: 675 },
  }
  const html = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, {
    block: hero,
    variant: "shadcnui-blocks.hero-01",
    options: {
      index: 2,
      editSlots: {
        renderRichText: ({ elementPath }) => React.createElement("span", { "data-edit-rich": `${elementPath.field}:${elementPath.blockIndex}` }, "rich"),
        renderText: ({ elementPath }) => React.createElement("span", { "data-edit-text": elementPath.field }, "text"),
        renderCta: ({ elementPath }) => React.createElement("a", { "data-edit-cta": elementPath.field, href: "#" }, "cta"),
        renderImage: ({ elementPath }) => React.createElement("img", { "data-edit-image": elementPath.field, alt: "" }),
      },
    },
  }))
  assert.match(html, /data-edit-rich="(?:eyebrow|headline|subheadline):2"/)
  assert.match(html, /data-edit-cta="cta"/)
  const team = fixtures.get("team")
  const teamHtml = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, {
    block: team,
    variant: "shadcnui-blocks.team-01",
    options: {
      index: 2,
      editSlots: {
        renderImage: ({ elementPath }) => React.createElement("img", { "data-edit-image": elementPath.field, alt: "" }),
      },
    },
  }))
  assert.match(teamHtml, /data-edit-image="members"/)
})

test("team profile links fill only native provider social-link positions", () => {
  const team = fixtures.get("team")
  const block = {
    ...team,
    members: team.members.map((member) => ({
      ...member,
      links: [
        { label: "Profile", href: "/team/profile" },
        { label: "External profile", href: "https://example.com/profile", external: true },
      ],
    })),
  }
  const withSocials = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, {
    block,
    variant: "shadcnui-blocks.team-03",
    options: { index: 0 },
  }))
  assert.match(withSocials, /href="\/team\/profile"/)
  assert.match(withSocials, /href="https:\/\/example\.com\/profile" target="_blank" rel="noreferrer"/)
  assert.doesNotMatch(withSocials, /href="#"/)

  const withoutSocials = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, {
    block,
    variant: "shadcnui-blocks.team-01",
    options: { index: 0 },
  }))
  assert.doesNotMatch(withoutSocials, /team\/profile|example\.com\/profile/)
})

test("contact variants use only structured SIAB form actions, fields, and submit labels", () => {
  const source = fixtures.get("contactSection")
  const block = {
    ...source,
    formName: "provider-contact",
    submitLabel: "Send securely",
    fields: Array.from({ length: 12 }, (_, index) => ({
      name: `field-${index}`,
      label: `Field ${index}`,
      type: index === 11 ? "textarea" : "text",
      required: index === 0,
    })),
  }
  for (const variant of inventory.variants.filter((candidate) => candidate.blockType === "contactSection")) {
    const html = renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, {
      block,
      options: { index: 0, formAction: "/api/forms/submit" },
      variant: variant.id,
    }))
    assert.match(html, /action="\/api\/forms\/submit"/, variant.id)
    assert.match(html, /name="formName" value="provider-contact"/, variant.id)
    assert.match(html, /name="field-0"/, variant.id)
    assert.match(html, /name="field-11"/, `${variant.id} must not discard fields beyond its demo layout`)
    assert.match(html, />Send securely<\/button>/, variant.id)
    assert.doesNotMatch(html, /action="(?:https?:|about:blank)/, variant.id)
  }
})

test("content dispatch fails closed for unknown and block-type-mismatched variants", () => {
  const hero = fixtures.get("hero")
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, { block: hero, options: { index: 0 }, variant: "shadcnui-blocks.hero-99" })), /Unresolved provider block variant/)
  assert.throws(() => renderToStaticMarkup(React.createElement(ShadcnUiExplicitBlockView, { block: hero, options: { index: 0 }, variant: "shadcnui-blocks.faq-01" })), /Unresolved provider block variant/)
})
