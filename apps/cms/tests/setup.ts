import { afterAll } from "vitest"
import {
  assertCmsTestPrerequisites,
  assertDatabaseOwnership,
  loadCmsTestEnvironment,
  createWorkerStorage,
  cleanupWorkerStorage,
} from "./_helpers/cmsTestEnvironment.mjs"

// Resolve every supported env file and validate ownership before any test can
// import application configuration, initialize Payload or reset its database.
const { env, resource } = await loadCmsTestEnvironment()
Object.assign(process.env, env, { PAYLOAD_DB_PUSH: "false" })
await assertCmsTestPrerequisites(env)
await assertDatabaseOwnership(env, resource)
const worker = await createWorkerStorage(env, resource)
Object.assign(process.env, worker.env, { PAYLOAD_DB_PUSH: "false" })

// Cleanup closes over this invocation's validated paths, never mutable env.
afterAll(async () => { await cleanupWorkerStorage(worker) })
