process.env.PAYLOAD_DISABLE_JOBS_AUTORUN = "1"

async function main(): Promise<number> {
  const [
    { getPayload },
    { default: config },
    { commerceProductionReadinessBlockers },
    { commerceProviderCapabilityBlockers },
    { resolveCommerceEdgeRoutingInventory },
  ] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
    import("@/lib/commerce/releaseGateCore"),
    import("@/lib/commerce/providerCapabilityPreflight"),
    import("@/lib/domains/edgeRouting"),
  ])

  const payload = await getPayload({ config })
  try {
    const localBlockers = await commerceProductionReadinessBlockers(payload)
    const edgeInventory = await resolveCommerceEdgeRoutingInventory(payload)
    const providerBlockers = await commerceProviderCapabilityBlockers({
      zoneDomains: edgeInventory.zoneDomains,
      tunnelHostnames: {
        renderer: edgeInventory.rendererHosts,
        cms: edgeInventory.cmsHosts,
      },
    })
    const blockers = [...new Set([
      ...localBlockers,
      ...providerBlockers,
    ])]

    if (blockers.length > 0) {
      payload.logger.error(
        `Commerce production readiness failed: ${blockers.join(", ")}`,
      )
      return 1
    }
    payload.logger.info("Commerce production readiness passed.")
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
      "Commerce production readiness command failed unexpectedly.\n",
    )
    process.exit(1)
  },
)
