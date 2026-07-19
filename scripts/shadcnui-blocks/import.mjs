import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { adaptLiteralImports } from "./adapt-literal.mjs"
import { compileBlockBindings } from "./compile-bindings.mjs"
import {
  COMMIT,
  NAMESPACE,
  PROVIDER,
  REGISTRY_FILE,
  REPOSITORY,
  bindingManifestPath,
  categoryFor,
  compatibilityPrimitives,
  generatedRoot,
  isPublic,
  isSystem,
  providerRoot,
  root,
  tokenExceptionManifestPath,
  uiProviderRoot,
  variantsRoot,
} from "./constants.mjs"
import {
  allStructuredFields,
  chromeCapabilities,
  fieldSets,
  referenceRootClassName,
  semanticForVariant,
  slotsFor,
} from "./catalog.mjs"
import { fileInventory, sha256 } from "./hash.mjs"
import {
  applyVariantLiteralAdaptations,
  applyVariantSlotOverrides,
  generateVariantView,
  getVariantComposition,
  buildFormFeatureAudit,
  getVariantFeatureAuditExtras,
  hasDirectBindings,
  resolveLiteralFilename,
  shouldPreserveOwnedVariant,
  shouldSkipBindingCompilation,
} from "./variant-special-cases.mjs"

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" })
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`)
}

export async function checkoutSource() {
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

async function backupOwnedVariantFiles(bindingManifest) {
  const backups = new Map()
  for (const upstreamName of Object.keys(bindingManifest.direct ?? {})) {
    const dir = join(variantsRoot, upstreamName)
    try {
      await access(dir)
    } catch {
      continue
    }
    const entries = await readdir(dir, { withFileTypes: true })
    const files = new Map()
    for (const entry of entries) {
      if (!entry.isFile()) continue
      files.set(entry.name, await readFile(join(dir, entry.name), "utf8"))
    }
    if (files.size > 0) backups.set(upstreamName, files)
  }
  return backups
}

async function restoreOwnedVariantFiles(upstreamName, backups) {
  const files = backups.get(upstreamName)
  if (!files) return
  const dir = join(variantsRoot, upstreamName)
  await mkdir(dir, { recursive: true })
  for (const [filename, contents] of files) {
    await writeFile(join(dir, filename), contents)
  }
}

export async function runImport() {
  const bindingManifest = JSON.parse(await readFile(bindingManifestPath, "utf8"))
  const tokenExceptionManifestBuffer = await readFile(tokenExceptionManifestPath)
  const tokenExceptionManifest = JSON.parse(tokenExceptionManifestBuffer.toString("utf8"))
  if (bindingManifest && (bindingManifest.provider !== PROVIDER || bindingManifest.commit !== COMMIT)) {
    throw new Error(`Binding manifest must target ${PROVIDER} at ${COMMIT}.`)
  }
  if (tokenExceptionManifest.provider !== PROVIDER) throw new Error(`Token exception manifest must target ${PROVIDER}.`)

  const ownedBackups = await backupOwnedVariantFiles(bindingManifest)
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
      const semantic = semanticForVariant(category, item.name)
      const mainStem = category === "carousel-block" ? "carousel" : category
      const literalEntryPath = (item.files ?? []).find((file) => file.path.endsWith(`/${mainStem}.tsx`))?.path
      if (!literalEntryPath) throw new Error(`No literal entry component found for ${item.name}.`)

      const preserveOwned = shouldPreserveOwnedVariant(bindingManifest, item.name)
      const sourceFiles = []
      const sourceTexts = []
      let explicitBindings = []
      let rootClassName

      for (const file of item.files ?? []) {
        const rawContents = (await readFile(join(source, file.path))).toString("utf8")
        sourceTexts.push(rawContents)
        sourceFiles.push({ path: file.path, sha256: sha256(rawContents) })
        rootClassName ??= referenceRootClassName(rawContents)

        if (preserveOwned) continue

        const upstreamFilename = file.path.split("/").at(-1)
        const literalFilename = resolveLiteralFilename(item.name, upstreamFilename)
        const literalDestination = join(variantsRoot, item.name, literalFilename)
        await mkdir(dirname(literalDestination), { recursive: true })

        let adaptedLiteral = adaptLiteralImports(rawContents)
        adaptedLiteral = applyVariantLiteralAdaptations(item.name, {
          contents: adaptedLiteral,
          filename: literalFilename,
          isEntryFile: file.path === literalEntryPath,
        })

        const skipBindings = shouldSkipBindingCompilation(item.name, literalFilename, bindingManifest)
        if (semantic.role === "block" && !skipBindings) {
          const declarations = bindingManifest?.variants?.[item.name]?.[literalFilename] ?? []
          const compiled = compileBlockBindings(adaptedLiteral, semantic.blockType, declarations, `${item.name}/${literalFilename}`)
          adaptedLiteral = compiled.contents
          explicitBindings.push(...compiled.bindings.map((binding) => ({ file: literalFilename, ...binding })))
        }

        await writeFile(literalDestination, adaptedLiteral)
      }

      if (preserveOwned) {
        await restoreOwnedVariantFiles(item.name, ownedBackups)
        explicitBindings = []
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
      applyVariantSlotOverrides(item.name, variantSlots)

      const activeSlots = Object.entries(variantSlots).filter(([, slot]) => slot.status !== "inactive").map(([name]) => name)
      const featureAudit = [
        { feature: "dom-and-classes", disposition: "literal-preserved", evidence: preserveOwned ? "Owned typed or behavior-adapter view" : "Vendored pinned literal view" },
        { feature: "responsive-layout", disposition: "literal-preserved", evidence: "Upstream responsive class names" },
        ...(/(?:animate-|transition-|motion|marquee|carousel)/i.test(sourceText) ? [{ feature: "animation-and-motion", disposition: "literal-preserved", evidence: "Pinned source animation classes/runtime" }] : []),
        ...(/(?:<Image|<img|imageUrl|\.jpg|\.png|\.webp|unsplash)/i.test(sourceText) ? [{ feature: "media", disposition: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "structured-adapter" : "inactive", evidence: activeSlots.some((slot) => /image|logo|avatar|media/i.test(slot)) ? "CMS media slot with preserved literal dimensions" : "Decorative/demo media is removed because this semantic contract has no media field" }] : []),
        ...buildFormFeatureAudit(sourceText, semantic, item.name),
        ...(/(?:href=|<Link|<a\s)/i.test(sourceText) ? [{ feature: "links-and-actions", disposition: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "structured-adapter" : "runtime-derived", evidence: activeSlots.some((slot) => /link|cta|action|legal/i.test(slot)) ? "Validated link/action slots" : "Safe tenant/runtime navigation" }] : []),
        ...(/(?:\.map\(|Carousel|Accordion|Tabs)/.test(sourceText) ? [{ feature: "repeated-or-interactive-content", disposition: activeSlots.some((slot) => variantSlots[slot]?.repeated) ? "structured-adapter" : "literal-preserved", evidence: activeSlots.some((slot) => variantSlots[slot]?.repeated) ? "Typed repeated slot" : "Pinned literal interaction without demo data" }] : []),
        ...getVariantFeatureAuditExtras(item.name, { sourceText }).filter((entry) => entry.feature !== "form"),
      ]

      const dependencies = [...new Set([...(item.dependencies ?? []), ...(item.registryDependencies ?? [])])].sort()
      const composition = getVariantComposition(item.name)
      variants.push({
        id: `${NAMESPACE}.${item.name}`,
        upstreamName: item.name,
        entryFile: `${mainStem}.tsx`,
        title: item.title,
        description: item.description,
        ...semantic,
        slots: variantSlots,
        bindings: explicitBindings,
        adaptationStatus: preserveOwned
          ? (hasDirectBindings(bindingManifest, item.name) ? "direct-owned" : "owned")
          : "literal-compiled",
        capabilities: chromeCapabilities[item.name],
        featureAudit,
        composition,
        dependencies,
        referenceRootClassName: rootClassName,
        sourceFiles,
        sourceHash: sha256(sourceFiles.map((file) => `${file.path}:${file.sha256}`).join("\n")),
      })

      if (semantic.role === "block" && !preserveOwned) {
        const view = generateVariantView(item.name, { semantic, mainStem, namespace: NAMESPACE })
        await writeFile(join(variantsRoot, item.name, "view.tsx"), view)
      } else if (semantic.role === "block" && preserveOwned && !ownedBackups.get(item.name)?.has("view.tsx")) {
        const view = generateVariantView(item.name, { semantic, mainStem, namespace: NAMESPACE })
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
      variant.adaptedFiles = await fileInventory(join(variantsRoot, variant.upstreamName), root)
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
