import assert from "node:assert/strict"

export function builtBrowserOptions(args) {
  const allowed = new Set(["--reuse-built", "--scenario=workspace-settings"])
  assert(args.every(arg => allowed.has(arg)) && new Set(args).size === args.length,
    "Usage: test:built-browser [--reuse-built] [--scenario=workspace-settings]")
  const scenario = args.includes("--scenario=workspace-settings") ? "workspace-settings" : "full"
  return { reuse: args.includes("--reuse-built"), scenario,
    qualification: scenario === "full" ? "full" : "diagnostic" }
}
