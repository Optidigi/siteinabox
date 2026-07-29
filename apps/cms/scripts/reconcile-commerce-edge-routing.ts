process.env.PAYLOAD_DISABLE_JOBS_AUTORUN = "1"

async function main(): Promise<number> {
  const [
    { getPayload },
    { default: config },
    {
      commerceEdgeBootstrapBlockers,
      commerceEdgeBootstrapWritesAllowed,
    },
    { reconcileCommerceEdgeRouting },
  ] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
    import("@/lib/commerce/releaseGateCore"),
    import("@/lib/domains/edgeRouting"),
  ])

  if (!commerceEdgeBootstrapWritesAllowed()) {
    process.stderr.write(
      "Controlled edge bootstrap is blocked by its production prerequisites.\n",
    )
    return 1
  }

  const payload = await getPayload({ config })
  try {
    const blockers = await commerceEdgeBootstrapBlockers(payload)
    if (blockers.length > 0) {
      payload.logger.error(
        `Controlled edge bootstrap inventory failed: ${blockers.join(", ")}`,
      )
      return 1
    }
    const result = await reconcileCommerceEdgeRouting(payload, {
      providerWritesAllowed: () => true,
    })
    if (result.failed > 0 || result.pending > 0) {
      payload.logger.error(
        `Controlled edge bootstrap incomplete: ${result.failed} failed, ${result.pending} pending.`,
      )
      return 1
    }
    payload.logger.info(
      `Controlled edge bootstrap passed for ${result.active}/${result.examined} domains.`,
    )
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
    process.stderr.write(
      "Controlled edge bootstrap command failed unexpectedly.\n",
    )
    process.exit(1)
  },
)
