export function parseOsRelease(text) {
  const values = Object.fromEntries(text.trim().split("\n").filter((line) => line.includes("=")).map((line) => {
    const index = line.indexOf("=")
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")]
  }))
  return { os: values.ID, version: values.VERSION_ID }
}
