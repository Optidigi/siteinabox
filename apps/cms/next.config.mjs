import path from "node:path"
import { fileURLToPath } from "node:url"
import { withPayload } from "@payloadcms/next/withPayload"
import createNextIntlPlugin from "next-intl/plugin"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Pin the file-trace root to this repo so Next doesn't walk up to a
  // sibling lockfile and emit "We detected multiple lockfiles" in dev /
  // a giant unrelated trace at build time.
  outputFileTracingRoot: __dirname,
  reactCompiler: false,
  transpilePackages: ["@siteinabox/ui", "@siteinabox/contracts"]
}

export default withPayload(withNextIntl(nextConfig))
