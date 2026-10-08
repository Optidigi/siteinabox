// A standalone Node worker is server code, but Payload config also imports
// React admin declarations. Preserve normal React and alias only the build-time
// server-only marker, matching the test runner's existing marker alias.
import { registerHooks } from "node:module"
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
