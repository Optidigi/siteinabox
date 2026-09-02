import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BACKGROUND_MODE_IDS, BlockSchema, CTA_VARIANTS, HERO_VARIANTS, HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA, SERVICES_VARIANTS, SITEGEN_BLOCK_TYPES } from "@siteinabox/contracts"
import { v1FixturePage, v1FixtureSettings, v1FixtureTheme } from "../fixtures/v1.ts"
import { SitePageRenderer } from "../SitePageRenderer.tsx"
import { BlockRenderer } from "./index.tsx"

test("every first-party Sitegen block renders through the explicit switch", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  let renderedCount = 0

  for (const blockType of SITEGEN_BLOCK_TYPES) {
    const keys = blockType === "hero" ? HERO_VARIANTS : blockType === "services" ? SERVICES_VARIANTS : blockType === "cta" ? CTA_VARIANTS : [blockType]
    for (const key of keys) {
      const source = fixtureBlocks.get(blockType)
      const base = blockType === "hero"
        ? fixtureBlocks.get(key)
        : blockType === "services" || blockType === "cta"
          ? { ...source, variant: key }
          : source
      assert.ok(base, `missing fixture for ${key}`)
      if (blockType === "hero" || blockType === "services" || blockType === "cta") assert.equal(base.variant, key)

      const parsed = BlockSchema.parse(base)
      const html = renderToStaticMarkup(
        React.createElement(BlockRenderer, { block: parsed, options: { index: renderedCount } }),
      )

      if (blockType === "hero") {
        assert.match(html, /data-siab-hero-design=/)
        assert.doesNotMatch(html, /variant-pending/)
      } else if (blockType === "services") {
        assert.match(html, new RegExp(`data-siab-services-design="${key}"`))
        assert.doesNotMatch(html, /variant-pending/)
      } else if (blockType === "cta") {
        assert.match(html, new RegExp(`data-siab-cta-design="${key}"`))
        assert.doesNotMatch(html, /variant-pending/)
      } else if (blockType === "appointments") {
        assert.match(html, /data-siab-appointments-design="appointments-01"/)
        assert.match(html, /data-siab-appointment-flow/)
        assert.doesNotMatch(html, /variant-pending/)
      } else {
        assert.match(html, /data-siab-block-state="variant-pending"/)
      }
      renderedCount += 1
    }
  }

  assert.equal(renderedCount, SITEGEN_BLOCK_TYPES.length + HERO_VARIANTS.length + SERVICES_VARIANTS.length + CTA_VARIANTS.length - 3)
})

test("appointments-01 keeps inline and dialog presentations on the same flow markup", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "appointments")
  assert.ok(source)

  const inline = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: BlockSchema.parse({ ...source, presentation: "inline" }), options: { index: 5, appointmentMode: "preview" } }),
  )
  const dialog = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: BlockSchema.parse({ ...source, presentation: "dialog" }), options: { index: 5, appointmentMode: "preview" } }),
  )

  for (const html of [inline, dialog]) {
    assert.match(html, /data-siab-appointments-design="appointments-01"/)
    assert.match(html, /data-siab-appointment-flow/)
    assert.match(html, /data-siab-appointment-details/)
    assert.match(html, /data-siab-appointment-confirmation-body/)
    assert.match(html, /name="visitorEmail"/)
  }
  assert.doesNotMatch(inline, /<dialog /)
  assert.match(dialog, /<dialog[^>]+data-siab-appointment-dialog/)
  assert.match(dialog, /data-siab-appointment-runtime="preview"/)
})

test("appointments-01 consumes the shared effect bridge without leaking outside its surfaces", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "appointments")
  assert.ok(source)

  for (const mode of BACKGROUND_MODE_IDS) {
    const block = BlockSchema.parse({
      ...source,
      backgroundMode: mode,
      ...(mode === "image" ? { image: "/fixture-media/project-office.webp" } : {}),
    })
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, { block, options: { index: 5, appointmentMode: "preview" } }),
    )

    const renderedMode = mode === "none" && block.image ? "image" : mode
    assert.match(html, new RegExp(`data-siab-appointment-background-mode="${renderedMode}"`))
    assert.match(html, /site-appointments-panel relative isolate overflow-hidden/)
    assert.match(html, /data-siab-effect-hover-target="true"/)
    if (mode === "none") {
      assert.match(html, /site-appointments-background/)
      assert.match(html, /data-siab-background-mode="image"/)
      assert.match(html, /hero-lead-media-bleed/)
    } else {
      assert.match(html, /site-appointments-background/)
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
    }
  }

  const dialog = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block: BlockSchema.parse({ ...source, presentation: "dialog", backgroundMode: "mesh" }),
      options: { index: 5, appointmentMode: "preview" },
    }),
  )
  assert.match(dialog, /site-appointment-dialog-rail relative isolate overflow-hidden/)
  assert.match(dialog, /site-appointment-dialog-rail-background/)
  assert.match(dialog, /data-siab-hero-mesh-effect="true"[^>]*class="[^"]*site-appointment-dialog-rail-background/)
  assert.doesNotMatch(dialog, /site-appointment-dialog-main[^]*data-siab-background-mode=/)
})

test("appointments-01 keeps the CTA-01 panel surface and neutral modal rail tokenized", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-appointments-panel\s*\{[\s\S]*border: 1px solid color-mix\(in oklab, var\(--border\) 87%, transparent\);[\s\S]*border-radius: var\(--siab-radius-3xl\);/)
  assert.match(styles, /\.site-appointments-panel > \.site-appointments-background,[\s\S]*contain: paint;/)
  assert.match(styles, /\.site-appointments-launcher\s*\{[\s\S]*align-items: center;[\s\S]*flex-direction: column;[\s\S]*text-align: center;/)
  assert.match(styles, /\.site-appointment-launcher-button\s*\{[\s\S]*min-height: clamp\(3\.25rem, 5\.5vw, 3\.5rem\);[\s\S]*padding-inline: clamp\(1\.25rem, 2\.5vw, 2rem\);/)
  assert.match(styles, /\.site-appointment-dialog-rail\s*\{[\s\S]*background: var\(--card\);/)
})

test("services-01 renders a centered icon-led feature grid through the shared renderer", () => {
  const block = BlockSchema.parse(v1FixturePage.blocks.find((candidate) => candidate.blockType === "services"))
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block, options: { index: 1 } }),
  )

  assert.match(html, /data-siab-services-design="services-01"/)
  assert.match(html, /data-siab-services-item-index="0"/)
  assert.match(html, /data-siab-services-item-index="2"/)
  assert.match(html, /site-services-01-item-shell/)
  assert.doesNotMatch(html, /data-siab-services-card/)
  assert.match(html, /data-siab-services-cell="true"/)
  assert.match(html, /data-item-count="3"/)
  assert.match(html, /Waarmee ik help/)
  assert.match(html, /Onderhoud/)
  assert.match(html, /<svg width="32" height="32"/)
  assert.match(html, /site-services-01-grid/)
  assert.doesNotMatch(html, /variant-pending/)
})

test("services-01 renders an optional item action as an editable CTA", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "services")
  const block = BlockSchema.parse({
    ...source,
    items: source.items.map((item) => ({ ...item, action: { label: "Meer informatie", href: "#contact" } })),
  })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block, options: { index: 1 } }),
  )

  assert.equal((html.match(/site-services-01-action/g) ?? []).length, 3)
  assert.match(html, /Meer informatie/)
  assert.match(html, /href="#contact"/)
})

test("services-02 renders the centered icon-link grid through the shared renderer", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "services")
  const block = BlockSchema.parse({
    ...source,
    variant: "services-02",
    items: source.items.map((item) => ({ ...item, action: { label: "Meer informatie", href: "#contact" } })),
  })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block, options: { index: 1 } }),
  )

  assert.match(html, /data-siab-services-design="services-02"/)
  assert.match(html, /site-services-02-grid/)
  assert.match(html, /site-services-02-icon/)
  assert.match(html, /site-services-02-action/)
  assert.equal((html.match(/site-services-02-action/g) ?? []).length, 3)
  assert.doesNotMatch(html, /site-services-01-item/)
})

