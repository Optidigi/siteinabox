import type { Field } from "payload"

export const blockBaseFields = (anchorExample: string): Field[] => [
  {
    name: "anchor",
    type: "text",
    required: false,
    admin: {
      description: `Optional in-page anchor id (e.g. '${anchorExample}'). Renders as <section id>.`,
    },
  },
]
