import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

const lifecycleEnabled = (
  args: Parameters<CollectionBeforeChangeHook>[0],
): boolean =>
  args.req?.context?.migrationSourceAuthorizationLifecycle === true ||
  args.context?.migrationSourceAuthorizationLifecycle === true

export const protectMigrationSourceAuthorization: CollectionBeforeChangeHook = (args) => {
  if (args.operation !== "update") return args.data
  if (!lifecycleEnabled(args)) {
    throw new Error(
      "Migration source authorizations are mutable only through the reviewed OAuth lifecycle.",
    )
  }
  const allowed = new Set([
    "state",
    "encryptedAuthority",
    "authorizedAt",
    "revokedAt",
    "expiresAt",
    "updatedAt",
  ])
  const invalid = Object.keys(args.data ?? {}).find((field) =>
    !allowed.has(field))
  if (invalid) {
    throw new Error(
      `Migration source authorization field "${invalid}" is immutable.`,
    )
  }
  return args.data
}

export const validateMigrationSourceAuthorization: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data
  const current = {
    ...(originalDoc as Record<string, unknown> | undefined),
    ...data,
  }
  const state = String(current.state ?? "")
  if (state === "pending" && !current.encryptedAuthority) {
    throw new Error("Pending OAuth authorization requires protected PKCE state.")
  }
  if (
    ["authorized", "attached", "refreshing", "revocation_pending"].includes(state) &&
    !current.encryptedAuthority
  ) {
    throw new Error("Authorized OAuth source requires encrypted provider authority.")
  }
  if (["revoked", "expired"].includes(state) && current.encryptedAuthority) {
    throw new Error("Terminal OAuth source authorization cannot retain credentials.")
  }
  if (
    ["pending", "authorized", "attached", "refreshing", "revocation_pending"].includes(
      state,
    ) &&
    (!current.generationRun || !current.tenant)
  ) {
    throw new Error("Live OAuth source authorization requires its checkout authority.")
  }
  return data
}

export const MigrationSourceAuthorizations: CollectionConfig = {
  slug: "migration-source-authorizations",
  lockDocuments: false,
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [validateMigrationSourceAuthorization],
    beforeChange: [protectMigrationSourceAuthorization],
  },
  admin: { hidden: true },
  fields: [
    {
      name: "authorizationKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "stateDigest",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "browserBindingDigest",
      type: "text",
      required: true,
    },
    {
      name: "generationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      index: true,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      index: true,
    },
    { name: "clientSlug", type: "text", required: true, index: true },
    {
      name: "customerEmailDigest",
      type: "text",
      required: true,
      index: true,
      admin: { hidden: true },
    },
    { name: "domainNameAscii", type: "text", required: true, index: true },
    {
      name: "encryptedAuthority",
      type: "textarea",
      access: { read: () => false },
      admin: { hidden: true },
    },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Attached", value: "attached" },
        { label: "Refreshing", value: "refreshing" },
        { label: "Revocation pending", value: "revocation_pending" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      index: true,
    },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "authorizedAt", type: "date" },
    { name: "revokedAt", type: "date" },
    { name: "updatedAt", type: "date", required: true, index: true },
  ],
}