test("services-02 keeps source-aligned responsive icon-link geometry", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  const serviceStyles = styles.slice(styles.indexOf("/* Services 02"), styles.indexOf("/* CTA 01"))

  assert.match(
    serviceStyles,
    /\.site-services-02-grid\s*\{[\s\S]*display: flex;[\s\S]*flex-wrap: wrap;[\s\S]*justify-content: center;/,
  )
  assert.match(serviceStyles, /\.site-services-02-item\s*\{[\s\S]*flex: 0 0 100%;/)
  assert.match(
    serviceStyles,
    /@media \(min-width: 40rem\)[\s\S]*\.site-services-02-item\s*\{[\s\S]*flex-basis: calc\(\(100% - 2rem\) \/ 2\)/,
  )
  assert.match(
    serviceStyles,
    /@media \(min-width: 64rem\)[\s\S]*\.site-services-02-item\s*\{[\s\S]*flex-basis: calc\(\(100% - 4rem\) \/ 3\)/,
  )
  assert.match(serviceStyles, /\.site-services-02-icon\s*\{[\s\S]*width: 3.25rem;[\s\S]*height: 3.25rem;[\s\S]*background: var\(--background\)/)
  assert.match(serviceStyles, /\.site-services-02-action\s*\{[\s\S]*min-height: 2\.75rem[\s\S]*padding: 0;[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*white-space: nowrap;/)
  assert.match(serviceStyles, /\.site-services-02-action > svg\s*\{[\s\S]*width: 1\.25rem;[\s\S]*height: 1\.25rem;/)
  assert.doesNotMatch(serviceStyles, /\.site-services-02-item\s*\{[^}]*background:/)
})

test("services-01 keeps editable text and actions on the same public renderer path", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "services")
  const block = BlockSchema.parse(source)
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block,
      options: {
        index: 1,
        editSlots: {
          renderText: ({ value, elementPath }) => React.createElement("span", {
            "data-siab-field": elementPath.field,
            ...(elementPath.itemIndex != null ? { "data-siab-item-index": String(elementPath.itemIndex) } : {}),
            ...(elementPath.subField ? { "data-siab-sub-field": elementPath.subField } : {}),
          }, value),
          renderCta: ({ value, className }) => React.createElement("a", { href: value?.href ?? "#", className, "data-siab-field": "action" }, value?.label),
        },
      },
    }),
  )

  assert.match(html, /data-siab-field="heading"/)
  assert.match(html, /data-siab-field="items" data-siab-item-index="0" data-siab-sub-field="body"/)
})

test("services-01 uses source-aligned tokenized feature cells", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  const serviceStyles = styles.slice(styles.indexOf("/* Services 01"), styles.indexOf("/* CTA 01"))

  assert.doesNotMatch(serviceStyles, /\.site-services-01-panel/)
  assert.match(
    serviceStyles,
    /\.site-services-01-item\s*\{[\s\S]*border: 0;[\s\S]*border-radius: var\(--siab-radius-2xl\)[\s\S]*color: var\(--card-foreground\)/,
  )
  assert.doesNotMatch(serviceStyles, /siab-services-cell-surface/)
  assert.match(serviceStyles, /\.site-services-01-item\s*\{[\s\S]*background: color-mix\(in oklab, var\(--background\) 96%, var\(--foreground\) 2%\)/)
  assert.match(serviceStyles, /\.site-services-01-item\s*\{[\s\S]*box-shadow: none;/)
  assert.match(serviceStyles, /\.site-services-01-icon\s*\{[\s\S]*background: var\(--background\)/)
  assert.match(serviceStyles, /data-rt-mode="dark"[\s\S]*\.site-services-01-item,[\s\S]*background: color-mix\(in oklab, var\(--background\) 94%, var\(--foreground\) 4%\)/)
  assert.match(serviceStyles, /data-rt-mode="dark"[\s\S]*\.site-services-01-item,[\s\S]*box-shadow: none;/)
  assert.match(serviceStyles, /data-rt-mode="dark"[\s\S]*\.site-services-01-icon,[\s\S]*background: var\(--background\)/)
  assert.doesNotMatch(serviceStyles, /\.site-services-01-item[\s\S]*background: var\(--card\)/)
  assert.doesNotMatch(serviceStyles, /\.site-services-01-icon[\s\S]*background: var\(--card\)/)
  assert.match(serviceStyles, /\.site-services-01-icon\s*\{[\s\S]*box-shadow:\s*0 1px 2px 0 rgb\(0 0 0 \/ 0\.06\),[\s\S]*inset 0 0 0 1px color-mix\(in oklab, var\(--secondary\) 52%, var\(--border\) 48%\);/)
  assert.match(serviceStyles, /data-rt-mode="dark"[\s\S]*\.site-services-01-icon,[\s\S]*box-shadow:\s*0 1px 2px 0 rgb\(0 0 0 \/ 0\.04\),[\s\S]*inset 0 0 0 1px color-mix\(in oklab, var\(--secondary\) 88%, var\(--background\) 12%\);/)
  assert.doesNotMatch(serviceStyles, /--site-services-01-icon-(?:shadow|contact-shadow)/)
  assert.doesNotMatch(serviceStyles, /0 0\.5rem 1rem var\(--site-services-01-icon-shadow\)|0 0\.125rem 0\.25rem var\(--site-services-01-icon-contact-shadow\)/)
  assert.match(serviceStyles, /\.site-services-01-icon\s*\{[\s\S]*width: 3\.25rem;[\s\S]*height: 3\.25rem;[\s\S]*margin-top: -1\.875rem;[\s\S]*color: var\(--primary\)/)
  assert.match(serviceStyles, /\.site-services-01-icon\s*> svg\s*\{[\s\S]*width: 1\.625rem;[\s\S]*height: 1\.625rem;/)
  assert.match(serviceStyles, /@media \(min-width: 48rem\)[\s\S]*\.site-services-01-icon > svg\s*\{[\s\S]*width: 1\.875rem;[\s\S]*height: 1\.875rem;/)
  assert.match(serviceStyles, /data-theme-shape="soft"[\s\S]*\.site-services-01-icon[\s\S]*border-radius: var\(--siab-radius-xl\)/)
  assert.match(serviceStyles, /data-theme-shape="rounded"[\s\S]*\.site-services-01-icon[\s\S]*border-radius: var\(--siab-radius-full\)/)
  assert.match(serviceStyles, /\.site-services-01-title\s*\{[\s\S]*font-size: clamp\(2\.375rem, 4vw, 3\.125rem\)/)
  assert.match(serviceStyles, /\.site-services-01-intro\s*\{[\s\S]*font-size: clamp\(1\.0625rem, 1\.8vw, 1\.125rem\)/)
  assert.match(serviceStyles, /\.site-services-01-item-title\s*\{[\s\S]*font-size: 1\.125rem;[\s\S]*line-height: 1\.5555556;/)
  assert.match(serviceStyles, /\.site-services-01-item-body\s*\{[\s\S]*margin: 0\.25rem 0 0;[\s\S]*font-size: 1rem;[\s\S]*line-height: 1\.5rem;/)
  assert.match(
    serviceStyles,
    /\.site-services-01-grid\s*\{[\s\S]*display: flex;[\s\S]*flex-wrap: wrap;[\s\S]*justify-content: center;/,
  )
  assert.match(serviceStyles, /\.site-services-01-item-shell\s*\{[\s\S]*flex: 0 0 100%;/)
  assert.match(
    serviceStyles,
    /@media \(min-width: 48rem\)[\s\S]*\.site-services-01-item-shell\s*\{[\s\S]*flex-basis: calc\(\(100% - 2rem\) \/ 2\)/,
  )
  assert.match(
    serviceStyles,
    /@media \(min-width: 64rem\)[\s\S]*\.site-services-01-item-shell\s*\{[\s\S]*flex-basis: calc\(\(100% - 4rem\) \/ 3\)/,
  )
  assert.match(serviceStyles, /@media \(min-width: 64rem\)[\s\S]*\.site-services-01-grid[\s\S]*row-gap: 4rem;/)
  assert.match(serviceStyles, /@media \(min-width: 48rem\)[\s\S]*\.site-services-01-icon\s*\{[\s\S]*margin-top: -2rem;/)
  assert.match(serviceStyles, /\.site-services-01-action\s*\{[\s\S]*min-height: 2\.75rem[\s\S]*border: 1px solid/)
})

test("cta-01 renders every global background token through the shared renderer", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "cta")
  assert.ok(source)

  for (const mode of BACKGROUND_MODE_IDS) {
    const block = BlockSchema.parse(source)
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 2,
          theme: { ...v1FixtureTheme, appearance: { ...v1FixtureTheme.appearance, backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /data-siab-cta-design="cta-01"/)
    assert.match(html, /data-siab-effect-hover-target="true"/)
    assert.doesNotMatch(html, /variant-pending/)
    if (mode === "animation") assert.match(html, /data-siab-hero-dither-effect="true"/)
    if (mode === "grid") assert.match(html, /hero-lead-grid-field/)
    if (mode === "ambient") assert.match(html, /data-siab-hero-ambient-effect="true"/)
    if (mode === "mesh") assert.match(html, /data-siab-hero-mesh-effect="true"/)
    if (mode === "image") assert.match(html, /hero-lead-media-bleed/)
    if (mode === "none") assert.doesNotMatch(html, /data-siab-background-mode=|data-siab-hero-media|hero-lead-background-|hero-lead-media-/)
  }
})

test("a block background override takes precedence over the global theme mode", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "cta")
  assert.ok(source)

  const noEffect = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block: BlockSchema.parse({ ...source, backgroundMode: "none" }),
      options: {
        index: 2,
        theme: { ...v1FixtureTheme, appearance: { ...v1FixtureTheme.appearance, backgroundMode: "mesh" } },
      },
    }),
  )
  assert.doesNotMatch(noEffect, /data-siab-hero-mesh-effect|data-siab-background-mode=/)

  const grid = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block: BlockSchema.parse({ ...source, backgroundMode: "grid" }),
      options: {
        index: 2,
        theme: { ...v1FixtureTheme, appearance: { ...v1FixtureTheme.appearance, backgroundMode: "none" } },
      },
    }),
  )
  assert.match(grid, /data-siab-background-mode="grid"/)
  assert.match(grid, /hero-lead-grid-field/)
})

test("cta-01 keeps editable heading, body, and actions on the same renderer path", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "cta")
  const block = BlockSchema.parse(source)
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block,
      options: {
        index: 2,
        editSlots: {
          renderText: ({ value, elementPath }) => React.createElement("span", { "data-siab-field": elementPath.field }, value),
          renderCta: ({ value, className }) => React.createElement("a", { href: value?.href ?? "#", className, "data-siab-field": "cta" }, value?.label),
        },
      },
    }),
  )

  assert.match(html, /data-siab-field="heading"/)
  assert.match(html, /data-siab-field="body"/)
  assert.match(html, /data-siab-field="cta"/)
})

test("cta-01 clips shared effects and keeps restrained neutral elevation", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  const ctaStyles = styles.slice(styles.indexOf("/* CTA 01"), styles.indexOf(".site-renderer:has"))

  assert.match(ctaStyles, /\.site-cta-01-panel\s*\{[\s\S]*overflow: hidden;/)
  assert.match(ctaStyles, /\.site-cta-01-panel\s*\{[\s\S]*border: 1px solid color-mix\(in oklab, var\(--border\) 87%, transparent\);/)
  assert.match(ctaStyles, /\.site-cta-01-panel > \.site-cta-01-background\s*\{[\s\S]*contain: paint;/)
  assert.match(ctaStyles, /\.site-cta-01-panel\s*\{[\s\S]*box-shadow:\s*\n\s*0 1px 2px rgb\(0 0 0 \/ 0\.06\),\s*\n\s*0 0\.625rem 1\.5rem rgb\(0 0 0 \/ 0\.05\);/)
  assert.match(ctaStyles, /data-rt-mode="dark"[\s\S]*\.site-cta-01-panel,[\s\S]*box-shadow:\s*\n\s*0 1px 2px rgb\(0 0 0 \/ 0\.12\),\s*\n\s*0 0\.625rem 1\.5rem rgb\(0 0 0 \/ 0\.1\);/)
  assert.doesNotMatch(ctaStyles, /\.site-cta-01-panel[\s\S]*var\(--overlay\) 16%/)
})

test("cta-02 recreates the simple centered composition through the shared renderer", () => {
  const source = v1FixturePage.blocks.find((candidate) => candidate.blockType === "cta")
  assert.ok(source)
  const block = BlockSchema.parse({
    ...source,
    variant: "cta-02",
    secondaryAction: { label: "Bekijk diensten", href: "#services" },
  })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block, options: { index: 2 } }),
  )

  assert.match(html, /data-siab-cta-design="cta-02"/)
  assert.match(html, /site-cta-02-copy/)
  assert.match(html, /site-cta-02-title/)
  assert.match(html, /site-cta-02-body/)
  assert.match(html, /site-cta-02-primary/)
  assert.match(html, /hero-primary-action/)
  assert.match(html, /site-cta-02-more-link/)
  assert.match(html, /site-cta-02-more-arrow[^>]*aria-hidden="true">→/)
  assert.doesNotMatch(html, /site-cta-01-panel/)
  assert.doesNotMatch(html, /variant-pending/)
})

test("cta-02 keeps the source-aligned centered geometry without a card", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  const ctaStyles = styles.slice(styles.indexOf("/* CTA 02"), styles.indexOf(".site-renderer:has"))

  assert.match(ctaStyles, /\.site-cta-02\s*\{[\s\S]*padding-block: var\(--siab-section-space-emphasis\);/)
  assert.doesNotMatch(ctaStyles, /\.site-cta-02\s*\{[\s\S]*padding-block: (?:6|8)rem;/)
  assert.match(ctaStyles, /@media \(min-width: 64rem\)[\s\S]*\.site-cta-02-title\s*\{[\s\S]*font-size: 3\.5rem;/)
  assert.match(ctaStyles, /\.site-cta-02-copy\s*\{[\s\S]*max-width: 48rem;/)
  assert.match(ctaStyles, /\.site-cta-02-title\s*\{[\s\S]*font-size: clamp\(2\.375rem, 4vw, 3\.125rem\);[\s\S]*font-weight: 600;[\s\S]*letter-spacing: -0\.025em;/)
  assert.match(ctaStyles, /\.site-cta-02-body\s*\{[\s\S]*max-width: 40rem;[\s\S]*margin: 1\.5rem auto 0;[\s\S]*font-size: 1\.125rem;[\s\S]*line-height: 2;/)
  assert.doesNotMatch(ctaStyles, /\.site-cta-02[^\{]*\{[^}]*border:/)
  assert.doesNotMatch(ctaStyles, /\.site-cta-02[^\{]*\{[^}]*box-shadow:/)
})

test("hero blocks keep the same renderer path when editor slots are present", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  for (const variant of HERO_VARIANTS) {
    const block = BlockSchema.parse(fixtureBlocks.get(variant))
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          editSlots: {
            renderText: ({ value, elementPath }) => React.createElement("span", { "data-siab-field": "text", ...(elementPath.itemIndex != null ? { "data-siab-item-index": String(elementPath.itemIndex) } : {}), ...(elementPath.subField ? { "data-siab-sub-field": elementPath.subField } : {}) }, value),
            renderCta: ({ value, className, showArrow }) => React.createElement("a", { href: value?.href ?? "#", className, "data-siab-field": "cta" }, value?.label, showArrow ? React.createElement("svg", { className: "hero-action-arrow", "aria-hidden": "true", viewBox: "0 0 24 24" }) : null),
            renderImage: ({ value, className, alt }) => React.createElement("img", { src: typeof value === "string" ? value : null, className, alt: alt ?? "" }),
          },
        },
      }),
    )
    assert.match(html, /data-siab-hero-design=/)
    assert.match(html, /data-siab-field="text"/)
    assert.match(html, /data-siab-field="cta"/)
    assert.match(html, /data-siab-field="cta"[^>]*>[\s\S]*hero-action-arrow/)
  }
})

test("overlay navbar clearance is scoped to first-section content", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /\.site-frame-root\s*\{[\s\S]*--siab-navbar-row-height:\s*4\.5rem/)
  assert.match(styles, /\.site-frame-root-navbar-overlay\s*\{[\s\S]*--siab-navbar-overlay-height:\s*calc\(var\(--siab-navbar-row-height\) \+ 1px\)/)
  assert.match(styles, /\.site-frame-root-navbar-overlay\[data-siab-navbar-variant="navbar-03"\][\s\S]*--siab-navbar-overlay-height:\s*calc\(var\(--siab-navbar-row-height\) \+ 0\.75rem \+ 2px\)/)
  assert.match(styles, /--siab-navbar-clearance-gap:\s*3rem/)
  assert.match(styles, /--siab-navbar-clearance:\s*calc\([\s\S]*var\(--siab-navbar-clearance-gap\)/)
  assert.match(styles, /data-siab-navbar-variant="navbar-03"\][\s\S]*--siab-navbar-clearance-gap:\s*3rem/)
  assert.match(styles, /\.site-frame-root-navbar-overlay > main > :first-child \[data-siab-navbar-overlay-content\]/)
  assert.doesNotMatch(styles, /\.site-frame-root-navbar-overlay > main > :first-child\[data-siab-hero-design\][\s\S]*padding-top:\s*clamp\(6\.5rem/)

  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  for (const variant of ["hero-01", "hero-02", "hero-03", "hero-04", "hero-05"]) {
    const block = BlockSchema.parse(fixtureBlocks.get(variant))
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, { block, options: { index: 0 } }),
    )
    assert.match(html, /data-siab-navbar-overlay-content="true"/)
  }
})

test("the shared page shell exposes the active navbar variant to overlay layout", () => {
  const block = BlockSchema.parse(v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-03"))
  const navbar = v1FixtureSettings.chrome?.navbar
  assert.ok(navbar)
  const html = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: { ...v1FixturePage, blocks: [block] },
      settings: {
        ...v1FixtureSettings,
        chrome: { ...v1FixtureSettings.chrome, navbar: { ...navbar, placement: "hero-overlay", variant: "navbar-03" } },
      },
      theme: v1FixtureTheme,
    }),
  )

  assert.match(html, /site-frame-root-navbar-overlay/)
  assert.match(html, /data-siab-navbar-variant="navbar-03"/)
})

test("sticky first-hero visuals extend under the navbar without moving content", () => {
  const block = BlockSchema.parse(v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-03"))
  const navbar = v1FixtureSettings.chrome?.navbar
  assert.ok(navbar)
  const html = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: { ...v1FixturePage, blocks: [block] },
      settings: {
        ...v1FixtureSettings,
        chrome: { ...v1FixtureSettings.chrome, navbar: { ...navbar, placement: "sticky", variant: "navbar-03" } },
      },
      theme: v1FixtureTheme,
    }),
  )
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(html, /site-frame-root-navbar-sticky/)
  assert.match(styles, /\.site-frame-root-navbar-sticky\s*\{[\s\S]*--siab-navbar-visual-height:\s*calc\(var\(--siab-navbar-row-height\) \+ 1px\)/)
  assert.match(styles, /\.site-frame-root-navbar-sticky\[data-siab-navbar-variant="navbar-03"\][\s\S]*--siab-navbar-visual-height:\s*calc\(var\(--siab-navbar-row-height\) \+ 0\.75rem \+ 2px\)/)
  assert.match(styles, /\.site-frame-root-navbar-sticky > main > :first-child\[data-siab-hero-design\] > \[data-siab-background-mode\][\s\S]*top: calc\(-1 \* var\(--siab-navbar-visual-height\)\)/)
  assert.match(styles, /\.site-frame-root-navbar-sticky > main > :first-child\[data-siab-hero-design="service-panel"\] \.hero-service-panel-stage\s*\{[\s\S]*overflow-x: clip[\s\S]*overflow-y: visible/)
  assert.match(styles, /\.site-frame-root-navbar-sticky > main > :first-child\[data-siab-hero-design="service-panel"\] \.hero-service-background\s*\{[\s\S]*top: calc\(-1 \* var\(--siab-navbar-visual-height\)\)/)
  assert.match(styles, /\.site-frame-root-navbar-sticky > main > :first-child\[data-siab-hero-design="angled"\] \.hero-angled-media-slot[\s\S]*top: calc\(-1 \* var\(--siab-navbar-visual-height\)\)/)

  const servicePanel = BlockSchema.parse(v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-02"))
  const servicePanelHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: servicePanel, options: { index: 0 } }),
  )
  assert.match(servicePanelHtml, /data-siab-hero-design="service-panel"/)
  assert.match(servicePanelHtml, /hero-service-panel-stage[^"]*overflow-hidden/)
  assert.match(servicePanelHtml, /hero-service-background/)
})

test("the lead hero stays centered without an image and keeps its proof band", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  const block = BlockSchema.parse({ ...fixtureBlocks.get("hero-01"), image: undefined })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block,
      options: {
        index: 0,
        theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: "image" } },
      },
    }),
  )

  assert.match(html, /data-siab-hero-design="lead"/)
  assert.match(html, /text-center/)
  assert.match(html, /hero-primary-action/)
  assert.match(html, /hero-action-arrow/)
  assert.doesNotMatch(html, /data-siab-hero-media/)
  assert.match(html, /data-siab-hero-value-points/)
  assert.match(html, /data-siab-hero-value-points-presentation="proof-band"/)
  assert.match(html, /<li class="[^"]*flex min-w-0 items-center gap-4 px-5 py-5 text-left sm:gap-5 sm:py-6 lg:px-8/)
  assert.match(html, /hero-value-point-icon flex shrink-0 items-center justify-center text-primary size-10/)
  assert.match(html, /<svg width="30" height="30"/)
  assert.match(html, /font-heading font-semibold[^\"]*text-base[^\"]*sm:text-lg/)
  assert.match(html, /block text-\[0\.9375rem\] leading-6 text-muted-foreground mt-1\.5/)
  assert.match(html, /hero-lead-value-points/)
  assert.doesNotMatch(html, /hero-lead-media-value-points/)
  assert.doesNotMatch(html, /hero-value-point-icon[^>]*(rounded|border|bg-primary\/10)/)
  assert.doesNotMatch(html, /hero-value-points[^>]*(rounded|shadow|ring)/)
  assert.match(html, /hero-value-points[^>]*border-y[^>]*bg-card\/35/)
  assert.match(html, /<svg[^>]*aria-hidden="true"/)
  assert.match(html, /Heldere afspraken/)
  assert.match(html, /Eén aanspreekpunt/)

})

