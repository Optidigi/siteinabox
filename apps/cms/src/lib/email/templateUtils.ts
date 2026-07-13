export const escapeEmailHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

/** Keep untrusted subject fragments on one header-safe line. */
export const cleanEmailHeaderText = (value: string) =>
  value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()
