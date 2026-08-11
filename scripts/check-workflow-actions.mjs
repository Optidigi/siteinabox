import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const workflowRoot = new URL("../.github/workflows/", import.meta.url)
const files = (await readdir(workflowRoot)).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
const failures = []

for (const file of files) {
  const source = await readFile(join(workflowRoot.pathname, file), "utf8")
  for (const [index, line] of source.split("\n").entries()) {
    if (!/\buses:\s*/.test(line)) continue
    const match = line.match(/\buses:\s*([^@\s]+)@([^\s#]+)/)
    if (!match || !/^[0-9a-f]{40}$/i.test(match[2])) {
      failures.push(file + ":" + (index + 1) + ": workflow action must use a 40-character commit SHA")
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log("Workflow action refs are immutable (" + files.length + " workflow files checked).")
}
