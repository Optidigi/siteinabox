// Isolated process proof: validate the final inherited environment before any
// application import. Reuse the marked database; never reset its schema here.
import { applyCmsTestEnvironment, assertDatabaseOwnership, assertWorkerStorage, loadCmsTestEnvironment } from "./cmsTestEnvironment.mjs"
const { env, resource } = await loadCmsTestEnvironment()
await assertDatabaseOwnership(env, resource)
await assertWorkerStorage(env, resource)
applyCmsTestEnvironment(env, resource)
const [{ getPayload }, { default: config }, { admitAccountLink }] = await Promise.all([
  import("payload"), import("../../src/payload.config.ts"), import("../../src/lib/auth/accountLinkStore.ts"),
])
const payload = await getPayload({ config })
try {
  const result = await admitAccountLink(payload, { namespace: "preview", purpose: "free_verification", lane: "acquisition",
    recipient: "m15-process-race@test.invalid", origin: "https://admin.siteinabox.nl", callbackPath: "/builder", errorCallbackPath: "/login" })
  console.log(JSON.stringify({ accountLinkProbe: true, kind: result.kind }))
} finally { await payload.destroy() }
// Owning CLI imports also register background timer infrastructure. This probe
// has no work after its connections close; do not retain those timers.
process.exit(0)
