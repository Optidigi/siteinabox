process.env.PAYLOAD_DISABLE_JOBS_AUTORUN = "1"

async function main(): Promise<number> {
  const [
    { getPayload },
    { default: config },
    { commerceEdgeInventoryBlockers },
  ] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
    import("@/lib/commerce/releaseGateCore"),
  ])

  const payload = await getPayload({ config })
  try {
    const blockers = await commerceEdgeInventoryBlockers(payload)

    if (blockers.length > 0) {
      payload.logger.error(
        `Commerce edge inventory preflight failed: ${blockers.join(", ")}`,
      )
      return 1
    }
    payload.logger.info("Commerce edge inventory preflight passed.")
    return 0
  } finally {
    await payload.destroy()
  }
}

// Payload 3.86 retains a dedicated PostgreSQL connection sentinel after
// destroy(). This one-off command exits from both promise settlements after
// awaited cleanup; failure output is intentionally stable and payload-free.
void main().then(
  (code) => process.exit(code),
  () => {
    process.stderr.write("Commerce edge inventory command failed unexpectedly.\n")
    process.exit(1)
  },
)