test("lead hero value points support zero, two, three, or four items", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-01")
  assert.ok(base)
  const fourthHighlight = { title: "Direct contact", body: "Je bespreekt de vraag rechtstreeks met de uitvoerder." }

  for (const count of [2, 3, 4]) {
    const block = BlockSchema.parse({
      ...base,
      highlights: [...(base.highlights ?? []), fourthHighlight].slice(0, count),
    })
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, { block, options: { index: 0 } }),
    )
    const valuePointsIndex = html.indexOf('data-siab-hero-value-points="true"')
    assert.ok(valuePointsIndex >= 0)
    assert.match(html, /max-w-7xl/)
    assert.match(html.slice(valuePointsIndex), /class="hero-value-points[^\"]*w-full/)
    assert.match(html, count === 4 ? /lg:grid-cols-4/ : new RegExp(`md:grid-cols-${count}`))
  }

  const noHighlights = BlockSchema.parse({ ...base, highlights: [] })
  const noHighlightsHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: noHighlights, options: { index: 0 } }),
  )
  assert.doesNotMatch(noHighlightsHtml, /data-siab-hero-value-points/)
})

test("the lead hero caps sharp media at 1920px and fills wider gutters with a glassy image clone", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-01")
  assert.ok(base)
  const block = BlockSchema.parse({
    ...base,
    image: { url: "/fixture-media/service.webp", alt: "Werkzaamheden in een woning", width: 1448, height: 1086 },
  })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block,
      options: {
        index: 0,
        theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: "image" } },
      },
    }),
  )

  assert.match(html, /hero-lead-media-backdrop/)
  assert.match(html, /hero-lead-media-glass/)
  assert.match(html, /hero-lead-media-bleed/)
  assert.match(html, /hero-lead-media-overlay/)
  assert.equal((html.match(/hero-lead-media-overlay/g) ?? []).length, 2)
  assert.match(html, /hero-lead-value-points/)
  assert.doesNotMatch(html, /hero-lead-media-scrim|hero-lead-media-edge-fade|hero-lead-media-gutter-mask|hero-lead-media-gutter-fade/)
  assert.doesNotMatch(html, /hero-lead-media-stage/)
  assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 2)
  assert.match(html, /sizes="\(min-width: 120rem\) 120rem, 100vw"/)
  assert.match(html, /hero-on-media-actions/)
  assert.match(html, /max-w-2xl/)
  assert.doesNotMatch(html, /\[&gt;p\]:max-w-none|headingClassName|max-w-none/)
})

