import { postgresAdapter } from "@payloadcms/db-postgres"
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import { en } from "@payloadcms/translations/languages/en"
import { nl } from "@payloadcms/translations/languages/nl"
import path from "path"
import { buildConfig } from "payload"
import { fileURLToPath } from "url"

import { BlockPresets } from "@/collections/BlockPresets"
import { Forms } from "@/collections/Forms"
import { IntakeSubmissions } from "@/collections/IntakeSubmissions"
import { MailLogs } from "@/collections/MailLogs"
import {
  AgreementAcceptances,
  CommunicationPreferenceEvents,
  CommunicationPreferences,
  LegalDocuments,
  LegalPublicationEvents,
  LegalRequirements,
  Orders,
  SiteApprovals,
  SiteReviewRevisions,
  TenantNotificationSubscriptions,
} from "@/collections/LegalRecords"
import { Media } from "@/collections/Media"
import { OperationalAlerts } from "@/collections/OperationalAlerts"
import { LegalNotificationDeliveries } from "@/collections/LegalNotificationDeliveries"
import { LegalOperatorEvents } from "@/collections/LegalOperatorEvents"
import { Pages } from "@/collections/Pages"
import { PublishedSiteSnapshots } from "@/collections/PublishedSiteSnapshots"
import { PreviewAccessGrants } from "@/collections/PreviewAccessGrants"
import { SiteSettings } from "@/collections/SiteSettings"
import { SiteGenerationRuns } from "@/collections/SiteGenerationRuns"
import { Tenants } from "@/collections/Tenants"
import { Users } from "@/collections/Users"
import { purgeStaleFormSubmissionsTask } from "@/lib/jobs/purgeStaleFormsTask"
import { sendLegalRequirementNotificationsTask } from "@/lib/jobs/sendLegalRequirementNotificationsTask"
import { payloadEmailAdapter } from "@/lib/email/payloadEmailAdapter"
import type { Config } from "@/payload-types"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Fail fast on missing required env. An empty PAYLOAD_SECRET produces forgeable
// JWTs/cookies; an empty DATABASE_URI surfaces later as an opaque pg error.
const PAYLOAD_SECRET = process.env.PAYLOAD_SECRET
if (!PAYLOAD_SECRET) {
  throw new Error("PAYLOAD_SECRET is required (set in .env or environment)")
}
const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  throw new Error("DATABASE_URI is required (set in .env or environment)")
}

// The adapter is lazy: Cloudflare REST/SMTP provider construction happens only
// when Payload actually sends mail, not during boot, migrations, or health checks.

// TODO(phase-1.3): add `cors` + `csrf` allowlists if API-key clients become
// non-same-origin callers, or confirm same-origin and document.

