import "server-only"

import { execFile as execFileCallback } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { BlockList, isIP } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { resolve4, resolve6 } from "node:dns/promises"
import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"
import { normalizeCompleteZone } from "@siteinabox/contracts/domain-migration"
import { splitDomain } from "@/lib/domains/normalize"
import { acquireValidatedProviderExport } from "./providerExport"
import type {
  AcquiredMigrationSource,
  MigrationSourcePublicEvidence,
} from "./types"
import { MigrationSourceAuthorizationError } from "./types"

const execFile = promisify(execFileCallback)

type AxfrOptions = {
  resolve4Impl?: typeof resolve4
  resolve6Impl?: typeof resolve6
  execFileImpl?: typeof execFile
  digPath?: string
  now?: () => Date
}

const canonical = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const disallowedAddresses = new BlockList()
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  disallowedAddresses.addSubnet(address, prefix, "ipv4")
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  disallowedAddresses.addSubnet(address, prefix, "ipv6")
}

const publicAddress = (value: string): boolean => {
  const family = isIP(value)
  if (family === 6 && value.toLowerCase().startsWith("::ffff:")) return false
  return family === 4
    ? !disallowedAddresses.check(value, "ipv4")
    : family === 6
      ? !disallowedAddresses.check(value, "ipv6")
      : false
}

const resolvePublicNameserver = async (
  nameserver: string,
  options?: AxfrOptions,
): Promise<string> => {
  if (isIP(nameserver)) {
    if (!publicAddress(nameserver)) throw new Error("AXFR nameserver must use a public IP.")
    return nameserver
  }
  const [ipv4, ipv6] = await Promise.all([
    (options?.resolve4Impl ?? resolve4)(nameserver).catch(() => []),
    (options?.resolve6Impl ?? resolve6)(nameserver).catch(() => []),
  ])
  const addresses = [...ipv4, ...ipv6]
  if (addresses.length === 0 || addresses.some((address) => !publicAddress(address))) {
    throw new Error("AXFR nameserver must resolve exclusively to public addresses.")
  }
  return addresses.sort()[0]!
}

const axfrOnce = async (input: {
  domain: string
  nameserverIp: string
  tsigName?: string | null
  tsigSecret?: string | null
  options?: AxfrOptions
}): Promise<string> => {
  const args = [
    `@${input.nameserverIp}`,
    input.domain,
    "AXFR",
    "+tcp",
    "+noall",
    "+answer",
    "+time=10",
    "+tries=1",
  ]
  let secretDirectory: string | null = null
  try {
    if (input.tsigName || input.tsigSecret) {
      if (!input.tsigName?.trim() || !input.tsigSecret?.trim()) {
        throw new Error("AXFR TSIG name and secret must be supplied together.")
      }
      if (!/^[A-Za-z0-9._-]{1,255}$/.test(input.tsigName)) {
        throw new Error("AXFR TSIG name is invalid.")
      }
      if (!/^[A-Za-z0-9+/=_-]{16,512}$/.test(input.tsigSecret)) {
        throw new Error("AXFR TSIG secret is invalid.")
      }
      secretDirectory = await mkdtemp(join(tmpdir(), "siab-axfr-"))
      const keyPath = join(secretDirectory, "tsig.key")
      await writeFile(
        keyPath,
        `key "${input.tsigName}" { algorithm hmac-sha256; secret "${input.tsigSecret}"; };\n`,
        { encoding: "utf8", mode: 0o600 },
      )
      args.push("-k", keyPath)
    }
    const result = await (input.options?.execFileImpl ?? execFile)(
      input.options?.digPath ?? "/usr/bin/dig",
      args,
      {
        timeout: 15_000,
        maxBuffer: 300 * 1_024,
        encoding: "utf8",
      },
    )
    const stdout = result.stdout
    if (!stdout.trim()) throw new Error("AXFR returned no authoritative records.")
    return stdout
  } catch (error) {
    const providerText = error && typeof error === "object"
      ? `${String((error as { stdout?: unknown }).stdout ?? "")}\n${
          String((error as { stderr?: unknown }).stderr ?? "")
        }`
      : ""
    if (/\b(REFUSED|NOTAUTH|Transfer failed)\b/i.test(providerText)) {
      throw new MigrationSourceAuthorizationError()
    }
    throw new Error("Authorized AXFR could not produce a complete zone.")
  } finally {
    if (secretDirectory) {
      await rm(secretDirectory, { recursive: true, force: true })
    }
  }
}

export async function acquireAuthorizedAxfr(input: {
  domain: string
  nameserver: string
  tsigName?: string | null
  tsigSecret?: string | null
  publicEvidence: MigrationSourcePublicEvidence
  options?: AxfrOptions
}): Promise<AcquiredMigrationSource> {
  const domain = splitDomain(input.domain).domain
  const nameserver = canonical(input.nameserver)
  const allowedNameservers = input.publicEvidence.authoritativeNameservers.map(canonical)
  if (!allowedNameservers.includes(nameserver)) {
    throw new Error("AXFR must use a current authoritative nameserver.")
  }
  const nameserverIp = await resolvePublicNameserver(nameserver, input.options)
  const run = () => axfrOnce({
    domain,
    nameserverIp,
    tsigName: input.tsigName,
    tsigSecret: input.tsigSecret,
    options: input.options,
  })
  const firstText = await run()
  const secondText = await run()
  const first = await acquireValidatedProviderExport({
    domain,
    provider: `axfr:${nameserver}`,
    bindText: firstText,
    publicEvidence: input.publicEvidence,
    now: input.options?.now?.(),
    requireAxfrEnvelope: true,
  })
  const second = await acquireValidatedProviderExport({
    domain,
    provider: `axfr:${nameserver}`,
    bindText: secondText,
    publicEvidence: input.publicEvidence,
    now: input.options?.now?.(),
    requireAxfrEnvelope: true,
  })
  if (
    domainMigrationSourceAuthorityHash(normalizeCompleteZone(first.zone)) !==
      domainMigrationSourceAuthorityHash(normalizeCompleteZone(second.zone))
  ) {
    throw new Error("AXFR source changed during the stable capture.")
  }
  return {
    mechanism: "authorized_axfr_v1",
    zone: {
      ...second.zone,
      authority: {
        ...second.zone.authority,
        mechanism: "authorized_axfr",
      },
    },
    refreshCredential: {
      kind: "authorized_axfr",
      nameserver,
      tsigName: input.tsigName?.trim() || null,
      tsigSecret: input.tsigSecret?.trim() || null,
    },
  }
}
