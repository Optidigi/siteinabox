import { afterAll } from "vitest"
import {
  assertCmsTestPrerequisites,
  assertDatabaseOwnership,
  loadCmsTestEnvironment,
  createWorkerStorage,
  cleanupWorkerStorage,
  applyCmsTestEnvironment,
} from "./_helpers/cmsTestEnvironment.mjs"

// Resolve every supported env file and validate ownership before any test can
// import application configuration, initialize Payload or reset its database.
const { env, resource } = await loadCmsTestEnvironment()
applyCmsTestEnvironment(env, resource)
await assertCmsTestPrerequisites(env)
await assertDatabaseOwnership(env, resource)
const worker = await createWorkerStorage(env, resource)
applyCmsTestEnvironment(worker.env, resource)

// Cleanup closes over this invocation's validated paths, never mutable env.
afterAll(async () => { await cleanupWorkerStorage(worker) })
