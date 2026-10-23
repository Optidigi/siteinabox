import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

export function affectedProfiles(paths) {
  const profiles = new Set(["fast"])
  for (const path of paths) {
    if (path.startsWith("apps/cms/")) profiles.add("cms-fast")
    else if (path.startsWith("apps/renderer/")) profiles.add("renderer-fast")
    else if (path.startsWith("apps/landing/")) profiles.add("site-fast")
    else if (/^(?:docs\/|AGENTS\.md$|README)/.test(path)) continue
    else for (const profile of ["cms-fast", "renderer-fast", "site-fast"]) profiles.add(profile)
  }
  return [...profiles]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), plan = args.at(-1) === "--plan"
  if (plan) args.pop()
  assert(args.length === 2 && args[0] === "--base" && /^[a-f0-9]{40}$/.test(args[1]), "Usage: check:affected --base FULL_SHA [--plan]")
  const root = fileURLToPath(new URL("..", import.meta.url))
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean)
  const paths = [...new Set([...git(["diff", "--name-only", "-z", args[1], "--"]), ...git(["ls-files", "--others", "--exclude-standard", "-z"])])]
  const profiles = affectedProfiles(paths)
  console.log(JSON.stringify({ profiles, changedPaths: paths.length, scope: "Local preflight only; add focused regressions and required CI for the task's risk" }))
  if (!plan) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./run-verification.mjs", import.meta.url)), profiles.join(",")], { cwd: root, env: process.env, stdio: "inherit" })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  }
}
