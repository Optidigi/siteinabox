import type { CollectionConfig } from "payload"

const setupTokenLifecycle = (context: unknown) =>
  Boolean(context && typeof context === "object" && "microsoftMailSetupTokenLifecycle" in context &&
    (context as { microsoftMailSetupTokenLifecycle?: unknown }).microsoftMailSetupTokenLifecycle === true)

export const MicrosoftMailSetupTokens: CollectionConfig = {
  slug: "microsoft-mail-setup-tokens",
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  hooks: {
    beforeChange: [({ req }) => {
      if (!setupTokenLifecycle(req.context)) throw new Error("Mailbox setup tokens are owned by the one-time delivery lifecycle.")
    }],
  },
  fields: [
    { name: "tokenHash", type: "text", required: true, unique: true, index: true },
    { name: "provisioningRun", type: "relationship", relationTo: "microsoft-mail-provisioning-runs", required: true, index: true },
    { name: "userPrincipalName", type: "text", required: true },
    { name: "encryptedPassword", type: "textarea", required: true, access: { read: () => false } },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "consumedAt", type: "date", index: true },
  ],
  timestamps: true,
}