test("Navbar-03 owns the theme-tinted glass treatment while lead media keeps its neutral glass", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
  const glassRule = styles.match(/\.hero-lead-media-glass\s*\{[\s\S]*?\n\}/)?.[0] ?? ""

  assert.match(glassRule, /background-color:\s*color-mix\(in oklab, var\(--background\) 16%, transparent\)/)
  assert.doesNotMatch(glassRule, /siab-hero-glass-tint|siab-hero-glass-surface/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03\s*\{[\s\S]*--siab-navbar-glass-surface-alpha:\s*40%/)
  assert.doesNotMatch(styles, /siab-navbar-glass-tint-(?:start|end)/)
  assert.match(styles, /:where\(\.rt-canvas\)\[data-rt-mode="dark"\] \.site-navbar-frame\.site-navbar-variant-03,[\s\S]*--siab-navbar-glass-surface-alpha:\s*33%/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar\s*\{[\s\S]*background:\s*color-mix\(in oklab, var\(--card\) var\(--siab-navbar-glass-surface-alpha\), transparent\)/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar-mobile-panel\s*\{[\s\S]*background:\s*var\(--background\)/)
  assert.match(styles, /\.hero-lead-media-overlay\s*\{[\s\S]*background-color:\s*var\(--overlay\)/)
})

test("Hero 01 switches background treatments without rendering image layers in non-image modes", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-01")
  assert.ok(base)
  const block = BlockSchema.parse({
    ...base,
    image: { url: "/fixture-media/service.webp", alt: "Werkzaamheden in een woning", width: 1448, height: 1086 },
  })

  for (const mode of BACKGROUND_MODE_IDS) {
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /hero-lead-value-points/)
    if (mode === "none") {
      assert.doesNotMatch(html, /data-siab-background-mode=|data-siab-hero-media|hero-lead-media-|hero-lead-background-/)
    } else if (mode === "image") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 2)
      assert.match(html, /hero-lead-media-glass/)
      assert.doesNotMatch(html, /hero-lead-dither-field|hero-lead-grid-field/)
    } else if (mode === "animation") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed/)
      assert.match(html, /data-siab-hero-dither-effect="true"/)
      assert.match(html, /hero-lead-background-animation/)
      assert.doesNotMatch(html, /hero-lead-grid-field/)
    } else if (mode === "grid") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed/)
      assert.match(html, /hero-lead-grid-field/)
      assert.doesNotMatch(html, /hero-lead-dither-field/)
    } else if (mode === "mesh") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed|hero-lead-grid-field|data-siab-hero-dither-effect|hero-lead-background-ambient/)
      assert.match(html, /data-siab-hero-mesh-effect="true"/)
      assert.match(html, /hero-lead-background-mesh/)
    } else {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed|hero-lead-grid-field|data-siab-hero-dither-effect/)
      assert.match(html, /hero-lead-background-ambient/)
      assert.match(html, /hero-ambient-field[^>]*data-siab-hero-ambient-effect="true"/)
    }
  }
})

test("Hero 01 dither keeps the source-informed warp field in WebGL and fallback paths", () => {
  const source = readFileSync(new URL("./hero/hero-dither-effect.ts", import.meta.url), "utf8")

  assert.match(source, /const DITHER_SIZE = 2/)
  assert.match(source, /uniform float uPixelRatio/)
  assert.match(source, /pixelized = \(floor\(centeredPixel \/ pixelSize\) \+ 0\.5\) \* pixelSize/)
  assert.match(source, /for \(float index = 1\.0; index < 6\.0; index \+= 1\.0\)/)
  assert.match(source, /shapePoint\.x \+= 0\.6 \/ index/)
  assert.match(source, /function ditherDensity/)
  assert.match(source, /shapeX \+= 0\.6 \/ index/)
  assert.match(source, /animationSpeed \+= \(targetSpeed - animationSpeed\)/)
  assert.match(source, /closest<HTMLElement>\("\[data-siab-effect-hover-target\], \[data-siab-hero-design\]"\)/)
  assert.doesNotMatch(source, /ditherFractalNoise|ditherNoise|ribbon/)
})

