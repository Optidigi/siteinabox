import path from "node:path"
import { realpath } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import { assertDatabaseOwnership, assertWorkerStorage, loadCmsTestEnvironment } from "./cmsTestEnvironment.mjs"

const scriptsRoot = fileURLToPath(new URL("../../scripts/", import.meta.url))
const args = process.argv.slice(2)
if (args.length !== 1) throw new Error("One CMS script target is required")
const target = await realpath(path.resolve(fileURLToPath(new URL("../../", import.meta.url)), args[0]))
const relative = path.relative(scriptsRoot, target)
if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Test child target must be an owning CMS script")
const { env, resource } = await loadCmsTestEnvironment()
await assertWorkerStorage(env, resource)
await assertDatabaseOwnership(env, resource)
Object.assign(process.env, env, { PAYLOAD_DB_PUSH: "false" })
await import(pathToFileURL(target).href)
