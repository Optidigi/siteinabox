export class ScreenshotCaptureError extends Error {
  constructor(side, cause) {
    super(`${side} screenshot capture failed`, { cause })
    this.name = "ScreenshotCaptureError"
    this.side = side
  }
}

const errorText = (error) => {
  const messages = []
  for (let current = error; current; current = current.cause) messages.push(String(current?.message ?? current))
  return messages.join("\n")
}

export function classifyScreenshotCaptureError(error) {
  if (!(error instanceof ScreenshotCaptureError)) return null
  const message = errorText(error)
  if (/Page\.captureScreenshot:\s*Unable to capture screenshot/i.test(message)) return "capture-protocol"
  if (/screenshot[^\n]*(?:timed?\s*out|timeout)|TimeoutError[^\n]*screenshot/i.test(message)) return "capture-timeout"
  if (/page[^\n]*(?:crashed|has been closed|is closed)|Target page, context or browser has been closed/i.test(message)) return "page-unavailable"
  if (/browser[^\n]*(?:disconnected|has been closed|is closed)/i.test(message)) return "browser-disconnected"
  return null
}

export function createPreparedPagePairAttempt({
  closePagePair,
  createPagePair,
  prepareAndCapturePagePair,
}) {
  return async (attempt) => {
    const pagePair = await createPagePair(attempt)
    try {
      return await prepareAndCapturePagePair(pagePair, attempt)
    } finally {
      await closePagePair(pagePair, attempt)
    }
  }
}

export async function runScreenshotCaptureSequence({
  runAttempt,
  isBrowserConnected,
  relaunchBrowser,
  onFailure = async () => {},
}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await runAttempt(attempt)
    } catch (error) {
      const classification = classifyScreenshotCaptureError(error)
      if (classification === null) throw error
      const final = attempt === 2
      const browserConnected = isBrowserConnected()
      await onFailure({ attempt, browserConnected, classification, error, final })
      if (final) throw error
      if (!browserConnected) await relaunchBrowser()
    }
  }
  throw new Error("unreachable screenshot capture state")
}
