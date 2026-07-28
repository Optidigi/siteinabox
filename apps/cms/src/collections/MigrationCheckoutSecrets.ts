import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

const lifecycleContext = (
  args: Parameters<CollectionBeforeChangeHook>[0],
): boolean =>
  args.req?.context?.migrationCheckoutSecretLifecycle === true ||
  args.context?.migrationCheckoutSecretLifecycle === true

const protectMigrationCheckoutSecret: CollectionBeforeChangeHook = (args) => {
  if (args.operation !== "update") return args.data
  if (!lifecycleContext(args)) {
    throw new Error(
      "Migration checkout secrets are mutable only through the reviewed secret lifecycle.",
    )
  }
  const allowed = new Set([
    "encryptedInput",
    "state",
    "order",
    "expiresAt",
    "consumedAt",
    "updatedAt",
  ])
  const invalid = Object.keys(args.data ?? {}).find((field) =>
    !allowed.has(field))
  if (invalid) {
    throw new Error(`Migration checkout secret field "${invalid}" is immutable.`)
  }
  return args.data
}

const validateMigrationCheckoutSecret: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data
  const current = {
    ...(originalDoc as Record<string, unknown> | undefined),
    ...data,
  }
  const state = current.state
  if (
    ["pending_order", "attached"].includes(String(state)) &&
    !current.encryptedInput
  ) {
    throw new Error("Active migration checkout secret requires encrypted input.")
  }
  if (
    ["consumed", "expired"].includes(String(state)) &&
    current.encryptedInput
  ) {
    throw new Error("Terminal migration checkout secret cannot retain encrypted input.")
  }
  if (
    ["attached", "consumed"].includes(String(state)) &&
    !current.order
  ) {
    throw new Error("Attached migration checkout secret requires an order.")
  }
  return data
}

export const MigrationCheckoutSecrets: CollectionConfig = {
  slug: "migration-checkout-secrets",
  lockDocuments: false,
  labels: {
    singular: {
      en: "Migration checkout secret",
      nl: "Migratiecheckoutgeheim",
    },
    plural: {
      en: "Migration checkout secrets",
      nl: "Migratiecheckoutgeheimen",
    },
  },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [validateMigrationCheckoutSecret],
    beforeChange: [protectMigrationCheckoutSecret],
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: "secretKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "generationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      required: true,
      index: true,
    },
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
      unique: true,
      index: true,
    },
    { name: "domainNameAscii", type: "text", required: true, index: true },
    {
      name: "sourceZoneHash",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "encryptedInput",
      type: "textarea",
      access: { read: () => false },
      admin: { hidden: true },
    },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "pending_order",
      options: [
        { label: { en: "Pending order", nl: "Wacht op order" }, value: "pending_order" },
        { label: { en: "Attached", nl: "Gekoppeld" }, value: "attached" },
        { label: { en: "Consumed", nl: "Verbruikt" }, value: "consumed" },
        { label: { en: "Expired", nl: "Verlopen" }, value: "expired" },
      ],
      index: true,
    },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "consumedAt", type: "date", index: true },
    { name: "createdAt", type: "date", required: true, index: true },
    { name: "updatedAt", type: "date", required: true, index: true },
  ],
}
