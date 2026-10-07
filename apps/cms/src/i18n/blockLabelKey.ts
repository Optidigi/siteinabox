import messages from "@/locales/en.json"

export const isBlockLabelKey = (value: string): value is keyof IntlMessages["editor"]["blockLabels"] =>
  Object.hasOwn(messages.editor.blockLabels, value)