test("ambient mesh keeps the Flavers shader core and fails closed without a visual fallback", () => {
  const source = readFileSync(new URL("./hero/hero-ambient-effect.ts", import.meta.url), "utf8")

  assert.match(source, /uniform vec3 uColors\[8\]/)
  assert.match(source, /uniform vec4 uCursor/)
  assert.match(source, /uniform vec4 uSurface/)
  assert.match(source, /uniform vec4 uFinish/)
  assert.match(source, /float influence = exp\(-dot\(point - center, point - center\) \* mix\(13\.0, 2\.0, uParamA\)\)/)
  assert.match(source, /color = \(color - 0\.5\) \* uContrast \+ 0\.5/)
  assert.match(source, /function readPalette\(wrapper: HTMLElement\)/)
  assert.match(source, /--background/)
  assert.match(source, /--siab-accent-500/)
  assert.match(source, /const AMBIENT_PROFILES = \{[\s\S]*default:\s*\{[\s\S]*scale: 1\.90,[\s\S]*intensity: 0\.95,[\s\S]*paramA: 0\.58,[\s\S]*warp: 0\.30,[\s\S]*framed:\s*\{[\s\S]*scale: 2\.75,[\s\S]*intensity: 0\.95,[\s\S]*paramA: 0\.58,[\s\S]*warp: 0\.30/s)
  assert.match(source, /function ambientProfileFor\(wrapper: HTMLElement\)/)
  assert.match(source, /uniform4f\(surfaceLocation, 3\.68, 1\.08, 0\.00, 1\.00\)/)
  assert.match(source, /uniform4f\(finishLocation, 0\.00, 0\.00, 0\.000, 0\.10\)/)
  assert.match(source, /uniform4f\(shapeLocation, profile\.scale, profile\.intensity, profile\.paramA, profile\.warp\)/)
  assert.match(source, /uniform4f\(cursorLocation, pointerPresence, 2\.0, 0\.65, 0\.46\)/)
  assert.match(source, /function disableAmbient\(status: "webgl-unavailable" \| "webgl-health" \| "context-lost"\)/)
  assert.match(source, /context-lost|webgl-unavailable|webgl-health/)
  assert.doesNotMatch(source, /drawStaticMesh|createStaticCanvasSurface|StaticFallbackReason|siab-ambient-fallback|forced-preview/)
  assert.doesNotMatch(source, /readPixels\(/)
})

test("ambient mesh animates at a capped rate and keeps the fail-closed renderer lifecycle", () => {
  const source = readFileSync(new URL("./hero/hero-ambient-effect.ts", import.meta.url), "utf8")
  const entrypoint = readFileSync(new URL("../index.ts", import.meta.url), "utf8")

  assert.match(source, /const AMBIENT_TARGET_FPS = 30/)
  assert.match(source, /const AMBIENT_FRAME_MS = 1000 \/ AMBIENT_TARGET_FPS/)
  assert.match(source, /speed: 0\.50,[\s\S]*drift: 0\.10/)
  assert.match(source, /function animate\(timestamp: number\)/)
  assert.match(source, /let lastDrawTimestamp: number \| null = null/)
  assert.match(source, /lastDrawTimestamp === null \|\| timestamp - lastDrawTimestamp >= AMBIENT_FRAME_MS/)
  assert.match(source, /Math\.max\(\(timestamp - lastDrawTimestamp\) \/ 1000, 0\)/)
  assert.match(source, /phase \+= elapsed \* profile\.speed/)
  assert.doesNotMatch(source, /lastAnimationTimestamp/)
  assert.match(source, /uDrift \* vec2\(sin\(uTime\), cos\(uTime \* 0\.78\)\)/)
  assert.match(source, /requestAnimationFrame\(animate\)/)
  assert.doesNotMatch(source, /webgl-performance/)
  assert.match(source, /function scheduleInteractiveRender/)
  assert.match(source, /surface\?\.draw\(phase\)/)
  assert.match(source, /uniform4f\(sceneLocation, metrics\.width, metrics\.height, time, 4\)/)
  assert.match(source, /uniform4f\(transformLocation, 6769\.0, 1\.29, profile\.drift, 0\.0\)/)
  assert.match(source, /gl_FragColor = vec4\(clamp\(color, 0\.0, 1\.0\), 1\.0\)/)
  assert.match(source, /premultipliedAlpha: true/)
  assert.match(source, /const canvas = createCanvas\(wrapper\.ownerDocument\)/)
  assert.match(source, /wrapper\.append\(canvas\)/)
  assert.match(source, /canvas\.remove\(\)/)
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  assert.doesNotMatch(source, /function releaseWebglSurface\(\)/)
  assert.match(source, /IntersectionObserver/)
  assert.match(source, /documentRef\.addEventListener\("visibilitychange"/)
  assert.match(source, /siabHeroAmbientStatus = "interactive"/)
  assert.match(entrypoint, /import\("\.\/blocks\/hero\/hero-ambient-effect"\)/)
  assert.doesNotMatch(entrypoint, /export \{ initializeHeroAmbientEffects \}/)
})

test("mesh background follows color mode while reserving stronger theme tint for the overlay", () => {
  const source = readFileSync(new URL("./hero/hero-mesh-effect.ts", import.meta.url), "utf8")
  const entrypoint = readFileSync(new URL("../index.ts", import.meta.url), "utf8")
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(source, /from "@paper-design\/shaders"/)
  assert.match(source, /from "@paper-design\/shaders"/)
  assert.match(source, /sourceMeshGradientFragmentShader/)
  assert.match(source, /const SOURCE_BASE_SPEED = 0\.25/)
  assert.match(source, /const SOURCE_OVERLAY_SPEED = 0\.15/)
  assert.match(source, /const MESH_MIN_PIXEL_RATIO = 1/)
  assert.match(source, /const MESH_MAX_PIXEL_COUNT = 1920 \* 1080/)
  assert.match(source, /const MESH_TARGET_FPS = 30/)
  assert.match(source, /const MESH_FRAME_INTERVAL_MS = 1000 \/ MESH_TARGET_FPS/)
  assert.match(source, /const MESH_PRELOAD_VIEWPORT_MULTIPLIER = 1/)
  assert.match(source, /const SOURCE_BASE_COLORS/)
  assert.match(source, /0\.1019607843/)
  assert.match(source, /0\.1803921569/)
  assert.match(source, /const SOURCE_OVERLAY_COLORS/)
  assert.match(source, /from "\.\/hero-color-tokens"/)
  assert.match(source, /const MESH_LIGHT_BASE_ACCENT_TINT = 0\.72/)
  assert.match(source, /const MESH_LIGHT_OVERLAY_ACCENT_TINT = 0\.84/)
  assert.match(source, /const MESH_LIGHT_NEUTRAL_LIFT = 0\.72/)
  assert.match(source, /const MESH_LIGHT_OVERLAY_NEUTRAL_MIX = 0\.22/)
  assert.match(source, /const MESH_DARK_BASE_THEME_TINT = 0\.46/)
  assert.match(source, /const MESH_DARK_OVERLAY_THEME_TINT = 0\.46/)
  assert.match(source, /const MESH_DARK_OVERLAY_SECONDARY_TINT = 0\.28/)
  assert.match(source, /const MESH_DARKEN = 0\.04/)
  assert.match(source, /function readMeshColorMode/)
  assert.match(source, /if \(mode === "light"\)/)
  assert.match(source, /const canvasMode = canvas\?\.dataset\.rtMode/)
  assert.match(source, /if \(canvasMode === "light" \|\| canvasMode === "dark"\) return canvasMode/)
  assert.match(source, /documentElement\.dataset\.siabColorMode === "dark"/)
  assert.match(source, /readTokenColor\(wrapper, "--background", SOURCE_WHITE_RGB\)/)
  assert.match(source, /readTokenColor\(wrapper, "--siab-neutral-100", background\)/)
  assert.match(source, /readTokenColor\(wrapper, "--siab-neutral-200", neutral100\)/)
  assert.match(source, /readTokenColor\(\s*wrapper,\s*"--siab-accent-secondary-700"/)
  assert.match(source, /readTokenColor\(wrapper, "--siab-accent-500", primary\)/)
  assert.match(source, /readTokenColor\(wrapper, "--siab-accent-300", primary\)/)
  assert.match(source, /mixRgb\(neutral200, lightAccent, MESH_LIGHT_BASE_ACCENT_TINT\)/)
  assert.match(source, /mixRgb\(neutral200, lightAccent, MESH_LIGHT_OVERLAY_ACCENT_TINT\)/)
  assert.match(source, /mixRgb\(neutral200, background, MESH_LIGHT_NEUTRAL_LIFT\)/)
  assert.match(source, /mixRgb\(background, neutral100, MESH_LIGHT_OVERLAY_NEUTRAL_MIX\)/)
  assert.match(source, /mixRgb\(SOURCE_WHITE_RGB, darkAccent, MESH_DARK_BASE_THEME_TINT\)/)
  assert.match(source, /mixRgb\(SOURCE_WHITE_RGB, darkAccent, MESH_DARK_OVERLAY_THEME_TINT\)/)
  assert.match(source, /mixRgb\(shaderRgb\(SOURCE_OVERLAY_COLORS\[2\]\), darkSecondaryAccent, MESH_DARK_OVERLAY_SECONDARY_TINT\)/)
  assert.match(source, /function readMeshPalettes/)
  assert.match(source, /function meshPaletteKey/)
  assert.match(source, /u_distortion: 0\.8/)
  assert.match(source, /u_swirl: 0\.1/)
  assert.match(source, /u_fit: 1/)
  assert.match(source, /hero-mesh-layer-\$\{layerName\}/)
  assert.match(source, /new ShaderMount\(/)
  assert.match(source, /IntersectionObserver/)
  assert.match(source, /threshold: 0/)
  assert.match(source, /function withinPreloadWindow/)
  assert.match(source, /windowRef\.addEventListener\("scroll", schedulePositionCheck/)
  assert.match(source, /windowRef\.addEventListener\("resize", schedulePositionCheck/)
  assert.doesNotMatch(source, /monitorFrameRate|static-performance|performanceLimited/)
  assert.match(source, /layer\.frame \+= elapsed \* layer\.sourceSpeed/)
  assert.match(source, /layer\.mount\.setFrame\(layer\.frame\)/)
  assert.match(source, /windowRef\.requestAnimationFrame/)
  assert.match(source, /windowRef\.cancelAnimationFrame/)
  assert.doesNotMatch(source, /animates: boolean/)
  assert.match(source, /MESH_MIN_PIXEL_RATIO,[\s\S]*MESH_MAX_PIXEL_COUNT/)
  assert.doesNotMatch(source, /u_grainMixer|u_grainOverlay/)
  assert.match(source, /const disableMesh = \(status: "webgl-unavailable" \| "context-lost"\)/)
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  assert.match(source, /layer\.mount\.setFrame\(0\)/)
  assert.match(source, /windowRef\.document\.addEventListener\("visibilitychange"/)
  assert.match(source, /themeObserver = new windowRef\.MutationObserver/)
  assert.match(source, /setUniforms\(shaderUniforms\(nextPalettes\.base\)\)/)
  assert.match(source, /setUniforms\(shaderUniforms\(nextPalettes\.overlay\)\)/)
  assert.match(source, /webglcontextlost/)
  assert.doesNotMatch(source, /framer-motion|lucide-react/)
  assert.match(styles, /\.hero-lead-background-mesh,[\s\S]*background: var\(--background\)/)
  assert.match(styles, /\.hero-mesh-layer-base\s*\{[\s\S]*background: var\(--background\)/)
  assert.match(styles, /\.rt-canvas \.hero-mesh-copy-safe\s*\{[\s\S]*color: var\(--foreground\)/)
  assert.match(entrypoint, /import\("\.\/blocks\/hero\/hero-mesh-effect"\)/)
  assert.doesNotMatch(entrypoint, /export \{ initializeHeroMeshEffects \}/)
})

test("service panel follows the shared hero background token and swaps selected service content", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-02")
  assert.ok(base)
  const block = BlockSchema.parse(base)

  for (const mode of BACKGROUND_MODE_IDS) {
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /hero-service-panel-copy/)
    assert.doesNotMatch(html, /hero-service-selection-details|data-siab-hero-service-detail-index=/)
    assert.equal((html.match(/data-siab-hero-service-copy-index=/g) ?? []).length, 12)
    assert.equal((html.match(/aria-controls="hero-service-panel-0-copy"/g) ?? []).length, 4)
    assert.match(html, /Voor woningen/)
    assert.match(html, /Een nette, bruikbare ruimte voor dagelijks werk\./)
    assert.match(html, /Een werkplek die prettig blijft werken/)
    assert.match(html, /Van kleine aanpassing tot zorgvuldig onderhoud: kies de aanpak die bij de ruimte past\./)

    if (mode === "none") {
      assert.doesNotMatch(html, /data-siab-background-mode=|data-siab-hero-media|hero-lead-media-|hero-lead-background-/)
    } else if (mode === "image") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 8)
      assert.match(html, /data-siab-hero-service-media-index="3"/)
      assert.match(html, /hero-lead-media-glass/)
    } else if (mode === "animation") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed/)
      assert.match(html, /data-siab-hero-dither-effect="true"/)
    } else if (mode === "grid") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed|data-siab-hero-dither-effect/)
      assert.match(html, /hero-lead-grid-field/)
    } else if (mode === "mesh") {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed|hero-lead-grid-field|data-siab-hero-dither-effect|hero-lead-background-ambient/)
      assert.match(html, /data-siab-hero-mesh-effect="true"/)
      assert.match(html, /hero-lead-background-mesh/)
    } else {
      assert.match(html, new RegExp(`data-siab-background-mode="${mode}"`))
      assert.doesNotMatch(html, /data-siab-hero-media|hero-lead-media-glass|hero-lead-media-bleed|hero-lead-grid-field|data-siab-hero-dither-effect/)
      assert.match(html, /hero-lead-background-ambient/)
    }
  }
})

test("image-led heroes keep a meaningful alt fallback when media metadata is incomplete", () => {
  const block = BlockSchema.parse({
    blockType: "hero",
    variant: "hero-04",
    heading: "Zorgvuldig onderhoud aan huis",
    body: "Praktische hulp voor jouw woning.",
    primaryAction: { label: "Neem contact op", href: "#contact" },
    image: { url: "/media/service.jpg" },
  })
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block, options: { index: 0 } }),
  )
  assert.match(html, /alt="Zorgvuldig onderhoud aan huis"/)
})

