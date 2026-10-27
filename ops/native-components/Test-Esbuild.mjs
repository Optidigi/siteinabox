import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"

const [version, binary] = process.argv.slice(2)
if (!["0.25.12", "0.28.2"].includes(version) || !binary || process.argv.length !== 4) throw new Error("Choose the matching reviewed esbuild version and binary")
process.env.ESBUILD_BINARY_PATH = path.resolve(binary)
const require = createRequire(path.resolve("node_modules/.pnpm/esbuild@" + version + "/node_modules/esbuild/package.json"))
const esbuild = require("./lib/main.js")
const evaluate = code => {
  const module = { exports: {} }
  vm.runInNewContext(code, { exports: module.exports, module }, { timeout: 1000 })
  return module.exports
}
try {
  assert.equal(esbuild.version, version)
  const transformed = await esbuild.transform("export const count: number = 7", { loader: "ts", format: "cjs" })
  assert.equal(evaluate(transformed.code).count, 7)
  const result = await esbuild.build({
    stdin: { contents: 'import { value } from "fixture"; export const result = value * 2', resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "cjs", write: false,
    plugins: [{ name: "native-protocol-contract", setup(build) {
      build.onResolve({ filter: /^fixture$/ }, () => ({ path: "module", namespace: "fixture" }))
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const value = 4", loader: "js" }))
    } }],
  })
  assert.equal(evaluate(result.outputFiles[0].text).result, 8)
  const context = await esbuild.context({ stdin: { contents: "export const ready = true" }, format: "cjs", write: false })
  try { assert.equal(evaluate((await context.rebuild()).outputFiles[0].text).ready, true) }
  finally { await context.dispose() }
  console.log("PASS: esbuild " + version + " transform, plugin/service protocol and rebuild lifecycle")
} finally { esbuild.stop() }
