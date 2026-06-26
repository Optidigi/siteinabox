import type { Field } from "payload"

export const blockBaseFields = (anchorExample: string): Field[] => [
  {
    name: "variant",
    type: "text",
    admin: {
      description: "Approved renderer variant short name.",
    },
  },
  {
    name: "tokens",
    type: "json",
    admin: {
      description: "Optional block-level design tokens consumed by the renderer.",
    },
  },
  {
    name: "metadata",
    type: "json",
    admin: {
      description: "Optional structured metadata for this block instance.",
    },
  },
  {
    name: "anchor",
    type: "text",
    required: false,
    admin: {
      description: `Optional in-page anchor id (e.g. '${anchorExample}'). Renders as <section id>.`,
    },
  },
]
