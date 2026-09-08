import type { CollectionConfig } from "payload"
import { adminText } from "@/lib/payloadAdminI18n"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const BuilderSessions: CollectionConfig = {
  slug: "builder-sessions",
  labels: {
    singular: { en: "Builder session", nl: "Builder-sessie" },
    plural: { en: "Builder sessions", nl: "Builder-sessies" },
  },
  lockDocuments: false,
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "customerEmail",
    defaultColumns: ["customerEmail", "displayName", "clientSlug", "updatedAt"],
    description: adminText(
      "Persisted self-serve builder thread, facts, and legal acceptance keyed by customer email.",
      "Opgeslagen self-serve builder-gesprek, feiten en juridische akkoorden, gekoppeld aan het klant-e-mailadres.",
    ),
  },
  fields: [
    { name: "customerEmail", type: "email", required: true, unique: true, index: true },
    { name: "displayName", type: "text", required: true },
    { name: "contactPhone", type: "text", defaultValue: "" },
    {
      name: "legal",
      type: "json",
      required: true,
      admin: { description: adminText("Terms and business-use acceptance captured at register.", "Voorwaarden en zakelijk gebruik, vastgelegd bij registratie.") },
    },
    {
      name: "messages",
      type: "json",
      required: true,
      admin: { description: adminText("Chat transcript restored across devices.", "Chattranscript dat op andere apparaten wordt hersteld.") },
    },
    { name: "facts", type: "json" },
    {
      name: "clientSlug",
      type: "text",
      index: true,
      admin: { description: adminText("Preview slug after first generate; empty until a tenant exists.", "Preview-slug na de eerste generate; leeg tot er een tenant is.") },
    },
  ],
}
