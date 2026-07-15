#!/usr/bin/env node

import { createHash } from "node:crypto"
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

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
  return `${clientDirective ? `${clientDirective[1]}\n` : ""}// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations\n${nativeImageImport}${literalBody.replaceAll("<img", "<Image")}`
    .replaceAll('import {\n  DribbbleIcon,\n  GithubIcon,\n  TwitchIcon,\n  TwitterIcon,\n} from "lucide-react";', 'import { DribbbleIcon, GithubIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons";')
    .replaceAll('import { Dribbble, Github, Twitter, Wheat } from "lucide-react";', 'import { Wheat } from "lucide-react";\nimport { Dribbble, Github, Twitter } from "../../runtime/social-icons";')
    .replaceAll(/import \{ (Dribbble(?:Icon)?), (Github|TwitchIcon), (Twitter(?:Icon)?) \} from ["']lucide-react["'];?/g, 'import { $1, $2, $3 } from "../../runtime/social-icons";')
    .replaceAll(/from ["']next\/link["']/g, 'from "../../runtime/link"')
    .replaceAll(/from ["']next\/image["']/g, 'from "../../runtime/image"')
    .replaceAll(/from ["']@\/lib\/utils["']/g, 'from "@siteinabox/ui/lib/utils"')
    .replaceAll(/import (\w+) from ["']@\/registry\/bases\/radix\/ui\/([^"']+)["']/g, 'import $1 from "./$2"')
    .replaceAll(/from ["']@\/registry\/bases\/radix\/ui\/[^"']+["']/g, 'from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"')
    .replaceAll(/from ["']@\/registry\/ui\/button["']/g, 'from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"')
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
    .replaceAll("categorizedFaqs[0].category", "categorizedFaqs[0]?.category ?? null")
    .replaceAll(/x=\{x \* width \+ 1\}/g, "x={(x ?? 0) * width + 1}")
    .replaceAll(/y=\{y \* height \+ 1\}/g, "y={(y ?? 0) * height + 1}")
    .replaceAll(/https?:\/\/[^"'`\s]+\.(?:avif|gif|jpe?g|png|webp)(?:\?[^"'`\s]*)?/gi, (url) => `data:image/gif;base64,R0lGODlhAQABAAAAACw=#${sha256(url).slice(0, 12)}`)
    .replaceAll(/https?:\/\/(?!www\.w3\.org\/2000\/svg)[^"'`\s]+/g, (url) => `about:blank#upstream-${sha256(url).slice(0, 12)}`)
}

function referenceRootClassName(contents) {
  return contents.match(/return\s*\(\s*<(?:section|main|div)[^>]*className=["']([^"']+)["']/s)?.[1]
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
  },
  featureList: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    image: ["image", "optional"], features: ["repeater", "required", true],
  },
  testimonials: { title: ["text", "optional"], logo: ["image", "optional"], items: ["repeater", "required", true] },
  faq: { title: ["richtext", "optional"], items: ["repeater", "required", true] },
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
  logoCloud: { title: ["richtext", "optional"], intro: ["richtext", "optional"], logos: ["repeater", "required", true] },
  gallery: { title: ["richtext", "optional"], intro: ["richtext", "optional"], images: ["repeater", "required", true], cta: ["cta", "optional"] },
  team: { title: ["richtext", "optional"], intro: ["richtext", "optional"], members: ["repeater", "required", true] },
  blogCards: { title: ["richtext", "optional"], intro: ["richtext", "optional"], posts: ["repeater", "required", true] },
  contentSection: {
    eyebrow: ["richtext", "optional"], title: ["richtext", "optional"], intro: ["richtext", "optional"],
    body: ["richtext", "required"], features: ["repeater", "optional", true], bridge: ["richtext", "optional"],
    secondaryTitle: ["richtext", "optional"], secondaryBody: ["richtext", "optional"], image: ["image", "optional"], cta: ["cta", "optional"],
  },
}
const allStructuredFields = [...new Set(Object.values(fieldSets).flatMap((fields) => Object.keys(fields)))]

const chromeCapabilities = {
  "navbar-01": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: false, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-02": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: false, search: false, themeToggle: true, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
  "navbar-03": { navigation: "mixed", primaryItems: { min: 0, max: 4 }, groupItems: { min: 0, max: 3 }, childItems: { min: 1, max: 6 }, cta: true, secondaryAction: false, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 90 },
  "navbar-04": { navigation: "flat", primaryItems: { min: 0, max: 6 }, groupItems: { min: 0, max: 0 }, childItems: { min: 0, max: 0 }, cta: true, secondaryAction: false, search: false, themeToggle: false, mobileMenu: ["dropdown", "drawer"], labelMaxLength: 32, descriptionMaxLength: 0 },
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

function slotsFor(kind, upstreamName) {
  if (kind.role === "chrome") {
    return chromeSlots(kind.area, upstreamName)
  }
  if (kind.role === "systemTemplate") return {
    title: { kind: "text", status: "required", repeated: false },
    description: { kind: "text", status: "optional", repeated: false },
    actions: { kind: "repeater", status: "optional", repeated: true },
  }
  const fields = fieldSets[kind.blockType]
  return Object.fromEntries(allStructuredFields.map((field) => {
    const definition = fields[field]
    if (!definition) return [field, { kind: "inactive", status: "inactive", repeated: false, reason: `The ${kind.blockType} semantic contract does not expose this field.` }]
    const [slotKind, status, repeated = false] = definition
    return [field, { kind: slotKind, status, repeated }]
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

    await rm(join(providerRoot, "upstream"), { recursive: true, force: true })
    await rm(variantsRoot, { recursive: true, force: true })
    await rm(uiProviderRoot, { recursive: true, force: true })
    await mkdir(join(providerRoot, "upstream"), { recursive: true })
    await mkdir(variantsRoot, { recursive: true })
    await mkdir(uiProviderRoot, { recursive: true })
    await mkdir(generatedRoot, { recursive: true })
    await cp(join(source, "LICENSE"), join(providerRoot, "LICENSE"))
    await writeFile(join(providerRoot, REGISTRY_FILE), registryBuffer)

    const primitiveFiles = []
    for (const primitive of compatibilityPrimitives) {
      const upstreamPath = join(source, `src/registry/bases/radix/ui/${primitive}.tsx`)
      const contents = (await readFile(upstreamPath, "utf8"))
        .replaceAll('"@/lib/utils"', '"../../../lib/utils"')
        .replaceAll(/"@\/registry\/bases\/radix\/ui\/([^"/]+)"/g, '"./$1"')
        .replace("x={x * width + 1}", "x={(x ?? 0) * width + 1}")
        .replace("y={y * height + 1}", "y={(y ?? 0) * height + 1}")
      const destination = join(uiProviderRoot, `${primitive}.tsx`)
      await writeFile(destination, contents)
      primitiveFiles.push({ name: primitive, path: relative(root, destination), sha256: sha256(contents) })
    }
    await writeFile(join(uiProviderRoot, "index.ts"), `${compatibilityPrimitives.map((name) => `export * from "./${name}"`).join("\n")}\n`)

    const sharedLogosSource = join(source, "src/registry/blocks/shared/logo-cloud-01/components/logos.tsx")
    const sharedLogos = adaptLiteralImports(await readFile(sharedLogosSource, "utf8"))
      // The upstream decorative logo SVG ids are unreferenced and Marquee repeats
      // each logo, which would otherwise create invalid duplicate document ids.
      .replaceAll(/\s+id="logo-\d+"/g, "")
    await writeFile(join(providerRoot, "runtime/logos.tsx"), sharedLogos)
    const providerRuntimeFiles = [{
      path: relative(root, join(providerRoot, "runtime/logos.tsx")),
      sha256: sha256(sharedLogos),
    }]

    const variants = []
    for (const item of approved) {
      const category = /^carousel-block-/.test(item.name) ? "carousel-block" : categoryFor(item.name)
      const mainStem = category === "carousel-block" ? "carousel" : category
      const literalEntryPath = (item.files ?? []).find((file) => file.path.endsWith(`/${mainStem}.tsx`))?.path
      if (!literalEntryPath) throw new Error(`No literal entry component found for ${item.name}.`)
      const sourceFiles = []
      const sourceTexts = []
      let rootClassName
      for (const file of item.files ?? []) {
        const contents = await readFile(join(source, file.path))
        sourceTexts.push(contents.toString("utf8"))
        const destination = join(providerRoot, "upstream", item.name, file.path.split("/").at(-1))
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, contents)
        sourceFiles.push({ path: relative(root, destination), sha256: sha256(contents) })

        const upstreamFilename = file.path.split("/").at(-1)
        const literalFilename = item.name === "navbar-03" && upstreamFilename === "navbar.ts" ? "navbar-data.ts" : upstreamFilename
        const literalDestination = join(variantsRoot, item.name, literalFilename)
        await mkdir(dirname(literalDestination), { recursive: true })
        let adaptedLiteral = adaptLiteralImports(contents.toString("utf8"))
          .replaceAll(item.name === "navbar-03" ? 'from "./navbar"' : "\0", 'from "./navbar-data"')
        if (item.name === "not-found-03") adaptedLiteral = scopeNotFound03SvgIds(adaptedLiteral)
        await writeFile(literalDestination, adaptedLiteral)
        if (file.path === literalEntryPath) {
          await writeFile(join(variantsRoot, item.name, "literal.tsx"), adaptedLiteral)
        }
        rootClassName ??= referenceRootClassName(contents.toString("utf8"))
      }
      const semantic = semanticKind[category]
      const sourceText = sourceTexts.join("\n")
      const activeSlots = Object.entries(slotsFor(semantic, item.name)).filter(([, slot]) => slot.status !== "inactive").map(([name]) => name)
      const featureAudit = [
        { feature: "dom-and-classes", disposition: "literal-preserved", evidence: "Vendored pinned literal view" },
        { feature: "responsive-layout", disposition: "literal-preserved", evidence: "Upstream responsive class names" },
        ...(/(?:animate-|transition-|motion|marquee|carousel)/i.test(sourceText) ? [{ feature: "animation-and-motion", disposition: "literal-preserved", evidence: "Pinned source animation classes/runtime" }] : []),
        ...(/(?:<Image|<img|imageUrl|\.jpg|\.png|\.webp|unsplash)/i.test(sourceText) ? [{ feature: "media", disposition: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "structured-adapter" : "inactive", evidence: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "CMS media slot with preserved literal dimensions" : "Decorative/demo media is removed because this semantic contract has no media field" }] : []),
        ...(/(?:<form|type=["']email|type=["']submit)/i.test(sourceText) ? [{ feature: "form", disposition: semantic.blockType === "contactSection" || ["footer-03", "footer-04"].includes(item.name) ? "structured-adapter" : "inactive", evidence: semantic.blockType === "contactSection" ? "Validated SIAB form provider contract" : ["footer-03", "footer-04"].includes(item.name) ? "Capability-gated footer newsletter contract" : "Upstream demo capture form is inactive; no arbitrary external submission is retained" }] : []),
        ...(/(?:href=|<Link|<a\s)/i.test(sourceText) ? [{ feature: "links-and-actions", disposition: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "structured-adapter" : "runtime-derived", evidence: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "Validated link/action slots" : "Safe tenant/runtime navigation" }] : []),
        ...(/(?:\.map\(|Carousel|Accordion|Tabs)/.test(sourceText) ? [{ feature: "repeated-or-interactive-content", disposition: activeSlots.some((slot) => slotsFor(semantic, item.name)[slot]?.repeated) ? "structured-adapter" : "literal-preserved", evidence: activeSlots.some((slot) => slotsFor(semantic, item.name)[slot]?.repeated) ? "Typed repeated slot" : "Pinned literal interaction without demo data" }] : []),
        ...(item.name === "navbar-02" ? [{ feature: "theme-toggle", disposition: "runtime-derived", evidence: "Accessible provider control backed by the shared persisted color-mode runtime" }] : []),
      ]
      const dependencies = [...new Set([...(item.dependencies ?? []), ...(item.registryDependencies ?? [])])].sort()
      variants.push({
        id: `${NAMESPACE}.${item.name}`,
        upstreamName: item.name,
        title: item.title,
        description: item.description,
        ...semantic,
        slots: slotsFor(semantic, item.name),
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

      const adapterDestination = join(variantsRoot, item.name, "adapter.ts")
      if (semantic.role === "block") {
        const adapter = [
          'import type { Block } from "@siteinabox/contracts"',
          'import type { BlockRenderOptions } from "../../../../blocks/types"',
          '',
          `export const variantId = "${NAMESPACE}.${item.name}" as const`,
          `export type VariantAdapterInput = { block: Extract<Block, { blockType: "${semantic.blockType}" }>; options: BlockRenderOptions }`,
          'export function adaptVariant(input: VariantAdapterInput) {',
          '  return { block: input.block, options: input.options }',
          '}',
          '',
        ].join("\n")
        await writeFile(adapterDestination, adapter)
        const view = [
          'import * as React from "react"',
          'import Literal from "./literal"',
          'import { LiteralProviderVariantView, type ProviderBlockViewModel } from "../../runtime/literal-view"',
          `export default function View({ model }: { model: ProviderBlockViewModel }) { return <LiteralProviderVariantView Literal={Literal} model={model} variant="${NAMESPACE}.${item.name}" /> }`,
          '',
        ].join("\n")
        await writeFile(join(variantsRoot, item.name, "view.tsx"), view)
      } else if (semantic.role === "chrome") {
        const runtimeName = semantic.area === "banner" ? "Banner" : semantic.area === "footer" ? "Footer" : "Navbar"
        const runtimeFile = semantic.area === "banner" ? "banner" : semantic.area === "footer" ? "footer" : "navbar"
        const adapterArguments = semantic.area === "banner"
          ? "settings: SiteSettings"
          : semantic.area === "footer"
            ? "settings: SiteSettings, mediaResolver?: MediaResolver"
            : "settings: SiteSettings, currentSlug?: string, mediaResolver?: MediaResolver"
        const adapterCall = semantic.area === "banner"
          ? "settings"
          : semantic.area === "footer"
            ? "settings, mediaResolver"
            : "settings, currentSlug, mediaResolver"
        const adapter = [
          'import type { SiteSettings } from "@siteinabox/contracts"',
          ...(semantic.area === "banner" ? [] : ['import type { MediaResolver } from "../../../../media"']),
          `import { adapt${runtimeName} } from "../../runtime/${runtimeFile}"`,
          '',
          `export const variantId = "${NAMESPACE}.${item.name}" as const`,
          `export function adaptVariant(${adapterArguments}) {`,
          `  return adapt${runtimeName}(${adapterCall})`,
          '}',
          '',
        ].join("\n")
        await writeFile(adapterDestination, adapter)
        const view = [
          'import * as React from "react"',
          'import Literal from "./literal"',
          `import { LiteralProvider${runtimeName}View } from "../../runtime/chrome-literal-view"`,
          `import type { ${runtimeName}ViewModel } from "../../runtime/${runtimeFile}"`,
          `export default function View({ model }: { model: ${runtimeName}ViewModel }) { return <LiteralProvider${runtimeName}View Literal={Literal} model={model} variant="${NAMESPACE}.${item.name}" /> }`,
          '',
        ].join("\n")
        await writeFile(join(variantsRoot, item.name, "view.tsx"), view)
      } else {
        const adapterScaffold = [
          'import type { Block } from "@siteinabox/contracts"',
          'import type { BlockRenderOptions } from "../../../../blocks/types"',
          '',
          `export const variantId = "${NAMESPACE}.${item.name}" as const`,
          'export type VariantAdapterInput = { block: never; options: BlockRenderOptions }',
          'export function adaptVariant(input: VariantAdapterInput) {',
          '  return { block: input.block as Block, options: input.options }',
          '}',
          '',
        ].join("\n")
        try {
          await access(adapterDestination)
        } catch {
          await writeFile(adapterDestination, adapterScaffold)
        }
      }
    }

    const blockVariants = variants.filter((variant) => variant.role === "block")
    const registryImports = blockVariants.flatMap((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return [
        `import View${suffix} from "./variants/${variant.upstreamName}/view"`,
        `import { adaptVariant as adapt${suffix} } from "./variants/${variant.upstreamName}/adapter"`,
      ]
    })
    const registryEntries = blockVariants.map((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return `  "${variant.id}": { blockType: "${variant.blockType}", adapt: adapt${suffix}, View: View${suffix} },`
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
      "  const model = (definition.adapt as (input: { block: Block; options: BlockRenderOptions }) => { block: Block; options: BlockRenderOptions })({ block, options })",
      "  const { View } = definition",
      "  return <View model={model} />",
      "}",
      "",
    ].join("\n"))

    const literalImports = variants.map((variant, index) => {
      const suffix = String(index + 1).padStart(3, "0")
      return `import Literal${suffix} from "./variants/${variant.upstreamName}/literal"`
    })
    const literalEntries = variants.map((variant, index) => `  "${variant.id}": Literal${String(index + 1).padStart(3, "0")},`)
    await writeFile(join(providerRoot, "literal-references.generated.tsx"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      'import * as React from "react"',
      'import { TooltipProvider } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"',
      'import { LiteralProviderReferenceView } from "./runtime/literal-view"',
      ...literalImports,
      "const literals = {",
      ...literalEntries,
      "} as const",
      "export function ShadcnUiPinnedLiteralReference({ adapted, variant }: { adapted: boolean; variant: string }) {",
      "  const Literal = literals[variant as keyof typeof literals]",
      "  if (!Literal) throw new Error(`Unresolved pinned literal provider variant \"${variant}\".`)",
      "  return adapted ? <LiteralProviderReferenceView Literal={Literal} variant={variant} /> : <TooltipProvider><Literal /></TooltipProvider>",
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
      variants,
      exclusions,
    }
    await writeFile(join(providerRoot, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`)
    await writeFile(join(providerRoot, "exclusions.json"), `${JSON.stringify({ schemaVersion: 1, provider: PROVIDER, commit: COMMIT, exclusions }, null, 2)}\n`)
    await writeFile(join(generatedRoot, "shadcnui-blocks.ts"), [
      "// Generated by scripts/import-shadcnui-blocks.mjs. Do not edit by hand.",
      `export const SHADCNUI_BLOCKS_INVENTORY = ${JSON.stringify(inventory, null, 2)} as const`,
      "export const SHADCNUI_BLOCK_VARIANTS = SHADCNUI_BLOCKS_INVENTORY.variants.filter((variant) => variant.role === \"block\")",
      "export const SHADCNUI_CHROME_VARIANTS = SHADCNUI_BLOCKS_INVENTORY.variants.filter((variant) => variant.role === \"chrome\")",
      "export const SHADCNUI_SYSTEM_TEMPLATES = SHADCNUI_BLOCKS_INVENTORY.variants.filter((variant) => variant.role === \"systemTemplate\")",
      "export type ShadcnUiBlocksVariant = (typeof SHADCNUI_BLOCKS_INVENTORY.variants)[number]",
      "",
    ].join("\n"))
    console.log(`Imported ${publicItems.length} public variants, ${systemItems.length} system templates, and ${exclusions.length} exclusions from ${COMMIT}.`)
  } finally {
    await cleanup()
  }
}

await main()
