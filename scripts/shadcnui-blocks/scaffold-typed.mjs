import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  COMMIT,
  NAMESPACE,
  TYPED_PILOT_UPSTREAM_NAMES,
  bindingManifestPath,
  categoryFor,
  providerRoot,
  variantsRoot,
} from "./constants.mjs"
import { adaptLiteralImports } from "./adapt-literal.mjs"
import { hasDirectBindings } from "./variant-special-cases.mjs"
import { semanticForVariant } from "./catalog.mjs"

function toComponentName(upstreamName) {
  const match = upstreamName.match(/^(.+)-(\d+)$/)
  if (!match) throw new Error(`Unsupported upstream variant name: ${upstreamName}`)
  const base = match[1].split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")
  return `${base}${match[2]}`
}

function toFixtureExport(upstreamName) {
  return `${upstreamName.replace(/-([a-z])/g, (_, char) => char.toUpperCase()).replace(/-/g, "")}Literal`
}

export function buildTypedScaffold({
  upstreamName,
  blockType,
  mainStem,
  directFields,
  namespace = NAMESPACE,
  upstreamLiteral,
}) {
  const componentName = toComponentName(upstreamName)
  const fixtureExport = toFixtureExport(upstreamName)
  const normalizedLiteral = adaptLiteralImports(upstreamLiteral)
  const fieldProps = directFields.map((field) => `  ${field}?: unknown`).join("\n")

  const componentSource = [
    `// Typed adaptation scaffold for upstream shadcnui-blocks ${upstreamName} (MIT, see ../../LICENSE).`,
    "// Replace TODO markers with owned typed rendering.",
    '"use client"',
    "",
    'import * as React from "react"',
    'import type { BlockEditSlots } from "../../../../blocks/types"',
    `import { ${fixtureExport} } from "../../typed/fixtures/${upstreamName}"`,
    'import type { TypedVariantBaseProps } from "../../typed/props"',
    "",
    `const BLOCK_TYPE = "${blockType}" as const`,
    "",
    `export type ${componentName}Props = TypedVariantBaseProps & {`,
    fieldProps,
    "}",
    "",
    `export function ${componentName}({ blockIndex, editSlots, rootAttributes, ...fields }: ${componentName}Props) {`,
    "  void BLOCK_TYPE",
    "  void blockIndex",
    "  void editSlots",
    "  void rootAttributes",
    "  void fields",
    "  return (",
    "    <div {...rootAttributes}>",
    "      {/* TODO: replace upstream-literal.tsx structure with typed field renderers */}",
    "      <p>Typed scaffold for {BLOCK_TYPE}; implement {Object.keys(fields).join(\", \")}.</p>",
    "    </div>",
    "  )",
    "}",
    "",
    `export default function ${componentName}Literal() {`,
    `  return <${componentName} {...${fixtureExport}} blockIndex={0} />`,
    "}",
    "",
  ].join("\n")

  const viewSource = [
    'import * as React from "react"',
    'import type { Block } from "@siteinabox/contracts"',
    'import type { BlockRenderOptions } from "../../../../blocks/types"',
    'import { providerBlockAttributes } from "../../runtime/block"',
    `import { ${componentName} } from "./${mainStem.replace(/\.tsx$/, "")}"`,
    `type VariantBlock = Extract<Block, { blockType: "${blockType}" }>`,
    "",
    `const VARIANT = "${namespace}.${upstreamName}" as const`,
    "",
    `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {`,
    "  return (",
    `    <${componentName}`,
    ...directFields.map((field) => `      ${field}={block.${field}}`),
    "      blockIndex={options.index}",
    "      editSlots={options.editSlots}",
    "      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}",
    "    />",
    "  )",
    "}",
    "",
  ].join("\n")

  const fixtureSource = [
    `// TODO: add preview fixtures for ${upstreamName} typed pilot.`,
    `export const ${fixtureExport} = {}`,
    "",
  ].join("\n")

  return {
    componentName,
    files: {
      "upstream-literal.tsx": normalizedLiteral,
      [`${mainStem}`]: componentSource,
      "view.tsx": viewSource,
      [`../../typed/fixtures/${upstreamName}.ts`]: fixtureSource,
    },
  }
}

export function assertScaffoldAllowed(bindingManifest, upstreamName, { force = false } = {}) {
  if (TYPED_PILOT_UPSTREAM_NAMES.has(upstreamName)) {
    throw new Error(`${upstreamName} is already a typed pilot. Remove typed sources or pass --force to overwrite scaffold output.`)
  }
  if (hasDirectBindings(bindingManifest, upstreamName) && !force) {
    throw new Error(`${upstreamName} already has bindings.direct entries. Pass --force to scaffold anyway.`)
  }
}

export async function runScaffold(upstreamName, { force = false, upstreamLiteral, dryRun = false } = {}) {
  const bindingManifest = JSON.parse(await readFile(bindingManifestPath, "utf8"))
  if (bindingManifest.commit !== COMMIT) {
    throw new Error(`Binding manifest must target commit ${COMMIT}.`)
  }
  await assertScaffoldAllowed(bindingManifest, upstreamName, { force })

  const category = categoryFor(upstreamName)
  const semantic = semanticForVariant(category, upstreamName)
  if (!semantic || semantic.role !== "block") {
    throw new Error(`Scaffold supports block variants only; ${upstreamName} resolves to ${semantic?.role ?? "unknown"}.`)
  }

  const mainStem = category === "carousel-block" ? "carousel.tsx" : `${category === "logo-cloud" ? "logo-cloud" : category}.tsx`
  const directFields = bindingManifest.direct?.[upstreamName] ?? []
  if (!upstreamLiteral) {
    throw new Error(`Scaffold for ${upstreamName} requires upstreamLiteral content (use --source= checkout or unit-test fixtures).`)
  }

  const scaffold = buildTypedScaffold({
    upstreamName,
    blockType: semantic.blockType,
    mainStem,
    directFields,
    upstreamLiteral,
  })

  if (dryRun) return scaffold

  const variantDir = join(variantsRoot, upstreamName)
  await mkdir(variantDir, { recursive: true })
  for (const [relativePath, contents] of Object.entries(scaffold.files)) {
    if (relativePath.startsWith("../../")) {
      const destination = join(providerRoot, relativePath.replace(/^\.\.\/\.\.\//, ""))
      await mkdir(dirname(destination), { recursive: true })
      if (!force) {
        try {
          await access(destination)
          throw new Error(`${destination} already exists. Pass --force to overwrite.`)
        } catch (error) {
          if (error.code !== "ENOENT") throw error
        }
      }
      await writeFile(destination, contents)
      continue
    }
    const destination = join(variantDir, relativePath)
    if (!force) {
      try {
        await access(destination)
        throw new Error(`${destination} already exists. Pass --force to overwrite.`)
      } catch (error) {
        if (error.code !== "ENOENT") throw error
      }
    }
    await writeFile(destination, contents)
  }

  return scaffold
}
