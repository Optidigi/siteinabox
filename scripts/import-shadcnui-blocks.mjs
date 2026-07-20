#!/usr/bin/env node

import { runImport } from "./shadcnui-blocks/import.mjs"
import { runScaffold } from "./shadcnui-blocks/scaffold-typed.mjs"

const scaffoldArg = process.argv.find((arg) => arg.startsWith("--scaffold="))
if (scaffoldArg) {
  const upstreamName = scaffoldArg.slice("--scaffold=".length)
  const force = process.argv.includes("--force")
  const dryRun = process.argv.includes("--dry-run")
  const literalArg = process.argv.find((arg) => arg.startsWith("--upstream-literal="))
  const upstreamLiteral = literalArg
    ? await readUpstreamLiteralArg(literalArg.slice("--upstream-literal=".length))
    : undefined
  const result = await runScaffold(upstreamName, { force, dryRun, upstreamLiteral })
  if (dryRun) {
    console.log(JSON.stringify({ upstreamName, files: Object.keys(result.files) }, null, 2))
  } else {
    console.log(`Scaffolded typed adaptation workspace for ${upstreamName}.`)
  }
} else {
  await runImport()
}

async function readUpstreamLiteralArg(value) {
  if (value.startsWith("@")) {
    const { readFile } = await import("node:fs/promises")
    return readFile(value.slice(1), "utf8")
  }
  return value
}
