#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

const allowedEvidence = [
  "apps/cms/src/migrations/",
  "packages/site-renderer/src/providers/shadcnui-blocks/upstream/",
  "packages/site-renderer/src/providers/shadcnui-blocks/registry-radix.json",
  "packages/site-renderer/src/providers/shadcnui-blocks/inventory.json",
  "packages/site-renderer/src/providers/shadcnui-blocks/exclusions.json",
  "scripts/check-generated-site-provider-cutover.mjs",
]

const forbidden = /tailwindplus|tailwind-plus|tailwind plus|tailblocks|preline|defaultBlockRegistry/i
const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
if (result.status !== 0) throw new Error(result.stderr || "git ls-files failed")

const findings = []
for (const path of result.stdout.trim().split("\n").filter(Boolean)) {
  if (allowedEvidence.some((entry) => path === entry || path.startsWith(entry))) continue
  let contents
  try {
    contents = await readFile(path, "utf8")
  } catch {
    continue
  }
  contents.split("\n").forEach((line, index) => {
    if (forbidden.test(line)) findings.push(`${path}:${index + 1}:${line.trim()}`)
  })
}

if (findings.length) {
  console.error("Obsolete generated-site provider references remain outside immutable evidence/history:\n")
  console.error(findings.join("\n"))
  process.exit(1)
}

console.log("Generated-site provider cutover audit passed.")
