import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

import { migrationSourceMechanisms } from "@siteinabox/contracts/domain-migration"

const lifecycleEnabled = (
  args: Parameters<CollectionBeforeChangeHook>[0],
): boolean =>
  args.req?.context?.checkoutProgressDraftLifecycle === true ||
  args.context?.checkoutProgressDraftLifecycle === true

export const protectCheckoutProgressDraft: CollectionBeforeChangeHook = (args) => {
  if (!lifecycleEnabled(args)) {
    throw new Error(
      "Checkout progress drafts are mutable only through the reviewed preview-grant lifecycle.",
    )
  }
  if (args.operation !== "update") return args.data

  const allowed = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "previewAccessGrant",
    "tenant",
    "generationRun",
    "domainMode",
    "domainQuery",
    "selectedDomain",
    "decision",
    "billingPeriod",
    "migrationSourceMechanism",
    "profileDraft",
    "expiresAt",
  ])
  const invalid = Object.keys(args.data ?? {}).find((field) => !allowed.has(field))
  if (invalid) {
    console.error(`Immutable field error in CheckoutProgressDrafts: ${invalid} was provided. args.data:`, args.data)
    throw new Error(`Checkout progress draft field "${invalid}" is immutable.`)
  }
  return args.data
}

export const validateCheckoutProgressDraft: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data
  const current = {
    ...(originalDoc as Record<string, unknown> | undefined),
    ...data,
  }
  if (!current.previewAccessGrant || !current.tenant || !current.generationRun) {
    throw new Error("Checkout progress draft requires its preview-grant authority.")
  }
  if (!current.expiresAt || Number.isNaN(new Date(String(current.expiresAt)).getTime())) {
    throw new Error("Checkout progress draft requires a valid expiration time.")
  }
  if (
    current.domainMode === "new_registration" &&
    current.migrationSourceMechanism != null
  ) {
    throw new Error("New domain registration progress cannot retain a migration source.")
  }
  return data
}

export const CheckoutProgressDrafts: CollectionConfig = {
  slug: "checkout-progress-drafts",
  lockDocuments: false,
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [validateCheckoutProgressDraft],
    beforeChange: [protectCheckoutProgressDraft],
  },
  admin: { hidden: true },
  fields: [
    {
      name: "previewAccessGrant",
      type: "relationship",
      relationTo: "preview-access-grants",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
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
      name: "domainMode",
      type: "select",
      required: true,
      defaultValue: "new_registration",
      options: [
        { label: "New registration", value: "new_registration" },
        { label: "Existing domain", value: "existing_domain" },
      ],
    },
    { name: "domainQuery", type: "text", defaultValue: "" },
    { name: "selectedDomain", type: "text", index: true },
    {
      name: "decision",
      type: "select",
      required: true,
      defaultValue: "domain",
      options: [
        { label: "Domain", value: "domain" },
        { label: "Review", value: "review" },
      ],
    },
    {
      name: "billingPeriod",
      type: "select",
      required: true,
      defaultValue: "annual",
      options: [
        { label: "Annual", value: "annual" },
        { label: "Monthly", value: "monthly" },
      ],
    },
    {
      name: "migrationSourceMechanism",
      type: "select",
      options: migrationSourceMechanisms.map((value) => ({ label: value, value })),
    },
    {
      name: "profileDraft",
      type: "json",
      access: { read: () => false },
      admin: { hidden: true },
    },
    { name: "expiresAt", type: "date", required: true, index: true },
  ],
}
