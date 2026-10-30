import { z } from "zod"
import { domainToASCII } from "node:url"
import { createHash } from "node:crypto"

export const MICROSOFT_MAIL_PRODUCT = "m365-business-basic-eea-no-teams" as const

const localPartSchema = z.string()
  .trim()
  .min(1)
  .max(64)
  // Conservative UPN local-part subset. Graph has a larger character set,
  // but the operator flow does not need punctuation-heavy identifiers.
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/)

const mailboxUserSchema = z.object({
  localPart: localPartSchema,
  displayName: z.string().trim().min(1).max(256),
  setupEmail: z.string().trim().email().max(254),
}).strict()

const customerProfileSchema = z.object({
  companyName: z.string().trim().min(2).max(256),
  website: z.string().trim().url().max(512).refine(value => /^https?:\/\//i.test(value)),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,39}$/),
  address: z.object({
    street: z.string().trim().min(1).max(256),
    city: z.string().trim().min(1).max(128),
    postalCode: z.string().trim().min(1).max(32),
    country: z.string().trim().regex(/^[A-Za-z]{2}$/),
  }).strict(),
  registrationNumber: z.string().trim().max(64).optional().default(""),
  primaryContact: z.object({
    firstName: z.string().trim().min(1).max(128),
    lastName: z.string().trim().min(1).max(128),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(3).max(40),
  }).strict(),
}).strict()

const inputSchema = z.object({
  tenantId: z.unknown(),
  domain: z.unknown(),
  tenantPrefix: z.unknown().optional(),
  customer: customerProfileSchema,
  mailboxUsers: z.unknown(),
  infoSharedMailbox: z.unknown().optional(),
  retainInfoForward: z.unknown().optional(),
  infoForwardTo: z.unknown().optional(),
  infoAliasTarget: z.unknown().optional(),
}).strict()

export type MicrosoftMailProvisioningUser = {
  localPart: string
  displayName: string
  userPrincipalName: string
  setupEmail: string
}

export type MicrosoftMailProvisioningRequest = {
  tenantId: number
  domain: string
  tenantPrefix: string
  customer: z.infer<typeof customerProfileSchema>
  product: typeof MICROSOFT_MAIL_PRODUCT
  commitment: "annual"
  billing: "annual"
  mailboxUsers: MicrosoftMailProvisioningUser[]
  quantity: number
  infoSharedMailbox?: boolean
  retainInfoForward: boolean
  infoForwardTo: string | null
  infoAliasTarget: string | null
}

/** Commercial intent excludes the ephemeral setup delivery addresses. */
export function mailProvisioningIntent(request: MicrosoftMailProvisioningRequest) {
  const { primaryContact: _operationsContact, ...customer } = request.customer
  return { tenantId: request.tenantId, domain: request.domain, tenantPrefix: request.tenantPrefix, product: request.product,
    commitment: request.commitment, billing: request.billing, customer,
    mailboxes: request.mailboxUsers.map(user => ({ address: user.userPrincipalName, displayName: user.displayName })).sort((a,b) => a.address.localeCompare(b.address)),
    ...(request.infoSharedMailbox ? { infoSharedMailbox: true } : {}), infoAliasTarget: request.infoAliasTarget }
}
export function mailProvisioningIntentHash(request: MicrosoftMailProvisioningRequest) {
  return createHash("sha256").update(JSON.stringify(mailProvisioningIntent(request))).digest("hex")
}

export type MicrosoftMailProvisioningIssueCode =
  | "invalid_tenant"
  | "invalid_domain"
  | "empty_mailbox_list"
  | "invalid_mailbox_user"
  | "duplicate_mailbox"
  | "invalid_tenant_prefix"
  | "missing_info_forward_target"
  | "invalid_info_alias_target"

export type MicrosoftMailProvisioningIssue = {
  code: MicrosoftMailProvisioningIssueCode
  index?: number
  message: string
}

export type ParseMicrosoftMailProvisioningRequestResult =
  | { ok: true; value: MicrosoftMailProvisioningRequest }
  | { ok: false; issues: MicrosoftMailProvisioningIssue[] }

const normalizeMailboxDomain = (value: string): string | null => {
  const raw = value.trim().toLowerCase().replace(/\.$/, "")
  if (!raw || /[,/\\@?#\s:]/.test(raw)) return null
  const domain = domainToASCII(raw)
  if (!domain || domain.length > 253) return null
  const labels = domain.split(".")
  if (labels.length < 2 || !/[a-z]/.test(labels.at(-1) ?? "")) return null
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ? domain
    : null
}

/**
 * Normalizes the internal operator form once, before any provider call. User
 * addresses are derived from the selected domain; the setup address is only a
 * Siteinabox delivery destination and is never copied to Microsoft user data.
 */
export function parseMicrosoftMailProvisioningRequest(
  input: unknown,
): ParseMicrosoftMailProvisioningRequestResult {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "invalid_mailbox_user", message: "The provisioning request has an invalid shape." }] }
  }

  const issues: MicrosoftMailProvisioningIssue[] = []
  const tenantId = Number(parsed.data.tenantId)
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
    issues.push({ code: "invalid_tenant", message: "Select a valid Siteinabox customer." })
  }
  const domain = typeof parsed.data.domain === "string"
    ? normalizeMailboxDomain(parsed.data.domain)
    : null
  if (!domain) issues.push({ code: "invalid_domain", message: "Enter a valid customer email domain." })
  const requestedPrefix = typeof parsed.data.tenantPrefix === "string"
    ? parsed.data.tenantPrefix.trim().toLowerCase()
    : domain?.split(".")[0] ?? ""
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(requestedPrefix)) {
    issues.push({ code: "invalid_tenant_prefix", message: "Enter a valid Microsoft tenant prefix." })
  }
  const users = Array.isArray(parsed.data.mailboxUsers) ? parsed.data.mailboxUsers : []
  if (users.length === 0) issues.push({ code: "empty_mailbox_list", message: "Add at least one mailbox user." })
  if (users.length > 300) {
    issues.push({ code: "invalid_mailbox_user", message: "Business Basic supports up to 300 mailbox users." })
  }
  const retainInfoForward = parsed.data.retainInfoForward !== false
  const infoForwardTo = typeof parsed.data.infoForwardTo === "string"
    ? parsed.data.infoForwardTo.trim().toLowerCase()
    : ""
  const infoAliasTarget = typeof parsed.data.infoAliasTarget === "string"
    ? parsed.data.infoAliasTarget.trim().toLowerCase()
    : ""
  if (parsed.data.infoSharedMailbox === true && (retainInfoForward || infoAliasTarget)) issues.push({ code: "invalid_mailbox_user", message: "A shared info inbox cannot also be an alias, forwarding address or licensed user." })
  if (retainInfoForward && !z.string().email().safeParse(infoForwardTo).success) {
    issues.push({ code: "missing_info_forward_target", message: "Enter the destination that should keep receiving info@ mail." })
  }
  if (issues.length) return { ok: false, issues }

  const seen = new Set<string>()
  const mailboxUsers: MicrosoftMailProvisioningUser[] = []
  users.forEach((entry, index) => {
    const entryParsed = mailboxUserSchema.safeParse(entry)
    const rawLocalPart = entry && typeof entry === "object" && "localPart" in entry
      ? (entry as { localPart?: unknown }).localPart
      : undefined
    const localPartParsed = localPartSchema.safeParse(rawLocalPart)
    const userPrincipalName = localPartParsed.success && domain
      ? `${localPartParsed.data.toLowerCase()}@${domain}`
      : null
    if (!entryParsed.success) {
      issues.push({
        code: "invalid_mailbox_user",
        index,
        message: "Each mailbox needs a valid local part, display name, and reachable setup email.",
      })
    }
    if (!userPrincipalName || !domain) return
    if (userPrincipalName.length > 254) {
      issues.push({ code: "invalid_mailbox_user", index, message: "This mailbox address is too long." })
      return
    }
    if (seen.has(userPrincipalName)) {
      issues.push({
        code: "duplicate_mailbox",
        index,
        message: `Mailbox ${userPrincipalName} appears more than once.`,
      })
      return
    }
    seen.add(userPrincipalName)
    if (!entryParsed.success) return
    mailboxUsers.push({
      localPart: entryParsed.data.localPart.toLowerCase(),
      displayName: entryParsed.data.displayName,
      userPrincipalName: userPrincipalName!,
      setupEmail: entryParsed.data.setupEmail,
    })
  })
  for (const [index, user] of mailboxUsers.entries()) {
    if (seen.has(user.setupEmail.trim().toLowerCase())) issues.push({ code: "invalid_mailbox_user", index, message: "Use an existing email address for the first sign-in link." })
  }
  if (parsed.data.infoSharedMailbox === true && mailboxUsers.some(user => user.localPart === "info")) issues.push({ code: "invalid_mailbox_user", message: "The shared info inbox cannot also be a licensed user." })
  if (infoAliasTarget && (!mailboxUsers.some((user) => user.userPrincipalName === infoAliasTarget) || infoAliasTarget === `info@${domain}`)) {
    issues.push({ code: "invalid_info_alias_target", message: "Choose one of the requested mailboxes for the info@ address." })
  }
  if (issues.length) return { ok: false, issues }

  return {
    ok: true,
    value: {
      tenantId,
      domain: domain!,
      tenantPrefix: requestedPrefix,
      customer: parsed.data.customer,
      product: MICROSOFT_MAIL_PRODUCT,
      commitment: "annual",
      billing: "annual",
      mailboxUsers,
      quantity: mailboxUsers.length,
      ...(parsed.data.infoSharedMailbox === true ? { infoSharedMailbox: true } : {}),
      retainInfoForward,
      infoForwardTo: retainInfoForward ? infoForwardTo : null,
      infoAliasTarget: infoAliasTarget || null,
    },
  }
}