test("the remaining source-informed hero additions keep distinct media, pattern and service compositions", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  const render = (blockType) => renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      block: BlockSchema.parse(fixtureBlocks.get(blockType)),
      options: { index: 0, theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: "image" } } },
    }),
  )

  const patternSplit = render("hero-05")
  assert.match(patternSplit, /data-siab-hero-design="pattern-split"/)
  assert.match(patternSplit, /lg:grid-cols-\[minmax\(0,0\.95fr\)_minmax\(24rem,1\.05fr\)\]/)
  assert.equal((patternSplit.match(/data-siab-hero-media/g) ?? []).length, 1)
  assert.match(patternSplit, /<img\b/)
  assert.match(patternSplit, /siab-hero-offset-plane[^>]*z-10/)
  assert.doesNotMatch(patternSplit, /border border-border/)
  assert.doesNotMatch(patternSplit, /style="[^"]*background-image/)
  assert.doesNotMatch(patternSplit, /siab-hero-(dot-grid|lead-pattern)/)

  const servicePanel = render("hero-02")
  assert.match(servicePanel, /data-siab-hero-design="service-panel"/)
  assert.match(servicePanel, /hero-service-panel-stage/)
  assert.match(servicePanel, /items-center overflow-hidden/)
  assert.match(servicePanel, /text-center/)
  assert.match(servicePanel, /headingClassName|mx-auto max-w-\[18ch\]/)
  assert.match(servicePanel, /hero-service-panel-rail/)
  assert.doesNotMatch(servicePanel, /svh/)
  assert.match(servicePanel, /hero-lead-media-backdrop/)
  assert.match(servicePanel, /hero-lead-media-glass/)
  assert.match(servicePanel, /hero-lead-media-bleed/)
  assert.match(servicePanel, /hero-lead-media-overlay/)
  assert.equal((servicePanel.match(/hero-lead-media-overlay/g) ?? []).length, 2)
  assert.match(servicePanel, /sizes="\(min-width: 120rem\) 120rem, 100vw"/)
  assert.doesNotMatch(servicePanel, /siab-hero-cover-overlay/)
  assert.match(servicePanel, /lg:grid-cols-\[repeat\(auto-fit,minmax\(0,1fr\)\)\]/)
  assert.match(servicePanel, /items-stretch/)
  assert.match(servicePanel, /type="radio"/)
  assert.match(servicePanel, /name="hero-service-panel-0"/)
  assert.match(servicePanel, /hero-service-option-surface/)
  assert.match(servicePanel, /checked=""/)
  assert.match(servicePanel, /data-siab-hero-service-media-index="1"/)
  assert.match(servicePanel, /data-siab-hero-service-media-index="3"/)
  assert.match(servicePanel, /fixture-media\/workspace\.webp/)
  assert.match(servicePanel, /fixture-media\/project-kitchen\.webp/)
  assert.match(servicePanel, /<svg[^>]*aria-hidden="true"/)
  assert.doesNotMatch(servicePanel, />01<|>02<|>03</)
  assert.doesNotMatch(servicePanel, /bg-card\/95/)
  assert.match(servicePanel, /Voor woningen/)
  assert.match(servicePanel, /Voor werkplekken/)
  assert.match(servicePanel, /Voor kleine bedrijven/)
  assert.match(servicePanel, /Onderhoud en herstel/)
  assert.doesNotMatch(servicePanel, /hero-primary-action\]:h-|hero-primary-action\]:min-h-|hero-primary-action\]:px-12/)
  assert.match(servicePanel, /hero-primary-action/)
  assert.match(servicePanel, /whitespace-nowrap/)

})

test("service highlight compositions use an inverse neutral selected surface", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\)[\s\S]*background-color: var\(--foreground\)/)
  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\)[\s\S]*color: var\(--background\)/)
  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\)[\s\S]*box-shadow: none/)
  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\) \.hero-service-option-icon[\s\S]*background-color: color-mix\(in oklab, var\(--background\) 16%, transparent\)/)
  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\) \.hero-service-option-icon[\s\S]*color: var\(--background\)/)
  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:has\(> \.hero-service-option-input:checked\) \.hero-service-option-body[\s\S]*color: var\(--background\)/)
})

test("service panel uses content-driven phone spacing and keeps its desktop composition", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /\.hero-service-panel-stage\s*\{[\s\S]*min-height:\s*auto;[\s\S]*padding-block:\s*clamp\(3rem, 9vw, 4rem\)/)
  assert.match(styles, /\.hero-service-panel-rail\s*\{[\s\S]*margin-top:\s*-1\.5rem/)
  assert.match(styles, /@media \(min-width: 40rem\)[\s\S]*\.hero-service-panel-stage\s*\{[\s\S]*min-height:\s*36rem/)
  assert.match(styles, /@media \(min-width: 64rem\)[\s\S]*\.hero-service-panel-stage\s*\{[\s\S]*min-height:\s*42rem/)
})

test("service highlight composition hover is clearer without adding another border", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /\[data-siab-hero-design="service-panel"\] \.hero-service-option:hover:not\(:has\(> \.hero-service-option-input:checked\)\)[\s\S]*background-color: color-mix\(in oklab, var\(--accent\) 48%, var\(--card\)\)/)
  assert.match(styles, /\.rt-canvas\[data-rt-mode="dark"\] \[data-siab-hero-design="service-panel"\] \.hero-service-option:hover:not\(:has\(> \.hero-service-option-input:checked\)\)[\s\S]*background-color: color-mix\(in oklab, var\(--accent\) 28%, var\(--card\)\)/)
  assert.match(styles, /html\[data-siab-color-mode="dark"\] \.rt-canvas \[data-siab-hero-design="service-panel"\] \.hero-service-option:hover:not\(:has\(> \.hero-service-option-input:checked\)\)[\s\S]*background-color: color-mix\(in oklab, var\(--accent\) 28%, var\(--card\)\)/)
})

