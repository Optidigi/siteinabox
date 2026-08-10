import { readFile, readdir } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"

const repoRoot = resolve(new URL("..", import.meta.url).pathname)
const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"))
const expectedPnpm = rootPackage.packageManager.replace(/^pnpm@/, "")
const nodeRange = rootPackage.engines?.node ?? ""
const lowerNode = Number(nodeRange.match(/>=([0-9]+)/)?.[1])
const upperNode = Number(nodeRange.match(/<([0-9]+)/)?.[1])
const actualNode = Number(process.versions.node.split(".")[0])
const actualPnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()
const errors = []

if (!Number.isInteger(lowerNode) || !Number.isInteger(upperNode)) {
  errors.push("root engines.node is not a bounded major range: " + nodeRange)
} else if (actualNode < lowerNode || actualNode >= upperNode) {
  errors.push("Node " + process.versions.node + " is outside " + nodeRange)
}
if (actualPnpm !== expectedPnpm) errors.push("pnpm " + actualPnpm + " does not match " + expectedPnpm)

async function listFiles(directory, predicate) {
  const entries = await readdir(resolve(repoRoot, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(relative, predicate)))
    else if (predicate(relative)) files.push(relative)
  }
  return files
}

const workflowFiles = await listFiles(".github/workflows", (file) => /\.(yml|yaml)$/.test(file))
for (const file of workflowFiles) {
  const content = await readFile(resolve(repoRoot, file), "utf8")
  for (const match of content.matchAll(/node-version:\s*["']?(\d+)/g)) {
    if (Number(match[1]) !== lowerNode) errors.push(file + " declares Node " + match[1])
  }
}

const dockerfiles = await listFiles("apps", (file) => file.endsWith("Dockerfile"))
for (const file of dockerfiles) {
  const content = await readFile(resolve(repoRoot, file), "utf8")
  const nodeDeclarations = [
    ...content.matchAll(/FROM\s+node:(\d+)/g),
    ...content.matchAll(/ARG\s+NODE_VERSION=(\d+)/g),
  ]
  for (const match of nodeDeclarations) {
    if (Number(match[1]) !== lowerNode) errors.push(file + " declares Node " + match[1])
  }
  for (const match of content.matchAll(/pnpm@(\d+\.\d+\.\d+)/g)) {
    if (match[1] !== expectedPnpm) errors.push(file + " declares pnpm " + match[1])
  }
}

const localRunbook = await readFile(resolve(repoRoot, "docs/runbooks/local-development.md"), "utf8")
if (!localRunbook.includes("pnpm@" + expectedPnpm)) {
  errors.push("docs/runbooks/local-development.md does not name the root pnpm version")
}

if (errors.length > 0) {
  console.error("Toolchain consistency check failed:")
  for (const error of errors) console.error("- " + error)
  process.exit(1)
}

console.log(
  "Toolchain OK: Node " +
    lowerNode +
    ", pnpm " +
    expectedPnpm +
    "; checked " +
    workflowFiles.length +
    " workflows and " +
    dockerfiles.length +
    " Dockerfiles.",
)