/** Read the persisted normalized shape without accepting derived fields in raw forms. */
export function parseStoredMicrosoftMailProvisioningRequest(input: unknown): ParseMicrosoftMailProvisioningRequestResult {
  const stored = inputSchema.extend({
    tenantId: z.number().int().positive(), domain: z.string(), tenantPrefix: z.string(),
    infoSharedMailbox: z.boolean().optional(), retainInfoForward: z.boolean(),
    product: z.literal(MICROSOFT_MAIL_PRODUCT), commitment: z.literal("annual"), billing: z.literal("annual"),
    quantity: z.number().int().min(1).max(300),
    mailboxUsers: z.array(mailboxUserSchema.extend({ userPrincipalName: z.string().email() }).strict()),
    infoForwardTo: z.string().nullable(), infoAliasTarget: z.string().nullable(),
  }).safeParse(input)
  const invalid: ParseMicrosoftMailProvisioningRequestResult = { ok: false, issues: [{ code: "invalid_mailbox_user", message: "The saved provisioning request is inconsistent." }] }
  if (!stored.success) return invalid
  const request = stored.data
  const parsed = parseMicrosoftMailProvisioningRequest({
    tenantId: request.tenantId, domain: request.domain, tenantPrefix: request.tenantPrefix, customer: request.customer,
    mailboxUsers: request.mailboxUsers.map(user => ({ localPart: user.localPart, displayName: user.displayName, setupEmail: user.setupEmail })),
    infoSharedMailbox: request.infoSharedMailbox, retainInfoForward: request.retainInfoForward,
    infoForwardTo: request.infoForwardTo ?? "", infoAliasTarget: request.infoAliasTarget ?? "",
  })
  if (!parsed.ok) return parsed
  if (request.quantity !== parsed.value.quantity || request.mailboxUsers.some((user, index) => user.userPrincipalName !== parsed.value.mailboxUsers[index]?.userPrincipalName)) return invalid
  return parsed
}
