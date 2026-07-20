import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { join } from "node:path"
import { checkoutSource } from "./import.mjs"
import { providerRoot } from "./constants.mjs"
import {
  fingerprintClassesForVariant,
  selectFingerprintSourcePaths,
} from "../../packages/site-renderer/src/providers/shadcnui-blocks/structural-classes.mjs"

const inventoryPath = join(providerRoot, "inventory.json")
const outputPath = join(providerRoot, "structural-fingerprints.json")

export async function generateStructuralFingerprints() {
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"))
  const { source, cleanup } = await checkoutSource()

  try {
    /** @type {Record<string, { classes: string[], sourcePaths: string[] }>} */
    const variants = {}

    for (const variant of inventory.variants) {
      /** @type {Map<string, string>} */
      const sourceContents = new Map()
      for (const file of variant.sourceFiles) {
        const absolute = join(source, file.path)
        sourceContents.set(file.path, await readFile(absolute, "utf8"))
      }

      const sourcePaths = selectFingerprintSourcePaths(variant, sourceContents)
      const classes = fingerprintClassesForVariant(variant, sourceContents)
      variants[variant.upstreamName] = { classes, sourcePaths }
    }

    const payload = {
      provider: inventory.provider,
      commit: inventory.commit,
      generatedAt: new Date().toISOString(),
      variants,
    }

    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
    console.log(`Wrote ${Object.keys(variants).length} variant fingerprints to ${outputPath}`)
    return payload
  } finally {
    await cleanup()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateStructuralFingerprints()
}
