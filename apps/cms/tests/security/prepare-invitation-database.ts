import { getTestPayload } from "../integration/_helpers"

// The caller admits an empty database; the owning helper independently checks
// resource/worker ownership before loading configuration or applying migrations.
const payload = await getTestPayload()
await payload.destroy()
// As with the browser fixture, terminate unrelated SDK maintenance timers only
// after the owning database adapter has closed successfully.
process.exit(0)
