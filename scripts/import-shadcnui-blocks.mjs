#!/usr/bin/env node

import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(new URL("../packages/site-renderer/package.json", import.meta.url))
const ts = require("typescript")

const REPOSITORY = "https://github.com/akash3444/shadcn-ui-blocks.git"
const COMMIT = "46c2e50bb538c9bc7a8927979d38bae178ae4452"
const REGISTRY_FILE = "registry-radix.json"
const PROVIDER = "shadcnui-blocks"
const NAMESPACE = "shadcnui-blocks"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const providerRoot = join(root, "packages/site-renderer/src/providers/shadcnui-blocks")
const variantsRoot = join(providerRoot, "variants")
const uiProviderRoot = join(root, "packages/ui/src/providers/shadcnui-blocks/radix-nova")
const generatedRoot = join(root, "packages/contracts/src/generated")
const bindingManifestPath = join(providerRoot, "bindings.json")
const tokenExceptionManifestPath = join(providerRoot, "token-exceptions.json")

const compatibilityPrimitives = [
  "accordion", "animated-grid-pattern", "avatar", "badge", "button", "card", "carousel", "chart",
  "checkbox", "dot-pattern", "input", "label", "marquee", "navigation-menu", "particles", "popover",
  "select", "separator", "sheet", "tabs", "textarea", "tooltip",
]

const publicCategories = new Set([
  "banner", "blog", "contact", "cta", "faq", "features", "footer", "hero",
  "integrations", "logo-cloud", "navbar", "pricing", "stats", "team",
  "testimonials", "timeline",
])

