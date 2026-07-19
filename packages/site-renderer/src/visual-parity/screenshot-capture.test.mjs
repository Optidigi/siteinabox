import assert from "node:assert/strict"
import test from "node:test"

import { createPreparedPagePairAttempt, ScreenshotCaptureError, runScreenshotCaptureSequence } from "./screenshot-capture.mjs"

const protocolFailure = () => new ScreenshotCaptureError("upstream", new Error("Page.captureScreenshot: Unable to capture screenshot"))

test("a protocol capture failure retries once with a newly created page pair", async () => {
  const closedPairs = []
  const createdPairs = []
  const preparedPairs = []
  const result = await runScreenshotCaptureSequence({
    runAttempt: createPreparedPagePairAttempt({
      createPagePair: async (attempt) => {
        const pair = { reference: { attempt }, runtime: { attempt } }
        createdPairs.push(pair)
        return pair
      },
      prepareAndCapturePagePair: async (pair, attempt) => {
        preparedPairs.push(pair)
        if (attempt === 1) throw protocolFailure()
        return "captured"
      },
      closePagePair: async (pair) => { closedPairs.push(pair) },
    }),
    isBrowserConnected: () => true,
    relaunchBrowser: async () => assert.fail("connected browser must not relaunch"),
  })
  assert.equal(result, "captured")
  assert.equal(createdPairs.length, 2)
  assert.notEqual(createdPairs[0], createdPairs[1])
  assert.deepEqual(preparedPairs, createdPairs)
  assert.deepEqual(closedPairs, createdPairs)
})

test("Playwright's wrapped protocol capture failure is retryable", async () => {
  let attempts = 0
  await runScreenshotCaptureSequence({
    runAttempt: async (attempt) => {
      attempts += 1
      if (attempt === 1) {
        throw new ScreenshotCaptureError(
          "upstream",
          new Error("page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot"),
        )
      }
      return "captured"
    },
    isBrowserConnected: () => true,
    relaunchBrowser: async () => {},
  })
  assert.equal(attempts, 2)
})

test("a disconnected browser is relaunched at most once", async () => {
  let connected = false
  let relaunches = 0
  await runScreenshotCaptureSequence({
    runAttempt: async (attempt) => {
      if (attempt === 1) throw new ScreenshotCaptureError("vendored", new Error("Target page, context or browser has been closed"))
      return "captured"
    },
    isBrowserConnected: () => connected,
    relaunchBrowser: async () => { relaunches += 1; connected = true },
  })
  assert.equal(relaunches, 1)
})

test("a second capture failure is final", async () => {
  let attempts = 0
  await assert.rejects(runScreenshotCaptureSequence({
    runAttempt: async () => { attempts += 1; throw protocolFailure() },
    isBrowserConnected: () => true,
    relaunchBrowser: async () => {},
  }), /screenshot capture failed/)
  assert.equal(attempts, 2)
})

test("Playwright's screenshot timeout text is retryable", async () => {
  let attempts = 0
  await runScreenshotCaptureSequence({
    runAttempt: async (attempt) => {
      attempts += 1
      if (attempt === 1) throw new ScreenshotCaptureError("upstream", new Error("page.screenshot: Timeout 60000ms exceeded."))
      return "captured"
    },
    isBrowserConnected: () => true,
    relaunchBrowser: async () => {},
  })
  assert.equal(attempts, 2)
})

for (const mismatch of ["pixel mismatch", "dimension mismatch"]) {
  test(`${mismatch} receives no capture retry`, async () => {
    let attempts = 0
    await assert.rejects(runScreenshotCaptureSequence({
      runAttempt: async () => { attempts += 1; throw new Error(mismatch) },
      isBrowserConnected: () => true,
      relaunchBrowser: async () => {},
    }), new RegExp(mismatch))
    assert.equal(attempts, 1)
  })
}

test("successful capture behavior is unchanged", async () => {
  let attempts = 0
  const value = await runScreenshotCaptureSequence({
    runAttempt: async () => { attempts += 1; return ["reference", "runtime"] },
    isBrowserConnected: () => true,
    relaunchBrowser: async () => {},
  })
  assert.deepEqual(value, ["reference", "runtime"])
  assert.equal(attempts, 1)
})
