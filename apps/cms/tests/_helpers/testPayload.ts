import { BasePayload, buildConfig, createLocalReq, type Payload, type PayloadRequest, type CollectionConfig } from "payload"
import { postgresAdapter } from "@payloadcms/db-postgres"

/** A real, uninitialized instance: typed spies may replace only the methods a test exercises. */
export function createTestPayload(): Payload {
  return new BasePayload()
}

/** Build the actual Local API request without initializing a database or application configuration. */
export async function createTestRequest(payload: Payload, options: Partial<PayloadRequest> = {}): Promise<PayloadRequest> {
  if (!payload.config) {
    payload.config = await buildConfig({
      secret: "unit-test-fixture-secret",
      telemetry: false,
      db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }),
      collections: [],
    })
  }
  return createLocalReq({ req: options }, payload)
}

/** Initialize the installed logger and database adapter without opening a database connection. */
export async function createInitializedTestPayload(collections: CollectionConfig[] = []): Promise<Payload> {
  const payload = createTestPayload()
  await payload.init({
    config: await buildConfig({
      secret: "unit-test-fixture-secret",
      telemetry: false,
      logger: { options: { level: "silent" } },
      typescript: { autoGenerate: false },
      db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }),
      collections,
    }),
    disableDBConnect: true,
    disableOnInit: true,
  })
  return payload
}