const categoryFor = (name) => name.replace(/-\d+$/, "")
const isPublic = (name) => publicCategories.has(categoryFor(name)) || /^carousel-block-\d+$/.test(name)
const isSystem = (name) => /^not-found-\d+$/.test(name)
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`
const transparentSquare = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E"

async function fileInventory(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await fileInventory(path))
    else if (entry.isFile()) {
      const contents = await readFile(path)
      files.push({ path: relative(root, path), sha256: sha256(contents) })
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

function adaptLiteralImports(contents) {
  const clientDirective = contents.match(/^\s*(["']use client["'];?)\s*/)
  const literalBody = clientDirective ? contents.slice(clientDirective[0].length) : contents
  const nativeImageImport = contents.includes("<img") && !/from ["']next\/image["']/.test(contents)
    ? 'import Image from "../../runtime/image";\n'
    : ""
  return `// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations\n${clientDirective ? `${clientDirective[1]}\n` : ""}${nativeImageImport}${literalBody.replaceAll("<img", "<Image")}`
    .replaceAll('import { Accordion as AccordionPrimitive } from "radix-ui";', 'import { AccordionPrimitive } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";')
    .replaceAll('import {\n  DribbbleIcon,\n  GithubIcon,\n  TwitchIcon,\n  TwitterIcon,\n} from "lucide-react";', 'import { DribbbleIcon, GithubIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons";')
    .replaceAll('import { Dribbble, Github, Twitter, Wheat } from "lucide-react";', 'import { Wheat } from "lucide-react";\nimport { Dribbble, Github, Twitter } from "../../runtime/social-icons";')
    .replaceAll(/import \{ (Dribbble(?:Icon)?), (Github|TwitchIcon), (Twitter(?:Icon)?) \} from ["']lucide-react["'];?/g, 'import { $1, $2, $3 } from "../../runtime/social-icons";')
    .replaceAll(/from ["']next\/link["']/g, 'from "../../runtime/link"')
    .replaceAll(/from ["']next\/image["']/g, 'from "../../runtime/image"')
    .replaceAll(/from ["']@\/lib\/utils["']/g, 'from "@siteinabox/ui/lib/utils"')
    .replaceAll(/import (\w+) from ["']@\/registry\/bases\/radix\/ui\/([^"']+)["']/g, 'import $1 from "./$2"')
    .replaceAll(/from ["']@\/registry\/bases\/radix\/ui\/[^"']+["']/g, 'from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"')
    .replaceAll(/import \{ Button \} from ["']@\/registry\/ui\/button["'];?/g, 'import { SharedButton as Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";')
    .replaceAll(/from ["']@\/components\/logos["']/g, 'from "../../runtime/logos"')
    .replaceAll(/from ["']@\/components\/[^"']*\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']@\/registry\/[^"']+\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']\.\/[^"']+\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']next-themes["']/g, 'from "../../runtime/theme"')
    .replaceAll("clip-path=", "clipPath=")
    .replaceAll("clip-rule=", "clipRule=")
    .replaceAll("color-interpolation-filters=", "colorInterpolationFilters=")
    .replaceAll("fill-rule=", "fillRule=")
    .replaceAll("flood-opacity=", "floodOpacity=")
    .replaceAll("stop-color=", "stopColor=")
    .replaceAll('<TooltipTrigger className="cursor-help">', '<TooltipTrigger aria-label="More information" className="cursor-help">')
    .replace(/(<button\s*\n)(\s*)(className=\{cn\("h-3\.5 w-3\.5)/g, '$1$2aria-label={`Go to slide ${index + 1}`}\n$2$3')
    .replaceAll("categorizedFaqs[0].category", "categorizedFaqs[0]?.category ?? null")
    .replaceAll(/x=\{x \* width \+ 1\}/g, "x={(x ?? 0) * width + 1}")
    .replaceAll(/y=\{y \* height \+ 1\}/g, "y={(y ?? 0) * height + 1}")
    .replaceAll(/https?:\/\/[^"'`\s]+\.(?:avif|gif|jpe?g|png|webp)(?:\?[^"'`\s]*)?/gi, (url) => `${transparentSquare}#${sha256(url).slice(0, 12)}`)
    .replaceAll(/https?:\/\/(?!www\.w3\.org\/2000\/svg)[^"'`\s]+/g, (url) => `about:blank#upstream-${sha256(url).slice(0, 12)}`)
}

function adaptThemeHooks(name, filename, contents) {
  let adapted = contents
  const replace = (from, to) => { adapted = adapted.replaceAll(from, to) }
  if (name === "contact-02") replace("bg-white shadow-none", "bg-[var(--provider-surface,#fff)] shadow-none")
  if (name === "hero-01") {
    replace("#5E8778", "var(--provider-accent-600, #5E8778)")
    replace("#78FF86", "var(--provider-accent-300, #78FF86)")
    replace("#575EFF", "var(--provider-accent-700, #575EFF)")
    replace("#E478FF", "var(--provider-accent-400, #E478FF)")
  }
  if (name === "hero-03") {
    replace('colors = ["#5227FF", "#FF9FFC", "#B497CF"]', 'colors = ["var(--provider-accent-700, #5227FF)", "var(--provider-accent-400, #FF9FFC)", "var(--provider-accent-200, #B497CF)"]')
    replace("rounded-[1.25rem]", "rounded-[var(--provider-radius-hero-gradient,1.25rem)]")
  }
  if ((name === "pricing-09" || name === "logo-cloud-15") && filename === "border-beam.tsx") {
    replace('colorFrom = "#ffaa40"', 'colorFrom = "var(--provider-accent-400, #ffaa40)"')
    replace('colorTo = "#9c40ff"', 'colorTo = "var(--provider-accent-700, #9c40ff)"')
  }
  if (name === "logo-cloud-15" && filename === "logo-cloud.tsx") {
    replace("#ffaa40", "var(--provider-accent-400, #ffaa40)")
    replace("#9c40ff", "var(--provider-accent-700, #9c40ff)")
  }
  if (["cta-04", "cta-05", "pricing-09"].includes(name)) {
    replace("rgba(75, 85, 99, 0.08)", "var(--provider-grid-line, rgba(75, 85, 99, 0.08))")
    replace("rgba(55, 65, 81, 0.12)", "var(--provider-grid-dot, rgba(55, 65, 81, 0.12))")
  }
  return adapted
}

function adaptStructuredMediaRegions(name, filename, contents) {
  if (filename !== "hero.tsx") return contents
  const replacements = {
    "hero-02": [
      '<div className="mt-auto aspect-video w-full rounded-xl bg-accent" />',
      '<div data-provider-image-region="image" className="mt-auto aspect-video w-full rounded-xl bg-accent" />',
    ],
    "hero-03": [
      '<div className="size-full rounded-lg bg-background" />',
      '<div data-provider-image-region="image" className="size-full rounded-lg bg-background" />',
    ],
    "hero-04": [
      '<div className="aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-[calc(100vh-4rem)] lg:w-[1000px]" />',
      '<div data-provider-image-region="image" className="aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-[calc(100vh-4rem)] lg:w-[1000px]" />',
    ],
    "hero-05": [
      '<div className="aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-screen lg:w-[1000px] lg:rounded-none" />',
      '<div data-provider-image-region="image" className="aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-screen lg:w-[1000px] lg:rounded-none" />',
    ],
  }
  const replacement = replacements[name]
  if (!replacement) return contents
  if (!contents.includes(replacement[0])) throw new Error(`Expected structured media region was not found in ${name}/${filename}.`)
  return contents.replace(replacement[0], replacement[1])
}

function referenceRootClassName(contents) {
  return contents.match(/return\s*\(\s*<(?:section|main|div)[^>]*className=["']([^"']+)["']/s)?.[1]
}

const decodedText = (value) => value
  .replaceAll("&apos;", "'").replaceAll("&#39;", "'").replaceAll("&quot;", '"')
  .replaceAll("&amp;", "&").replaceAll("&nbsp;", "\u00a0").replace(/\s+/g, " ").trim()

function compileBlockBindings(contents, blockType, declaredBindings, label = blockType) {
  const source = ts.createSourceFile("literal.tsx", contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const remaining = (declaredBindings ?? []).map((binding, index) => ({ ...binding, index }))
  const edits = []
  const bindings = []
  let needsRuntime = false
  const staticItemsBinding = remaining.find((binding) => binding.kind === "static-items")
  const staticStatsBinding = remaining.find((binding) => binding.kind === "static-stat-items")
  const staticContactBinding = remaining.find((binding) => binding.kind === "static-contact-items")
  let staticItemsCount = 0
  let staticStatIndex = -1
  let staticStatTextIndex = 0
  let staticContactIndex = -1

  const insideMap = (node) => {
    let current = node.parent
    while (current) {
      if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "map") return true
      current = current.parent
    }
    return false
  }
  const insideElement = (node, tagName) => {
    let current = node.parent
    while (current) {
      if (ts.isJsxElement(current) && current.openingElement.tagName.getText(source) === tagName) return true
      current = current.parent
    }
    return false
  }
  const elementText = (node) => {
    const parts = []
    let dynamic = false
    const collect = (child) => {
      if (ts.isJsxText(child)) parts.push(child.getText(source))
      else if (ts.isStringLiteral(child)) parts.push(child.text)
      else if (ts.isJsxExpression(child)) {
        if (child.expression && ts.isStringLiteral(child.expression)) parts.push(child.expression.text)
        else dynamic = true
      } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) child.children.forEach(collect)
      else if (!ts.isJsxSelfClosingElement(child)) dynamic = true
    }
    node.children.forEach(collect)
    return dynamic ? null : decodedText(parts.join(" "))
  }
  const visit = (node) => {
    if (staticItemsBinding && ts.isJsxSelfClosingElement(node) && /^Logo\d+$/.test(node.tagName.getText(source))) {
      const fallback = node.getText(source)
      const itemIndex = Number(node.tagName.getText(source).match(/\d+$/)?.[0] ?? 1) - 1
      edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderLogo field=${JSON.stringify(staticItemsBinding.field)} index={${itemIndex}} fallback={${fallback}} />` })
      staticItemsCount = Math.max(staticItemsCount, itemIndex + 1)
      needsRuntime = true
      return
    }
    if (blockType === "hero" && ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Link" && insideElement(node, "Badge") && !insideMap(node)) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const decorations = node.children.filter((child) => ts.isJsxSelfClosingElement(child)).map((child) => child.getText(source)).join("")
        const href = node.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "href")
        edits.push({ start: node.openingElement.tagName.getStart(source), end: node.openingElement.tagName.end, text: "span" })
        edits.push({ start: node.closingElement.tagName.getStart(source), end: node.closingElement.tagName.end, text: "span" })
        if (href) edits.push({ start: href.getFullStart(), end: href.end, text: "" })
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={${JSON.stringify(fallback)}} inline />${decorations}` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "div" && !insideMap(node)) {
      const regionAttribute = node.attributes.properties.find((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "data-provider-image-region"
      )
      const regionField = regionAttribute && ts.isStringLiteral(regionAttribute.initializer)
        ? regionAttribute.initializer.text
        : null
      const declared = regionField
        ? remaining.find((binding) => binding.kind === "image" && binding.field === regionField)
        : null
      if (declared?.field && regionAttribute) {
        const literal = node.getText(source).replace(/\s*data-provider-image-region="[^"]+"/, "")
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderImage field=${JSON.stringify(declared.field)} fallback={${literal}} />` })
        bindings.push({ field: declared.field, kind: "image" })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "Image" && !insideMap(node)) {
      const declared = remaining.find((binding) => binding.kind === "image")
      if (declared?.field) {
        const literal = node.getText(source)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderImage field=${JSON.stringify(declared.field)} fallback={${literal}} />` })
        bindings.push({ field: declared.field, kind: "image" })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (blockType === "featureList" && ts.isJsxElement(node) && !insideMap(node) && node.children.some((child) => ts.isJsxSelfClosingElement(child))) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node) && node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      if (fallback && declared?.field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(declared.field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field: declared.field, kind: "field", fallback })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node) && node.openingElement.tagName.getText(source) === "Button") {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "action" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const meaningfulChildren = node.children.filter((child) => !ts.isJsxText(child) || child.getText(source).trim())
        const decoration = meaningfulChildren[0] && ts.isJsxSelfClosingElement(meaningfulChildren[0]) ? "before" : "after"
        const decorations = node.children.filter((child) => ts.isJsxSelfClosingElement(child)).map((child) => child.getText(source)).join("")
        const labelNodes = node.children.filter((child) => !ts.isJsxSelfClosingElement(child))
        const hasLabelMarkup = labelNodes.some((child) => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) !== "Link")
        const labelChildren = labelNodes.map((child) => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === "Link"
          ? contents.slice(child.openingElement.end, child.closingElement.pos)
          : child.getText(source)).join("")
        const fallbackExpression = hasLabelMarkup ? `<>${labelChildren}</>` : JSON.stringify(fallback)
        if (!node.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "asChild")) {
          edits.push({ start: node.openingElement.end - 1, end: node.openingElement.end - 1, text: " asChild" })
        }
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderAction field=${JSON.stringify(field)} fallback={${fallbackExpression}} decoration=${JSON.stringify(decoration)}>${decorations}</ProviderAction>` })
        bindings.push({ field, kind: "action", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Button") {
      const literal = node.getText(source)
      if (!insideMap(node) || /href=["'](?:#|about:blank)/.test(literal)) {
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderDemoOnly fallback={<>${literal}</>} />` })
        needsRuntime = true
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source).toLowerCase()
      const kind = /^h[1-6]$/.test(tag) ? "heading" : tag === "p" ? "paragraph" : /^(b|strong|small)$/.test(tag) ? "eyebrow" : null
      const fallback = kind ? elementText(node) : null
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (kind === "eyebrow" && fallback?.toLowerCase() === "contact us" && !declared) {
        const literal = node.getText(source)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderDemoOnly fallback={<>${literal}</>} />` })
        needsRuntime = true
        return
      }
      if (fallback && field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (staticStatsBinding && ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source).toLowerCase()
      const fallback = elementText(node)
      const leafText = node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))
      const startsItem = leafText && fallback && tag !== "p" && /\d/.test(fallback)
      const continuesItem = leafText && fallback && tag === "p" && staticStatIndex >= 0
      if (startsItem || continuesItem) {
        if (startsItem) {
          staticStatIndex += 1
          staticStatTextIndex = 0
        }
        const subField = startsItem ? "value" : staticStatTextIndex++ === 0 ? "label" : "description"
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticStatsBinding.field)} index={${staticStatIndex}} subField=${JSON.stringify(subField)} fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
    }
    if (staticContactBinding && ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source)
      const fallback = elementText(node)
      const leafText = node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))
      if (leafText && fallback && tag === "h3") {
        staticContactIndex += 1
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} subField="title" fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
      if (leafText && fallback && tag === "p" && staticContactIndex >= 0) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} subField="description" fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
      if (fallback && tag === "Link" && staticContactIndex >= 0) {
        const attributes = node.openingElement.attributes.properties
          .filter((attribute) => !(ts.isJsxAttribute(attribute) && attribute.name.text === "href"))
          .map((attribute) => attribute.getText(source)).join(" ")
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderContactLink field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} fallback={<>${literalChildren}</>} ${attributes} />` })
        needsRuntime = true
        return
      }
    }
    if (staticContactBinding && ts.isJsxSelfClosingElement(node) && !insideMap(node)) {
      const tag = node.tagName.getText(source)
      if (tag.endsWith("Icon")) {
        edits.push({
          start: node.getStart(source),
          end: node.end,
          text: `<ProviderContactIcon field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex + 1}} fallback={<${tag} />} />`,
        })
        needsRuntime = true
        return
      }
    }
    if (ts.isCallExpression(node)) {
      const call = node
      if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "map" && call.arguments.length === 1) {
        const receiver = call.expression.expression
        const name = ts.isIdentifier(receiver)
          ? receiver.text
          : ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) && ts.isIdentifier(receiver.expression.expression)
            ? receiver.expression.expression.text
            : null
        if (!name) return ts.forEachChild(node, visit)
        const declared = remaining.find((binding) => binding.kind === "items" && binding.source === name)
        const field = declared?.field
        if (field) {
          let callback = call.arguments[0].getText(source)
          if (blockType === "team") {
            let linkIndex = 0
            const wrap = (literal) => `<ProviderItemLink value={member.links?.[${linkIndex++}]} fallback={<>${literal}</>} />`
            const buttons = []
            callback = callback.replace(/<Button\b[^>]*>[\s\S]*?<Link\s+href=["']#["'][^>]*>[\s\S]*?<\/Link>\s*<\/Button>/g, (literal) => {
              const marker = `__SIAB_TEAM_LINK_${buttons.length}__`
              buttons.push(wrap(literal))
              return marker
            })
            callback = callback.replace(/<Link\s+href=["']#["'][^>]*>[\s\S]*?<\/Link>/g, wrap)
            buttons.forEach((button, index) => { callback = callback.replace(`__SIAB_TEAM_LINK_${index}__`, button) })
          }
          const receiverText = receiver.getText(source)
          const templates = receiverText.replaceAll(/\s/g, "") === `${name}.reverse()` ? `[...${name}].reverse()` : receiverText
          edits.push({ start: call.getStart(source), end: call.end, text: `<ProviderItems field=${JSON.stringify(field)} templates={${templates}}>{(providerItems) => providerItems.map(${callback})}</ProviderItems>` })
          bindings.push({ field, kind: "items", source: name })
          needsRuntime = true
          if (declared) remaining.splice(remaining.indexOf(declared), 1)
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (staticItemsBinding && staticItemsCount > 0) {
    bindings.push({ field: staticItemsBinding.field, kind: "static-items", maxItems: staticItemsCount })
    remaining.splice(remaining.indexOf(staticItemsBinding), 1)
  }
  if (staticStatsBinding && staticStatIndex >= 0) {
    bindings.push({ field: staticStatsBinding.field, kind: "static-stat-items", maxItems: staticStatIndex + 1 })
    remaining.splice(remaining.indexOf(staticStatsBinding), 1)
  }
  if (staticContactBinding && staticContactIndex >= 0) {
    bindings.push({ field: staticContactBinding.field, kind: "static-contact-items", maxItems: staticContactIndex + 1 })
    remaining.splice(remaining.indexOf(staticContactBinding), 1)
  }
  if (remaining.length) throw new Error(`Declared provider bindings were not found in ${label}: ${remaining.map((binding) => `${binding.kind}:${binding.field}:${binding.fallback ?? binding.source}`).join(", ")}`)
  if (!needsRuntime) return { contents, bindings }
  const prologue = contents.match(/^\/\/ @ts-nocheck[^\n]*\n(?:\s*["']use client["'];?\s*\n)?/)
  const insertAt = prologue?.[0].length ?? contents.indexOf("\n") + 1
  const runtimeImports = ["ProviderAction", "ProviderContactLink", "ProviderDemoOnly", "ProviderField", "ProviderImage", "ProviderItemField", "ProviderItemLink", "ProviderItems", "ProviderLogo"]
  if (staticContactBinding) runtimeImports.splice(1, 0, "ProviderContactIcon")
  edits.push({ start: insertAt, end: insertAt, text: `import { ${runtimeImports.join(", ")} } from "../../runtime/content";\n` })
  const adapted = edits.sort((a, b) => b.start - a.start).reduce((value, edit) => value.slice(0, edit.start) + edit.text + value.slice(edit.end), contents)
  return { contents: adapted, bindings }
}

const semanticKind = {
  banner: { role: "chrome", area: "banner" },
  blog: { role: "block", blockType: "blogCards" },
  "carousel-block": { role: "block", blockType: "gallery" },
  contact: { role: "block", blockType: "contactSection" },
  cta: { role: "block", blockType: "cta" },
  faq: { role: "block", blockType: "faq" },
  features: { role: "block", blockType: "featureList" },
  footer: { role: "chrome", area: "footer" },
  hero: { role: "block", blockType: "hero" },
  integrations: { role: "block", blockType: "logoCloud" },
  "logo-cloud": { role: "block", blockType: "logoCloud" },
  navbar: { role: "chrome", area: "header" },
  pricing: { role: "block", blockType: "pricing" },
  stats: { role: "block", blockType: "stats" },
  team: { role: "block", blockType: "team" },
  testimonials: { role: "block", blockType: "testimonials" },
  timeline: { role: "block", blockType: "contentSection" },
  "not-found": { role: "systemTemplate", kind: "notFound" },
}

const fieldSets = {
  hero: {
    eyebrow: ["richtext", "optional"], headline: ["richtext", "required"], subheadline: ["richtext", "optional"],
    pills: ["repeater", "optional", true], links: ["repeater", "optional", true], cta: ["cta", "optional"],
    secondary: ["cta", "optional"], image: ["image", "optional"], stats: ["repeater", "optional", true],
    trustLabel: ["text", "optional"], logos: ["repeater", "optional", true],
  },
  featureList: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    image: ["image", "optional"], features: ["repeater", "required", true],
  },
  testimonials: { title: ["text", "optional"], intro: ["text", "optional"], logo: ["image", "optional"], items: ["repeater", "required", true] },
  faq: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  cta: {
    eyebrow: ["richtext", "optional"], headline: ["richtext", "required"], description: ["richtext", "optional"],
    primary: ["cta", "optional"], secondary: ["cta", "optional"], backgroundImage: ["image", "optional"],
  },
  contactSection: {
    title: ["richtext", "optional"], description: ["richtext", "optional"], formName: ["text", "required"],
    submitLabel: ["text", "optional"], fields: ["repeater", "required", true], provider: ["runtime", "optional"],
  },
  pricing: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    plans: ["repeater", "required", true],
  },
  stats: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  logoCloud: { title: ["richtext", "optional"], intro: ["richtext", "optional"], logos: ["repeater", "required", true], cta: ["cta", "optional"] },
  gallery: { title: ["richtext", "optional"], intro: ["richtext", "optional"], images: ["repeater", "required", true], cta: ["cta", "optional"] },
  team: { title: ["richtext", "optional"], intro: ["richtext", "optional"], members: ["repeater", "required", true] },
  blogCards: { title: ["richtext", "optional"], intro: ["richtext", "optional"], posts: ["repeater", "required", true], cta: ["cta", "optional"], secondary: ["cta", "optional"] },
  contentSection: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    body: ["richtext", "required"], features: ["repeater", "optional", true], bridge: ["richtext", "optional"],
    secondaryTitle: ["richtext", "optional"], secondaryBody: ["richtext", "optional"], image: ["image", "optional"], cta: ["cta", "optional"],
  },
  timeline: { title: ["richtext", "optional"], intro: ["richtext", "optional"], items: ["repeater", "required", true] },
  contactDetails: { title: ["richtext", "optional"], description: ["richtext", "optional"], items: ["repeater", "required", true] },
}
const allStructuredFields = [...new Set(Object.values(fieldSets).flatMap((fields) => Object.keys(fields)))]

const chromeCapabilities = {
  "navbar-01": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-02": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: true, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-03": { navigation: "mixed", primaryItems: { min: 0, max: 4 }, groupItems: { min: 0, max: 3 }, childItems: { min: 1, max: 6 }, cta: true, secondaryAction: false, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 90 },
  "navbar-04": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-05": { navigation: "none", primaryItems: { min: 0, max: 0 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: true, search: true, themeToggle: false, mobileMenu: [], labelMaxLength: 32, descriptionMaxLength: 0 },
  "footer-01": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-02": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-03": { columns: { min: 0, max: 5 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: true, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-04": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: true, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-05": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-06": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
  "footer-07": { columns: { min: 0, max: 6 }, linksPerColumn: { min: 0, max: 8 }, flatLinks: { min: 0, max: 8 }, newsletter: false, social: true, labelMaxLength: 40, textMaxLength: 240 },
}

function chromeSlots(area, upstreamName) {
  if (area === "header") {
    const capability = chromeCapabilities[upstreamName]
    return {
      logo: { kind: "image", status: "optional", repeated: false },
      links: { kind: "repeater", status: capability.navigation === "none" ? "inactive" : "optional", repeated: true, reason: capability.navigation === "none" ? "The pinned search navbar has no primary-navigation region." : undefined },
      groups: { kind: "repeater", status: capability.navigation === "mixed" ? "optional" : "inactive", repeated: true, reason: capability.navigation === "mixed" ? undefined : "The pinned navbar has no flyout-navigation region." },
      cta: { kind: "cta", status: capability.cta ? "optional" : "inactive", repeated: false },
      secondaryAction: { kind: "cta", status: capability.secondaryAction ? "optional" : "inactive", repeated: false, reason: capability.secondaryAction ? undefined : "The pinned navbar exposes one primary action only." },
      search: { kind: "runtime", status: capability.search ? "optional" : "inactive", repeated: false, reason: capability.search ? undefined : "The pinned navbar has no search control." },
      themeToggle: { kind: "runtime", status: capability.themeToggle ? "optional" : "inactive", repeated: false, reason: capability.themeToggle ? undefined : "The pinned navbar has no theme-toggle control." },
      behavior: { kind: "runtime", status: "optional", repeated: false },
      activeMode: { kind: "runtime", status: capability.navigation === "none" ? "inactive" : "optional", repeated: false, reason: capability.navigation === "none" ? "No primary links can be active in this variant." : undefined },
      mobileMenu: { kind: "runtime", status: capability.mobileMenu.length ? "optional" : "inactive", repeated: false, reason: capability.mobileMenu.length ? undefined : "The pinned search navbar has no mobile navigation menu." },
    }
  }
  if (area === "footer") {
    const capability = chromeCapabilities[upstreamName]
    return {
      logo: { kind: "image", status: "optional", repeated: false },
      tagline: { kind: "text", status: "optional", repeated: false },
      columns: { kind: "repeater", status: "optional", repeated: true },
      legalLinks: { kind: "repeater", status: "optional", repeated: true },
      copyright: { kind: "text", status: "optional", repeated: false },
      newsletter: { kind: "runtime", status: capability.newsletter ? "optional" : "inactive", repeated: false, reason: capability.newsletter ? undefined : "The pinned footer has no newsletter form region." },
      social: { kind: "repeater", status: capability.social ? "optional" : "inactive", repeated: true },
    }
  }
  return { title: { kind: "text", status: "optional", repeated: false }, message: { kind: "text", status: "required", repeated: false }, link: { kind: "cta", status: "optional", repeated: false }, dismissible: { kind: "runtime", status: "optional", repeated: false } }
}

function scopeNotFound03SvgIds(contents) {
  let adapted = contents
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-first" />')
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-second" />')
    .replace(
      "export const Number4 = (props: SVGProps<SVGSVGElement>) => (",
      'export const Number4 = ({ idPrefix = "provider-404", ...props }: SVGProps<SVGSVGElement> & { idPrefix?: string }) => (',
    )
    .replaceAll('clipPath="url(#cs_clip_1_number-4)"', 'clipPath={`url(#${idPrefix}-clip)`}')
    .replaceAll('id="cs_mask_1_number-4"', 'id={`${idPrefix}-mask`}')
    .replaceAll('mask="url(#cs_mask_1_number-4)"', 'mask={`url(#${idPrefix}-mask)`}')
    .replaceAll('filter="url(#filter0_f_880_3334)"', 'filter={`url(#${idPrefix}-blur)`}')
    .replaceAll('filter="url(#cs_noise_1_number-4)"', 'filter={`url(#${idPrefix}-noise)`}')
    .replaceAll('id="filter0_f_880_3334"', 'id={`${idPrefix}-blur`}')
    .replaceAll('id="cs_clip_1_number-4"', 'id={`${idPrefix}-clip`}')
    .replaceAll('id="cs_noise_1_number-4"', 'id={`${idPrefix}-noise`}')
  return adapted
}

function slotsFor(kind, upstreamName, activeFields = []) {
  if (kind.role === "chrome") {
    return chromeSlots(kind.area, upstreamName)
  }
  if (kind.role === "systemTemplate") return {
    title: { kind: "text", status: "required", repeated: false },
    description: { kind: "text", status: "optional", repeated: false },
    actions: { kind: "repeater", status: "optional", repeated: true },
  }
  const fields = fieldSets[kind.blockType]
  const active = new Set(activeFields)
  return Object.fromEntries(allStructuredFields.map((field) => {
    const definition = fields[field]
    if (!definition) return [field, { kind: "inactive", status: "inactive", repeated: false, reason: `The ${kind.blockType} semantic contract does not expose this field.` }]
    if (!active.has(field)) return [field, { kind: definition[0], status: "inactive", repeated: definition[2] ?? false, reason: `The pinned ${upstreamName} view has no region for this field.` }]
    const [slotKind, status, repeated = false] = definition
    return [field, { kind: slotKind, status, repeated, ...(repeated && status === "required" ? { minItems: 1 } : {}) }]
  }))
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" })
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`)
}

async function checkoutSource() {
  const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))
  if (sourceArg) {
    const source = resolve(sourceArg.slice("--source=".length))
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).stdout?.trim()
    if (head !== COMMIT) throw new Error(`Upstream checkout must be pinned to ${COMMIT}; received ${head || "unknown"}.`)
    return { source, cleanup: async () => {} }
  }
  const temp = await mkdtemp(join(tmpdir(), "siab-shadcnui-blocks-"))
  run("git", ["clone", "--filter=blob:none", "--no-checkout", REPOSITORY, temp], root)
  run("git", ["checkout", "--detach", COMMIT], temp)
  return { source: temp, cleanup: () => rm(temp, { recursive: true, force: true }) }
}

async function main() {
  const bindingManifest = JSON.parse(await readFile(bindingManifestPath, "utf8"))
  const tokenExceptionManifestBuffer = await readFile(tokenExceptionManifestPath)
  const tokenExceptionManifest = JSON.parse(tokenExceptionManifestBuffer.toString("utf8"))
  if (bindingManifest && (bindingManifest.provider !== PROVIDER || bindingManifest.commit !== COMMIT)) {
    throw new Error(`Binding manifest must target ${PROVIDER} at ${COMMIT}.`)
  }
  if (tokenExceptionManifest.provider !== PROVIDER) throw new Error(`Token exception manifest must target ${PROVIDER}.`)
  const { source, cleanup } = await checkoutSource()
  try {
    const registryBuffer = await readFile(join(source, REGISTRY_FILE))
    const registry = JSON.parse(registryBuffer.toString("utf8"))
    const approved = registry.items.filter((item) => isPublic(item.name) || isSystem(item.name))
    const publicItems = approved.filter((item) => isPublic(item.name))
    const systemItems = approved.filter((item) => isSystem(item.name))
    if (publicItems.length !== 148 || systemItems.length !== 8) {
      throw new Error(`Pinned inventory mismatch: expected 148 public + 8 system; found ${publicItems.length} + ${systemItems.length}.`)
    }

    await rm(variantsRoot, { recursive: true, force: true })
    await rm(join(providerRoot, "upstream"), { recursive: true, force: true })
    await rm(join(providerRoot, "references"), { recursive: true, force: true })
    await rm(uiProviderRoot, { recursive: true, force: true })
    await mkdir(variantsRoot, { recursive: true })
    await mkdir(uiProviderRoot, { recursive: true })
    await mkdir(generatedRoot, { recursive: true })
    await cp(join(source, "LICENSE"), join(providerRoot, "LICENSE"))
    await writeFile(join(providerRoot, REGISTRY_FILE), registryBuffer)

    const primitiveFiles = []
    for (const primitive of compatibilityPrimitives) {
      const upstreamPath = join(source, `src/registry/bases/radix/ui/${primitive}.tsx`)
      let contents = (await readFile(upstreamPath, "utf8"))
        .replaceAll('"@/lib/utils"', '"../../../lib/utils"')
        .replaceAll(/"@\/registry\/bases\/radix\/ui\/([^"/]+)"/g, '"./$1"')
        .replace("x={x * width + 1}", "x={(x ?? 0) * width + 1}")
        .replace("y={y * height + 1}", "y={(y ?? 0) * height + 1}")
      if (primitive === "accordion") contents = contents.replace(
        "export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };",
        "export { AccordionPrimitive, Accordion, AccordionItem, AccordionTrigger, AccordionContent };",
      )
      if (primitive === "avatar") contents = contents.replace(
        "      {...props}\n    />\n  )\n}\n\nfunction AvatarFallback",
        "      {...props}\n      src={typeof props.src === \"string\" && props.src.startsWith(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'\") ? undefined : props.src}\n    />\n  )\n}\n\nfunction AvatarFallback",
      )
      if (primitive === "checkbox") contents = contents.replace(
        "rounded-[4px]",
        "rounded-[min(var(--siab-radius-sm),4px)]",
      )
      if (primitive === "dot-pattern") contents = contents.replace(
        "fill-neutral-400/80",
        "fill-muted-foreground/80",
      )
      if (primitive === "animated-grid-pattern") contents = contents
        .replace("fill-gray-400/30", "fill-muted-foreground/30")
        .replace("stroke-gray-400/30", "stroke-muted-foreground/30")
      if (primitive === "sheet") contents = contents.replace("bg-black/10", "bg-foreground/10")
      const destination = join(uiProviderRoot, `${primitive}.tsx`)
      await writeFile(destination, contents)
      primitiveFiles.push({ name: primitive, path: relative(root, destination), sha256: sha256(contents) })
    }
    const sharedButtonSource = join(source, "src/registry/ui/button.tsx")
    const sharedButton = (await readFile(sharedButtonSource, "utf8"))
      .replaceAll('"@/lib/utils"', '"../../../lib/utils"')
      .replaceAll("buttonVariants", "sharedButtonVariants")
      .replace("function Button(", "function SharedButton(")
      .replace("export { Button, sharedButtonVariants };", "export { SharedButton };")
    const sharedButtonDestination = join(uiProviderRoot, "shared-button.tsx")
    await writeFile(sharedButtonDestination, sharedButton)
    primitiveFiles.push({ name: "shared-button", path: relative(root, sharedButtonDestination), sha256: sha256(sharedButton) })
    const providerTailwind = `/* Radix Nova state aliases required by the pinned provider primitives. */
@custom-variant data-open { &:where([data-state="open"]), &:where([data-open]:not([data-open="false"])) { @slot; } }
@custom-variant data-closed { &:where([data-state="closed"]), &:where([data-closed]:not([data-closed="false"])) { @slot; } }
@custom-variant data-checked { &:where([data-state="checked"]), &:where([data-checked]:not([data-checked="false"])) { @slot; } }
@custom-variant data-disabled { &:where([data-disabled="true"]), &:where([data-disabled]:not([data-disabled="false"])) { @slot; } }
@custom-variant data-active { &:where([data-state="active"]), &:where([data-active]:not([data-active="false"])) { @slot; } }
@custom-variant data-horizontal { &:where([data-orientation="horizontal"]) { @slot; } }
@custom-variant data-vertical { &:where([data-orientation="vertical"]) { @slot; } }
`
    const providerTailwindDestination = join(uiProviderRoot, "tailwind.css")
    await writeFile(providerTailwindDestination, providerTailwind)
    primitiveFiles.push({ name: "tailwind-state-variants", path: relative(root, providerTailwindDestination), sha256: sha256(providerTailwind) })
    await writeFile(join(uiProviderRoot, "index.ts"), `${[...compatibilityPrimitives, "shared-button"].map((name) => `export * from "./${name}"`).join("\n")}\n`)

    const sharedLogosSource = join(source, "src/components/logos.tsx")
    const sharedLogos = adaptLiteralImports(await readFile(sharedLogosSource, "utf8"))
    await writeFile(join(providerRoot, "runtime/logos.tsx"), sharedLogos)
    const providerRuntimeFiles = [{
      path: relative(root, join(providerRoot, "runtime/logos.tsx")),
      sha256: sha256(sharedLogos),
    }]

    const variants = []
    for (const item of approved) {
      const category = /^carousel-block-/.test(item.name) ? "carousel-block" : categoryFor(item.name)
      const semantic = category === "contact" && item.name !== "contact-02"
        ? { role: "block", blockType: "contactDetails" }
        : category === "timeline"
          ? { role: "block", blockType: "timeline" }
          : semanticKind[category]
      const mainStem = category === "carousel-block" ? "carousel" : category
      const literalEntryPath = (item.files ?? []).find((file) => file.path.endsWith(`/${mainStem}.tsx`))?.path
      if (!literalEntryPath) throw new Error(`No literal entry component found for ${item.name}.`)
      const sourceFiles = []
      const sourceTexts = []
      const explicitBindings = []
      let rootClassName
      for (const file of item.files ?? []) {
        const contents = await readFile(join(source, file.path))
        sourceTexts.push(contents.toString("utf8"))
        sourceFiles.push({ path: file.path, sha256: sha256(contents) })

        const upstreamFilename = file.path.split("/").at(-1)
        const literalFilename = item.name === "navbar-03" && upstreamFilename === "navbar.ts" ? "navbar-data.ts" : upstreamFilename
        const literalDestination = join(variantsRoot, item.name, literalFilename)
        await mkdir(dirname(literalDestination), { recursive: true })
        const structuredMediaLiteral = adaptStructuredMediaRegions(item.name, literalFilename, contents.toString("utf8"))
        let adaptedLiteral = adaptThemeHooks(item.name, literalFilename, adaptLiteralImports(structuredMediaLiteral))
          .replaceAll(item.name === "navbar-03" ? 'from "./navbar"' : "\0", 'from "./navbar-data"')
        if ((item.name === "hero-03" || item.name === "hero-08") && file.path === literalEntryPath) {
          adaptedLiteral = adaptedLiteral.replace(/<Navbar\s*\/>/, '<ProviderDemoOnly fallback={<Navbar />} />')
        }
        if (item.name === "features-10" && literalFilename === "stats-card.tsx") {
          adaptedLiteral = adaptedLiteral
            .replace('import type { ComponentProps } from "react";', 'import type { ComponentProps } from "react";\nimport type { LinkRef } from "@siteinabox/contracts";\nimport { useProviderBlockModel } from "../../runtime/content";')
            .replace("  className,\n  ...props\n}: ComponentProps<typeof Card>) {", "  className,\n  value,\n  label,\n  action,\n  ...props\n}: ComponentProps<typeof Card> & { value?: string; label?: string; action?: LinkRef }) {\n  const model = useProviderBlockModel();")
            .replace('<CardTitle className="font-satoshi text-3xl">+2,350</CardTitle>', '<CardTitle className="font-satoshi text-3xl">{model ? value : "+2,350"}</CardTitle>')
            .replace('<CardDescription>+180.1% from last month</CardDescription>', '<CardDescription>{model ? label : "+180.1% from last month"}</CardDescription>')
            .replace(/<CardAction>\s*<Button size="sm" variant="ghost">\s*View More\s*<\/Button>\s*<\/CardAction>/, '{model ? action?.href && action.label ? <CardAction><Button size="sm" variant="ghost" asChild><a href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}>{action.label}</a></Button></CardAction> : null : <CardAction><Button size="sm" variant="ghost">View More</Button></CardAction>}')
        }
        if (item.name === "features-10" && file.path === literalEntryPath) {
          adaptedLiteral = adaptedLiteral.replace('<StatsCard className="rounded-br-lg" />', '<StatsCard className="rounded-br-lg" value={feature.metricValue} label={feature.metricLabel} action={feature.cta} />')
        }
        if (item.name === "not-found-03") adaptedLiteral = scopeNotFound03SvgIds(adaptedLiteral)
        const unusedEmbeddedNavbar = (item.name === "hero-03" || item.name === "hero-08") && /^navbar\.(?:ts|tsx)$/.test(literalFilename)
        if (semantic.role === "block" && !unusedEmbeddedNavbar) {
          const declarations = bindingManifest?.variants?.[item.name]?.[literalFilename] ?? []
          const compiled = compileBlockBindings(adaptedLiteral, semantic.blockType, declarations, `${item.name}/${literalFilename}`)
          adaptedLiteral = compiled.contents
          explicitBindings.push(...compiled.bindings.map((binding) => ({ file: literalFilename, ...binding })))
        }
        await writeFile(literalDestination, adaptedLiteral)
        rootClassName ??= referenceRootClassName(contents.toString("utf8"))
      }
      const sourceText = sourceTexts.join("\n")
      const declaredFields = semantic.role === "block"
        ? [...new Set([...explicitBindings.map((binding) => binding.field), ...(bindingManifest?.direct?.[item.name] ?? [])])]
        : []
      const variantSlots = slotsFor(semantic, item.name, declaredFields)
      for (const binding of explicitBindings) {
        if ((binding.kind === "static-items" || binding.kind === "static-stat-items" || binding.kind === "static-contact-items") && variantSlots[binding.field]) {
          variantSlots[binding.field] = { ...variantSlots[binding.field], minItems: 1, maxItems: binding.maxItems }
        }
      }
      if (item.name === "features-03" && variantSlots.features) {
        variantSlots.features = { ...variantSlots.features, minItems: 1, maxItems: 2 }
      }
      const activeSlots = Object.entries(variantSlots).filter(([, slot]) => slot.status !== "inactive").map(([name]) => name)
      const featureAudit = [
        { feature: "dom-and-classes", disposition: "literal-preserved", evidence: "Vendored pinned literal view" },
        { feature: "responsive-layout", disposition: "literal-preserved", evidence: "Upstream responsive class names" },
        ...(/(?:animate-|transition-|motion|marquee|carousel)/i.test(sourceText) ? [{ feature: "animation-and-motion", disposition: "literal-preserved", evidence: "Pinned source animation classes/runtime" }] : []),
        ...(/(?:<Image|<img|imageUrl|\.jpg|\.png|\.webp|unsplash)/i.test(sourceText) ? [{ feature: "media", disposition: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "structured-adapter" : "inactive", evidence: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "CMS media slot with preserved literal dimensions" : "Decorative/demo media is removed because this semantic contract has no media field" }] : []),
        ...(/(?:<form|type=["']email|type=["']submit)/i.test(sourceText) ? [{ feature: "form", disposition: semantic.blockType === "contactSection" || ["footer-03", "footer-04"].includes(item.name) ? "structured-adapter" : "inactive", evidence: semantic.blockType === "contactSection" ? "Validated SIAB form provider contract" : ["footer-03", "footer-04"].includes(item.name) ? "Capability-gated footer newsletter contract" : "Upstream demo capture form is inactive; no arbitrary external submission is retained" }] : []),
        ...(/(?:href=|<Link|<a\s)/i.test(sourceText) ? [{ feature: "links-and-actions", disposition: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "structured-adapter" : "runtime-derived", evidence: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "Validated link/action slots" : "Safe tenant/runtime navigation" }] : []),
        ...(/(?:\.map\(|Carousel|Accordion|Tabs)/.test(sourceText) ? [{ feature: "repeated-or-interactive-content", disposition: activeSlots.some((slot) => variantSlots[slot]?.repeated) ? "structured-adapter" : "literal-preserved", evidence: activeSlots.some((slot) => variantSlots[slot]?.repeated) ? "Typed repeated slot" : "Pinned literal interaction without demo data" }] : []),
        ...(item.name === "navbar-02" ? [{ feature: "theme-toggle", disposition: "runtime-derived", evidence: "Accessible provider control backed by the shared persisted color-mode runtime" }] : []),
      ]
      const dependencies = [...new Set([...(item.dependencies ?? []), ...(item.registryDependencies ?? [])])].sort()
      variants.push({
        id: `${NAMESPACE}.${item.name}`,
        upstreamName: item.name,
        entryFile: `${mainStem}.tsx`,
        title: item.title,
        description: item.description,
        ...semantic,
        slots: variantSlots,
        bindings: explicitBindings,
        capabilities: chromeCapabilities[item.name],
        featureAudit,
        composition: {
          embedsNavigation: item.name === "hero-03" || item.name === "hero-08",
          suppressesChromeAreas: item.name === "hero-03" || item.name === "hero-08" ? ["header"] : [],
        },
        dependencies,
        referenceRootClassName: rootClassName,
        sourceFiles,
        sourceHash: sha256(sourceFiles.map((file) => `${file.path}:${file.sha256}`).join("\n")),
      })

      if (semantic.role === "block") {
        const view = item.name === "features-03" ? [
          'import * as React from "react"',
          'import type { Block } from "@siteinabox/contracts"',
          'import type { BlockRenderOptions } from "../../../../blocks/types"',
          'import { ShadcnUiStaticFeaturesView } from "../../feature-views"',
          'type VariantBlock = Extract<Block, { blockType: "featureList" }>',
          `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <ShadcnUiStaticFeaturesView block={block} options={options} variant="${NAMESPACE}.${item.name}" /> }`,
          '',
        ].join("\n") : item.name === "contact-02" ? [
          'import * as React from "react"',
          'import type { Block } from "@siteinabox/contracts"',
          'import type { BlockRenderOptions } from "../../../../blocks/types"',
          'import { ShadcnUiContactView } from "../../contact-views"',
          `type VariantBlock = Extract<Block, { blockType: "${semantic.blockType}" }>`,
          `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <ShadcnUiContactView block={block} options={options} variant="${NAMESPACE}.${item.name}" /> }`,
          '',
        ].join("\n") : [
          'import * as React from "react"',
          'import type { Block } from "@siteinabox/contracts"',
          'import type { BlockRenderOptions } from "../../../../blocks/types"',
          `import Literal from "./${mainStem}"`,
          'import { LiteralProviderVariantView } from "../../runtime/literal-view"',
          `type VariantBlock = Extract<Block, { blockType: "${semantic.blockType}" }>`,
          `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <LiteralProviderVariantView Literal={Literal} model={{ block, options }} variant="${NAMESPACE}.${item.name}" /> }`,
          '',
        ].join("\n")
        await writeFile(join(variantsRoot, item.name, "view.tsx"), view)
      }
    }

    const blockVariants = variants.filter((variant) => variant.role === "block")
    const registryImports = blockVariants.map((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return `import View${suffix} from "./variants/${variant.upstreamName}/view"`
    })
    const registryEntries = blockVariants.map((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return `  "${variant.id}": { blockType: "${variant.blockType}", View: View${suffix} },`
    })
    await writeFile(join(providerRoot, "block-views.generated.tsx"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      'import * as React from "react"',
      'import type { Block } from "@siteinabox/contracts"',
      'import type { BlockRenderOptions } from "../../blocks/types"',
      ...registryImports,
      "const definitions = {",
      ...registryEntries,
      "} as const",
      "export function ShadcnUiExplicitBlockView({ block, options, variant }: { block: Block; options: BlockRenderOptions; variant: string }) {",
      "  const definition = definitions[variant as keyof typeof definitions]",
      "  if (!definition || definition.blockType !== block.blockType) throw new Error(`Unresolved provider block variant \"${variant}\" for block type \"${block.blockType}\".`)",
      "  const { View } = definition",
      "  return <View block={block as never} options={options} />",
      "}",
      "",
    ].join("\n"))

    const clientLoaderEntries = blockVariants.map((variant) =>
      `  "${variant.id}": () => import("./variants/${variant.upstreamName}/view"),`)
    await writeFile(join(providerRoot, "block-client-loaders.generated.ts"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      "const loaders = {",
      ...clientLoaderEntries,
      "} as const",
      "export async function loadShadcnUiExplicitBlockView(variant: string) {",
      "  const load = loaders[variant as keyof typeof loaders]",
      "  if (!load) throw new Error(`Unresolved provider block variant \"${variant}\".`)",
      "  return (await load()).default",
      "}",
      "",
    ].join("\n"))

    const literalImports = variants.map((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return `import Literal${suffix} from "./variants/${variant.upstreamName}/${variant.entryFile.replace(/\.tsx$/, "")}"`
    })
    const literalEntries = variants.map((variant, index) => `  "${variant.id}": Literal${String(index + 1).padStart(3, "0")},`)
    await writeFile(join(providerRoot, "literal-previews.generated.tsx"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      'import * as React from "react"',
      'import { LiteralProviderPreviewView } from "./runtime/literal-view"',
      ...literalImports,
      "const literals = {",
      ...literalEntries,
      "} as const",
      "export function ShadcnUiPinnedLiteralPreview({ variant }: { variant: string }) {",
      "  const Literal = literals[variant as keyof typeof literals]",
      "  if (!Literal) throw new Error(`Unresolved pinned literal provider variant \"${variant}\".`)",
      "  return <LiteralProviderPreviewView Literal={Literal} variant={variant} />",
      "}",
      "",
    ].join("\n"))

    const approvedNames = new Set(approved.map((item) => item.name))
    for (const variant of variants) {
      variant.adaptedFiles = await fileInventory(join(variantsRoot, variant.upstreamName))
    }
    const exclusions = registry.items.filter((item) => !approvedNames.has(item.name)).map((item) => ({
      upstreamName: item.name,
      type: item.type,
      reason: /^carousel-\d+$/.test(item.name)
        ? "component_primitive_not_public_block"
        : "category_not_approved_for_generated_sites",
    }))

    const inventory = {
      schemaVersion: 1,
      provider: PROVIDER,
      namespace: NAMESPACE,
      repository: REPOSITORY,
      commit: COMMIT,
      registry: REGISTRY_FILE,
      registryHash: sha256(registryBuffer),
      license: "MIT",
      counts: { upstream: registry.items.length, public: publicItems.length, systemTemplates: systemItems.length, excluded: exclusions.length },
      compatibilityPrimitives: primitiveFiles,
      providerRuntimeFiles,
      tokenExceptions: {
        path: relative(root, tokenExceptionManifestPath),
        sha256: sha256(tokenExceptionManifestBuffer),
      },
      derivedSystemBlocks: [{
        id: `${NAMESPACE}.legal-content-01`,
        blockType: "contentSection",
        reason: "Tenant privacy pages require a structured long-form legal layout; this provider-styled system block is not counted as an upstream public variant.",
      }],
      variants,
      exclusions,
    }
    await writeFile(join(providerRoot, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`)
    await writeFile(join(providerRoot, "exclusions.json"), `${JSON.stringify({ schemaVersion: 1, provider: PROVIDER, commit: COMMIT, exclusions }, null, 2)}\n`)
    const compactVariant = (variant) => Object.fromEntries(Object.entries(variant).filter(([key]) => ![
      "sourceFiles", "adaptedFiles", "referenceFiles", "featureAudit", "dependencies",
    ].includes(key)))
    await writeFile(join(generatedRoot, "shadcnui-blocks.ts"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      `export const SHADCNUI_PROVIDER = ${JSON.stringify({ provider: PROVIDER, namespace: NAMESPACE, repository: REPOSITORY, commit: COMMIT, registry: REGISTRY_FILE, registryHash: sha256(registryBuffer), license: "MIT", counts: inventory.counts }, null, 2)} as const`,
      `export const SHADCNUI_BLOCK_VARIANTS = ${JSON.stringify(blockVariants.map(compactVariant), null, 2)} as const`,
      `export const SHADCNUI_CHROME_VARIANTS = ${JSON.stringify(variants.filter((variant) => variant.role === "chrome").map(compactVariant), null, 2)} as const`,
      `export const SHADCNUI_SYSTEM_TEMPLATES = ${JSON.stringify(variants.filter((variant) => variant.role === "systemTemplate").map(compactVariant), null, 2)} as const`,
      `export const SHADCNUI_SYSTEM_BLOCK_VARIANTS = ${JSON.stringify([{
        id: `${NAMESPACE}.legal-content-01`, upstreamName: "legal-content-01", entryFile: "system-views.tsx", title: "Legal content", description: "Provider-styled structured long-form legal content.", role: "block", blockType: "contentSection",
        slots: Object.fromEntries(allStructuredFields.map((field) => [field, field === "body" ? { kind: "richtext", status: "required", repeated: false } : { kind: fieldSets.contentSection[field]?.[0] ?? "inactive", status: "inactive", repeated: fieldSets.contentSection[field]?.[2] ?? false, reason: "The legal content system layout exposes only the body field." }])),
        bindings: [{ file: "system-views.tsx", field: "body", kind: "direct" }], composition: { embedsNavigation: false, suppressesChromeAreas: [] }, referenceRootClassName: "bg-background py-16 text-foreground sm:py-24", sourceHash: sha256("provider-styled-legal-content-v1"),
      }], null, 2)} as const`,
      "export type ShadcnUiSystemTemplateId = (typeof SHADCNUI_SYSTEM_TEMPLATES)[number][\"id\"]",
      "export type ShadcnUiBlocksVariant = (typeof SHADCNUI_BLOCK_VARIANTS)[number] | (typeof SHADCNUI_CHROME_VARIANTS)[number] | (typeof SHADCNUI_SYSTEM_TEMPLATES)[number] | (typeof SHADCNUI_SYSTEM_BLOCK_VARIANTS)[number]",
      "",
    ].join("\n"))
    console.log(`Imported ${publicItems.length} public variants, ${systemItems.length} system templates, and ${exclusions.length} exclusions from ${COMMIT}.`)
  } finally {
    await cleanup()
  }
}

await main()