export default buildConfig({
  secret: PAYLOAD_SECRET,
  email: payloadEmailAdapter,
  i18n: {
    fallbackLanguage: "nl",
    supportedLanguages: { en, nl },
  },
  db: postgresAdapter({
    pool: {
      connectionString: DATABASE_URI,
      // Allow test harnesses (e.g. tsx restore-script child) to cap pool size
      // when spawned alongside a vitest process that already holds many connections.
      ...(process.env.PG_POOL_MAX ? { max: parseInt(process.env.PG_POOL_MAX, 10) } : {}),
      // Allow test harnesses to set a connection timeout so the child fails fast
      // rather than hanging indefinitely if the pool cannot acquire a connection.
      ...(process.env.PG_CONN_TIMEOUT_MS
        ? { connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS, 10) }
        : {}),
    },
    // Under vitest, disable dev-mode push-sync. `getTestPayload()` runs
    // `migrateFresh()` so committed migrations are the sole schema authority
    // in tests (OBS-66). With push left on, `getPayload()` reconciles
    // config-vs-DB drift on init and — when a field rename is ambiguous —
    // blocks on an interactive prompt with no TTY, hanging every integration
    // suite's beforeAll. Dev (`pnpm dev`) and the `payload` CLI keep the
    // default (push on in dev) since `VITEST` is unset there.
    push: process.env.VITEST ? false : undefined,
    // Schema is managed via committed migration files in `src/migrations/`.
    // Generate via `pnpm payload migrate:create <name>`, apply via
    // `pnpm payload migrate`. In production, `scripts/migrate-on-boot.mjs`
    // runs migrations from a pre-bundled JS copy (`dist-runtime/migrations/`)
    // before `node server.js` starts; it sets PAYLOAD_MIGRATION_DIR so the
    // adapter looks there instead of the source-tree default.
    ...(process.env.PAYLOAD_MIGRATION_DIR
      ? { migrationDir: process.env.PAYLOAD_MIGRATION_DIR }
      : {})
  }),
  editor: lexicalEditor(),
  collections: [
    Tenants,
    Users,
    Media,
    Pages,
    SiteSettings,
    Forms,
    BlockPresets,
    IntakeSubmissions,
    SiteGenerationRuns,
    PublishedSiteSnapshots,
    PreviewAccessGrants,
    LegalDocuments,
    LegalPublicationEvents,
    Orders,
    AgreementAcceptances,
    SiteReviewRevisions,
    SiteApprovals,
    CommunicationPreferences,
    CommunicationPreferenceEvents,
    TenantNotificationSubscriptions,
    LegalRequirements,
    LegalNotificationDeliveries,
    LegalOperatorEvents,
    MailLogs,
    OperationalAlerts,
  ],
  // Audit-p2 #10 (T11) — Forms GDPR retention. The purge task auto-schedules
  // a daily job at 02:00 UTC; `autoRun` registers an in-process cron worker
  // that picks up scheduled jobs every minute (default cron: '* * * * *').
  // The autoRun must NOT be used on serverless platforms; siab-payload runs
  // as a long-lived Node server on a VPS so this is fine. See
  // `src/lib/jobs/purgeStaleFormsTask.ts` for the handler and
  // `audits/10-fix-batch-9-report.md` for the deployment note.
  jobs: {
    tasks: [purgeStaleFormSubmissionsTask, sendLegalRequirementNotificationsTask],
    autoRun: [{ queue: "default", cron: "* * * * *" }],
    shouldAutoRun: () => process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1",
    // FN-2026-0061 — Payload's auto-registered `payload-jobs` collection
    // ships with NO `access` block, defaulting to "all logged-in users."
    // Pre-fix any tenant editor / owner / viewer could:
    //   - GET /api/payload-jobs (list the system queue)
    //   - POST /api/payload-jobs (queue arbitrary tasks; the configured
    //     `purgeStaleFormSubmissionsTask` runs with overrideAccess:true
    //     and crosses tenant scope, so a viewer queueing it forces an
    //     off-schedule mass-delete of stale form submissions)
    //   - DELETE /api/payload-jobs/:id (delete the live scheduled job;
    //     autoRun cron self-heals within ~60s but transient damage is
    //     real)
    //
    // Two layers (BOTH required — they cover different surfaces):
    //   1. `access` here gates the named endpoints `/api/payload-jobs/run`,
    //      `/api/payload-jobs/queue`, `/api/payload-jobs/cancel`.
    //   2. `jobsCollectionOverrides.access` gates the auto-generated
    //      collection-CRUD surface (the actual exploit path).
    //
    // The autoRun cron itself bypasses these gates because it goes
    // through Payload's runJobs operation with overrideAccess:true
    // (req.user is null in the cron path; the access functions return
    // false but Payload's internal scheduler ignores access checks for
    // its own jobs).
    access: {
      run: ({ req }) => req.user?.role === "super-admin",
      queue: ({ req }) => req.user?.role === "super-admin",
      cancel: ({ req }) => req.user?.role === "super-admin"
    },
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      access: {
        read: ({ req }) => req.user?.role === "super-admin",
        create: ({ req }) => req.user?.role === "super-admin",
        update: ({ req }) => req.user?.role === "super-admin",
        delete: ({ req }) => req.user?.role === "super-admin"
      }
    })
  },
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts")
  },
  admin: {
    user: "users",
    disable: true
  },
  plugins: [
    multiTenantPlugin<Config>({
      collections: {
        pages: {},
        media: {},
        "site-settings": { isGlobal: false },
        forms: {},
        "block-presets": {}
      },
      tenantField: { name: "tenant" },
      // We declare the `tenants` array field manually on the Users collection
      // (see `src/collections/Users.ts`) so we can attach a custom `validate`
      // enforcing the "exactly-one tenant for non-super-admins, none for
      // super-admins" invariant. The plugin uses the same field shape
      // (name: "tenants", row: { tenant: relationship }) regardless.
      tenantsArrayField: { includeDefaultField: false },
      // The plugin's afterTenantDelete hook is incompatible with our
      // "exactly-one tenant for non-super-admin" validator: it runs inside the
      // same transaction as the tenant DELETE, and Postgres FK cascades are
      // deferred to COMMIT time, so the hook sees the pre-cascade state and
      // tries to UPDATE each affected user with `tenants: []` to remove the
      // entry — but our validator rejects an empty array for non-super-admins,
      // and the whole transaction rolls back.
      //
      // Workaround: disable the plugin's hook and rely on the FK CASCADE we
      // added in `20260505_202447_cascade_tenant_delete` to clear the
      // `users_tenants` rows at COMMIT time. The validator never sees the
      // intermediate empty state because the cascade is a DB-level operation
      // that bypasses Payload hooks. Disk side is handled by `removeTenantDir`
      // afterDelete in `src/hooks/tenantLifecycle.ts`.
      cleanupAfterTenantDelete: false,
      userHasAccessToAllTenants: (user) => user?.role === "super-admin"
    })
  ]
})
