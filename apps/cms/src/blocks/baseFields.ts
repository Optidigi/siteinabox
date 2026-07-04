import type { Field } from "payload"

export const blockBaseFields = (anchorExample: string): Field[] => [
  {
    name: "designVariant",
    type: "text",
    admin: {
      description: "Approved renderer design variant.",
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