test("service highlight selection covers four media and central-copy states", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /nth-child\(4\) > \.hero-service-option-input:checked\)[\s\S]*data-siab-hero-service-media-index="3"/)
  assert.match(styles, /nth-child\(4\) > \.hero-service-option-input:checked\)[\s\S]*data-siab-hero-service-copy-index="3"/)
  assert.match(styles, /\.hero-service-copy-heading-panel:first-child,[\s\S]*display: block/)
})

test("hero actions share fixed geometry and static arrows", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.match(styles, /\.rt-canvas a\.hero-action \{[\s\S]*height: clamp\(3\.25rem, 5\.5vw, 3\.5rem\);[\s\S]*min-height: clamp\(3\.25rem, 5\.5vw, 3\.5rem\);[\s\S]*padding-inline: clamp\(1\.25rem, 2\.5vw, 2rem\);[\s\S]*white-space: nowrap;[\s\S]*transition-property: background-color, border-color, color;/)
  assert.match(styles, /a\.hero-primary-action \{[\s\S]*border: 1px solid var\(--primary\);[\s\S]*background-color: var\(--primary\)/)
  assert.match(styles, /a\.hero-primary-action:hover[\s\S]*background-color: color-mix\(in oklab, var\(--primary\) 78%, var\(--primary-foreground\)\)/)
  assert.match(styles, /a\.hero-primary-action:hover[\s\S]*border-color: color-mix\(in oklab, var\(--primary\) 78%, var\(--primary-foreground\)\)/)
  assert.match(styles, /a\.hero-secondary-action \{[\s\S]*border: 1px solid color-mix\(in oklab, var\(--foreground\) 58%, transparent\)[\s\S]*background-color: transparent/)
  assert.match(styles, /a\.hero-secondary-action:hover[\s\S]*border-color: color-mix\(in oklab, var\(--foreground\) 72%, transparent\)[\s\S]*background-color: color-mix\(in oklab, var\(--foreground\) 10%, transparent\)/)
  assert.doesNotMatch(styles, /background-size: 100% 100%|linear-gradient\(to right, var\(--foreground\)|linear-gradient\(to right, var\(--primary\)/)
  const heroActionStyles = styles.slice(styles.indexOf(".rt-canvas a.hero-action"), styles.indexOf("/* Services 01"))
  assert.equal(
    (heroActionStyles.match(/box-shadow:/g) ?? []).length,
    (heroActionStyles.match(/box-shadow:\s*none;/g) ?? []).length,
  )
  assert.match(styles, /\.hero-action-arrow \{[\s\S]*transform: none;[\s\S]*transition: none;/)
  assert.doesNotMatch(styles, /\.group:hover \.hero-action-arrow|\.group:focus-visible \.hero-action-arrow/)
  assert.match(styles, /a\.hero-secondary-action/)
})

test("hero rendering does not emit catalog labels or review pills", () => {
  const html = renderToStaticMarkup(
    React.createElement(SitePageRenderer, {
      page: v1FixturePage,
      settings: v1FixtureSettings,
      includeBehaviorScripts: false,
    }),
  )
  assert.doesNotMatch(html, /data-siab-review-label|data-siab-review-chip|siab-hero-review-label/)
})

test("remaining hero designs keep their source-informed composition boundaries", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  const render = (blockType) => renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: BlockSchema.parse(fixtureBlocks.get(blockType)), options: { index: 0 } }),
  )

  const lead = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: BlockSchema.parse({ ...fixtureBlocks.get("hero-01"), image: undefined }), options: { index: 0 } }),
  )
  assert.match(lead, /data-siab-background-mode="animation"/)
  assert.match(lead, /data-siab-hero-dither-effect="true"/)
  assert.doesNotMatch(lead, /siab-hero-lead-pattern|bg-primary\/10/)

  const framed = render("hero-04")
  assert.match(framed, /data-siab-hero-design="framed"/)
  assert.match(framed, /items-start/)
  assert.match(framed, /text-\[clamp\(2\.25rem,9vw,3\.5rem\)\]/)
  assert.match(framed, /translate-x-3 translate-y-3/)
  assert.match(framed, /siab-hero-offset-plane/)
  assert.match(framed, /mt-12 sm:mt-16 lg:mt-20/)
  assert.match(framed, /aspect-\[4\/3\]/)
  assert.match(framed, /sm:aspect-\[3\/2\]/)
  assert.match(framed, /lg:aspect-\[3\/2\]/)
  assert.doesNotMatch(framed, /ring-1 ring-border\/60/)
  assert.match(framed, /hero-primary-action/)

  const angled = render("hero-03")
  assert.match(angled, /data-siab-hero-design="angled"/)
  assert.match(angled, /aspect-\[4\/3\]/)
  assert.match(angled, /sm:aspect-\[3\/2\]/)
    assert.equal((angled.match(/\[clip-path:polygon/g) ?? []).length, 2)
    assert.match(angled, /hero-angled-edge-left/)
    assert.match(angled, /hero-angled-edge-right/)
    assert.match(angled, /hero-angled-edge-left[^>]*clip-path:polygon\(-1px_0,52%_0,100%_100%/)
  assert.match(angled, /hero-angled-edge-right[^>]*clip-path:polygon\(calc\(100%\+1px\)_0,0_0,48%_100%/)
  assert.match(angled, /w-\[clamp\(5rem,7vw,6rem\)\]/)
  assert.match(angled, /hero-angled-media-slot[^>]*lg:absolute[^>]*lg:inset-y-0[^>]*lg:right-0[^>]*lg:w-1\/2/)
  assert.match(angled, /bg-background/)
  assert.match(angled, /bg-primary text-primary-foreground/)
  assert.match(angled, /hero-edge-copy[^>]*z-40[^>]*min-h-full/)
  assert.match(angled, /hero-angled-media-frame[^>]*z-30/)
  assert.match(angled, /hero-angled-edge-left[^>]*z-10/)
  assert.match(angled, /hero-angled-edge-right[^>]*z-10/)
  assert.doesNotMatch(angled, /hero-edge-copy[^>]*bg-background/)
  assert.match(angled, /grid min-h-0 w-full items-stretch/)
  assert.doesNotMatch(angled, /hero-primary-action\]:whitespace-normal|hero-primary-action\]:break-words/)
  assert.doesNotMatch(angled, /shadow-xl|border-l|border-y/)
  assert.ok(angled.indexOf("hero-primary-action") < angled.indexOf("data-siab-hero-media"), "angled copy must precede media in DOM order")
  assert.match(angled, /min-w-44 max-w-full justify-center whitespace-nowrap/)

  const angledWithSecondary = BlockSchema.parse({
    ...fixtureBlocks.get("hero-03"),
    secondaryAction: { label: "Bekijk diensten", href: "#services" },
  })
  const angledWithSecondaryHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { block: angledWithSecondary, options: { index: 0 } }),
  )
  assert.match(angledWithSecondaryHtml, /hero-secondary-action/)
  assert.match(angledWithSecondaryHtml, /max-w-full justify-center whitespace-nowrap/)
  assert.match(angledWithSecondaryHtml, /href="#services"/)
})

test("angled keeps its image while background effects remain additive", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-03")
  assert.ok(base)
  const block = BlockSchema.parse(base)

  for (const mode of BACKGROUND_MODE_IDS) {
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /data-siab-hero-design="angled"/)
    assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 1)
    if (mode === "none") {
      assert.doesNotMatch(html, /data-siab-background-mode=|hero-angled-background-|hero-angled-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "image") {
      assert.doesNotMatch(html, /hero-angled-background-animation|hero-angled-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "animation") {
      assert.match(html, /data-siab-background-mode="animation"/)
      assert.match(html, /hero-angled-background-animation/)
      assert.match(html, /data-siab-hero-dither-effect="true"/)
      assert.doesNotMatch(html, /hero-angled-grid-field/)
    } else if (mode === "grid") {
      assert.match(html, /data-siab-background-mode="grid"/)
      assert.match(html, /hero-angled-grid-field/)
      assert.doesNotMatch(html, /data-siab-hero-dither-effect/)
    } else if (mode === "mesh") {
      assert.match(html, /data-siab-background-mode="mesh"/)
      assert.match(html, /data-siab-hero-mesh-effect="true"/)
      assert.match(html, /hero-angled-background-mesh[^>]*z-20/)
    } else {
      assert.match(html, /data-siab-background-mode="ambient"/)
      assert.match(html, /hero-angled-background-ambient|hero-ambient-field/)
      assert.match(html, /hero-ambient-field[^>]*data-siab-hero-ambient-effect="true"/)
      assert.doesNotMatch(html, /hero-angled-background-animation|hero-angled-grid-field|data-siab-hero-dither-effect/)
    }
  }
})

