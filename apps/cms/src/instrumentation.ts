/** Start the configured durable job queue in the long-running Node server. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build" ||
        process.env.PAYLOAD_DISABLE_JOBS_AUTORUN === "1") return
    const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("./payload.config")])
    const payload = await getPayload({ config, cron: true })
    payload.logger.info({ event: "cms_jobs_scheduler_initialized", registeredSchedules: payload.crons.length }, "CMS job scheduler initialized.")
  }
}
