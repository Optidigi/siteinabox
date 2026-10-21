import assert from "node:assert/strict"
import { sql } from "@payloadcms/db-postgres"
import { queryRows } from "@/lib/record"
import { loadCmsTestEnvironment, assertWorkerStorage, assertDatabaseOwnership, applyCmsTestEnvironment } from "../_helpers/cmsTestEnvironment.mjs"

// Deliberately perturb only this journey's synthetic identity through the SDK.
// This is not the reset/seed helper, and never adopts a developer resource.
const context = await loadCmsTestEnvironment()
await assertWorkerStorage(context.env, context.resource)
await assertDatabaseOwnership(context.env, context.resource)
applyCmsTestEnvironment(context.env, context.resource)
const action = process.argv[2]
assert(action === "unverify" || action === "restore-verification", "Unknown owned customer fixture control")
const [{ getPayload }, { default: config }, { previewAuth }] = await Promise.all([
  import("payload"), import("@/payload.config"), import("@/lib/preview/betterAuth"),
])
const payload = await getPayload({ config })
try {
  const rows = queryRows<{ id: string }>(await payload.db.drizzle.execute(sql`
    SELECT id FROM preview_auth_users WHERE email='m14-free@test.invalid'`))
  assert.equal(rows.length, 1)
  await (await previewAuth.$context).internalAdapter.updateUser(rows[0]!.id, { emailVerified: action === "restore-verification" })
  console.log("Owned synthetic preview verification state updated through the installed SDK")
} finally {
  await globalThis.__siabPreviewBetterAuthPool?.end()
  await payload.destroy()
}
process.exit(0)
