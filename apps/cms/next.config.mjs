import path from "node:path"
import { fileURLToPath } from "node:url"
import { withPayload } from "@payloadcms/next/withPayload"
import createNextIntlPlugin from "next-intl/plugin"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")
const allowedDevOrigins = (process.env.SIAB_ALLOWED_DEV_ORIGINS || "admin.siteinabox.nl")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Pin the file-trace root to this repo so Next doesn't walk up to a
  // sibling lockfile and emit "We detected multiple lockfiles" in dev /
  // a giant unrelated trace at build time.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  reactCompiler: false,
  allowedDevOrigins,
  transpilePackages: ["@siteinabox/ui", "@siteinabox/contracts", "@siteinabox/site-renderer"]
}

export default withPayload(withNextIntl(nextConfig))
