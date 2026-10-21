/** Preferences are not credentials and must not corrupt binary trace resources. */
export function cookieCredentials(cookies) {
  const values = new Set()
  for (const cookie of cookies) {
    if (!/token|session/i.test(cookie.name) || cookie.value.length < 16) continue
    values.add(cookie.value)
    let decoded = cookie.value
    try { decoded = decodeURIComponent(cookie.value) } catch { /* Retain the raw malformed value for redaction. */ }
    values.add(decoded)
    if (cookie.name.endsWith(".session_token") && decoded.split(".")[0].length >= 16) values.add(decoded.split(".")[0])
  }
  return [...values]
}
