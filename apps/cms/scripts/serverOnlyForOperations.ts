import { registerHooks } from "node:module"

let installed = false

/** CLI entrypoints use server code outside Next's server-only resolver. */
export function enableServerOnlyForOperations() {
  if (installed) return
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true }
      return nextResolve(specifier, context)
    },
  })
  installed = true
}