test("angled effect layers stay scoped, centered, and quieter than the lead treatment", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.ok(styles.includes(".hero-lead-dither-canvas {\n  display: block;\n  width: 100%;\n  height: 100%;\n  opacity: 0.18"))
  assert.ok(styles.includes('html[data-siab-color-mode="dark"] :where(.rt-canvas) .hero-lead-dither-canvas {\n  opacity: 0.18'))
  assert.ok(styles.includes(".hero-angled-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18"))
  assert.ok(styles.includes('html[data-siab-color-mode="dark"] :where(.rt-canvas) .hero-angled-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18'))
  assert.ok(styles.includes("radial-gradient(ellipse at center"))
  assert.ok(styles.includes(".hero-lead-grid-field,\n.hero-angled-grid-field,\n.hero-framed-grid-field,\n.hero-pattern-split-grid-field {\n  -webkit-mask-image: radial-gradient(ellipse at center"))
  assert.ok(styles.includes(".hero-angled-grid-field {\n  --siab-hero-angled-grid-line"))
  assert.ok(styles.includes("linear-gradient(to right, var(--siab-hero-angled-grid-line)"))
  assert.ok(styles.includes("mix-blend-mode: soft-light"))
  assert.ok(styles.includes("hero-angled-background-animation .hero-lead-dither-canvas {\n    opacity: 0.14"))
  assert.equal(styles.includes(".hero-angled-background-grid {\n  background-color: var(--background)"), false)
  assert.ok(styles.includes(".hero-angled-media-frame {\n    clip-path: polygon("))
  assert.ok(styles.includes("clamp(2.6rem, 3.64vw, 3.12rem) 0"))
})

test("framed keeps its image while background effects remain additive", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-04")
  assert.ok(base)
  const block = BlockSchema.parse(base)

  for (const mode of BACKGROUND_MODE_IDS) {
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /data-siab-hero-design="framed"/)
    assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 1)
    assert.match(html, /siab-hero-offset-plane[^>]*z-10/)
    assert.match(html, /hero-primary-action/)
    if (mode === "none") {
      assert.doesNotMatch(html, /data-siab-background-mode=|hero-framed-background-|hero-framed-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "image") {
      assert.doesNotMatch(html, /hero-framed-background-animation|hero-framed-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "animation") {
      assert.match(html, /data-siab-background-mode="animation"/)
      assert.match(html, /hero-framed-background-animation/)
      assert.match(html, /hero-framed-background-animation[^>]*z-0/)
      assert.match(html, /data-siab-hero-dither-effect="true"/)
      assert.doesNotMatch(html, /hero-framed-grid-field/)
    } else if (mode === "grid") {
      assert.match(html, /data-siab-background-mode="grid"/)
      assert.match(html, /hero-framed-grid-field/)
      assert.match(html, /hero-framed-background-grid[^>]*z-0/)
      assert.doesNotMatch(html, /data-siab-hero-dither-effect/)
    } else if (mode === "mesh") {
      assert.match(html, /data-siab-background-mode="mesh"/)
      assert.match(html, /data-siab-hero-mesh-effect="true"/)
      assert.match(html, /hero-framed-background-mesh[^>]*z-0/)
    } else {
      assert.match(html, /data-siab-background-mode="ambient"/)
      assert.match(html, /hero-framed-background-ambient|hero-ambient-field/)
      assert.match(html, /hero-framed-background-ambient[^>]*z-0/)
      assert.match(html, /hero-ambient-field[^>]*data-siab-hero-ambient-effect="true"/)
      assert.match(html, /data-siab-hero-ambient-profile="framed"/)
      assert.doesNotMatch(html, /hero-framed-background-animation|hero-framed-grid-field|data-siab-hero-dither-effect/)
    }
  }
})

test("framed background effects keep the image card and copy above the treatment", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.ok(styles.includes(".hero-framed-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18"))
  assert.ok(styles.includes('html[data-siab-color-mode="dark"] :where(.rt-canvas) .hero-framed-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18'))
  assert.ok(styles.includes(".hero-framed-grid-field {\n  --siab-hero-framed-grid-line"))
  assert.ok(styles.includes("mix-blend-mode: soft-light"))
})

test("pattern split keeps its image while background effects remain additive", () => {
  const base = v1FixturePage.blocks.find((candidate) => candidate.blockType === "hero" && candidate.variant === "hero-05")
  assert.ok(base)
  const block = BlockSchema.parse(base)

  for (const mode of BACKGROUND_MODE_IDS) {
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
        options: {
          index: 0,
          theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: mode } },
        },
      }),
    )

    assert.match(html, /data-siab-hero-design="pattern-split"/)
    assert.equal((html.match(/data-siab-hero-media/g) ?? []).length, 1)
    assert.match(html, /hero-pattern-split-media|hero-pattern-split-background/)
    assert.match(html, /hero-pattern-split-media[^>]*z-30/)
    assert.match(html, /relative z-40/)
    assert.doesNotMatch(html, /style="[^"]*background-image/)
    if (mode === "none") {
      assert.doesNotMatch(html, /data-siab-background-mode=|hero-pattern-split-background-|hero-pattern-split-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "image") {
      assert.doesNotMatch(html, /hero-pattern-split-background-animation|hero-pattern-split-grid-field|data-siab-hero-dither-effect/)
    } else if (mode === "animation") {
      assert.match(html, /data-siab-background-mode="animation"/)
      assert.match(html, /hero-pattern-split-background-animation/)
      assert.match(html, /hero-pattern-split-background-animation[^>]*z-0/)
      assert.match(html, /data-siab-hero-dither-effect="true"/)
      assert.doesNotMatch(html, /hero-pattern-split-grid-field/)
    } else if (mode === "grid") {
      assert.match(html, /data-siab-background-mode="grid"/)
      assert.match(html, /hero-pattern-split-grid-field/)
      assert.match(html, /hero-pattern-split-background-grid[^>]*z-0/)
      assert.doesNotMatch(html, /data-siab-hero-dither-effect/)
    } else if (mode === "mesh") {
      assert.match(html, /data-siab-background-mode="mesh"/)
      assert.match(html, /data-siab-hero-mesh-effect="true"/)
      assert.match(html, /hero-pattern-split-background-mesh[^>]*z-0/)
    } else {
      assert.match(html, /data-siab-background-mode="ambient"/)
      assert.match(html, /hero-pattern-split-background-ambient|hero-ambient-field/)
      assert.match(html, /hero-pattern-split-background-ambient[^>]*z-0/)
      assert.match(html, /hero-ambient-field[^>]*data-siab-hero-ambient-effect="true"/)
      assert.doesNotMatch(html, /hero-pattern-split-background-animation|hero-pattern-split-grid-field|data-siab-hero-dither-effect/)
    }
  }
})

test("pattern split background effects stay behind the supplied image and copy", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

  assert.ok(styles.includes(".hero-pattern-split-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18"))
  assert.ok(styles.includes('html[data-siab-color-mode="dark"] :where(.rt-canvas) .hero-pattern-split-background-animation .hero-lead-dither-canvas {\n  opacity: 0.18'))
  assert.ok(styles.includes(".hero-pattern-split-grid-field {\n  --siab-hero-pattern-split-grid-line"))
  assert.ok(styles.includes("mix-blend-mode: soft-light"))
})

test("every image-led hero uses a real fixture media element without an inner card spacer", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  const imageHeroTypes = HERO_VARIANTS.filter((variant) => !HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA.includes(variant))

  for (const blockType of imageHeroTypes) {
    const block = BlockSchema.parse(fixtureBlocks.get(blockType))
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, {
        block,
      options: { index: 0, theme: { ...v1FixtureTheme, appearance: { mode: "light", backgroundMode: "image" } } },
      }),
    )
    const mediaMarker = html.indexOf("data-siab-hero-media")
    assert.notEqual(mediaMarker, -1, `${blockType} should expose its media frame`)
    const mediaEnd = html.indexOf("</div>", mediaMarker)
    assert.notEqual(mediaEnd, -1, `${blockType} should close its media frame`)
    const mediaHtml = html.slice(mediaMarker, mediaEnd + "</div>".length)
    assert.match(mediaHtml, />\s*<img\b/, `${blockType} should render the image directly inside its frame`)
    assert.doesNotMatch(mediaHtml, />\s*<div\b/, `${blockType} should not add an inner spacer/card around the image`)
    assert.doesNotMatch(mediaHtml, /\bp-[23](?:\s|\")/, `${blockType} should not add the old inner padding gap`)
  }
})

test("hero surfaces remain content-driven and keep angled media inside the site frame", () => {
  const fixtureBlocks = new Map(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))
  const containedSplitTypes = ["hero-03"]

  for (const variant of HERO_VARIANTS) {
    const block = BlockSchema.parse(fixtureBlocks.get(variant))
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, { block, options: { index: 0 } }),
    )
    assert.match(html, /data-siab-hero-design=/)
    assert.doesNotMatch(html, /data-siab-hero-height|hero-height-fill|hero-viewport-height/)
  }

  for (const blockType of containedSplitTypes) {
    const block = BlockSchema.parse(fixtureBlocks.get(blockType))
    const html = renderToStaticMarkup(
      React.createElement(BlockRenderer, { block, options: { index: 0 } }),
    )
    assert.match(html, /max-w-7xl/)
    assert.doesNotMatch(html, /data-siab-hero-bleed="right"/)
    assert.match(html, /items-stretch/)
    assert.match(html, /aspect-\[4\/3\]/)
    assert.match(html, /lg:aspect-auto/)
  }
})
