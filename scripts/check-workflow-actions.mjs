import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

// A single local composite owns CI setup. Keep the allowed local seam explicit;
// external actions inside it are checked exactly like workflow actions.
export async function workflowActionSources() {
  const root = new URL("../.github/workflows/", import.meta.url)
  const files = (await readdir(root)).filter(file => /\.ya?ml$/.test(file))
  const paths = [...files.map(file => ".github/workflows/" + file), ".github/actions/setup-ci/action.yml"]
  return Promise.all(paths.map(async file => ({ file, source: await readFile(new URL("../" + file, import.meta.url), "utf8") })))
}

export function assertImmutableActions(source) {
  for (const line of source.split("\n")) {
    if (!/\buses:\s*/.test(line)) continue
    const reference = line.match(/\buses:\s*([^\s#]+)/)?.[1]
    if (reference === "./.github/actions/setup-ci") continue
    if (!/^[^@\s]+@[0-9a-f]{40}$/i.test(reference ?? "")) {
      throw new Error("Action must use a reviewed local setup or a 40-character commit SHA: " + reference)
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const { file, source } of await workflowActionSources()) {
    try { assertImmutableActions(source) } catch (error) { throw new Error(file + ": " + error.message) }
  }
  console.log("Workflow and shared setup action refs are immutable.")
}
