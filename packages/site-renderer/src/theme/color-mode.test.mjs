import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  COLOR_MODE_BOOTSTRAP_SCRIPT,
  COLOR_MODE_STORAGE_KEY,
  readStoredColorMode,
  resolveColorMode,
  ThemeCanvas,
  writeStoredColorMode,
} from "./index.tsx"

test("color mode has one deterministic precedence rule", () => {
  assert.equal(resolveColorMode("light", null, true), "light")
  assert.equal(resolveColorMode("dark", null, false), "dark")
  assert.equal(resolveColorMode("system", null, false), "light")
  assert.equal(resolveColorMode("system", null, true), "dark")
  assert.equal(resolveColorMode("light", "dark", false), "dark")
  assert.equal(resolveColorMode("dark", "light", true), "light")
  assert.equal(resolveColorMode("system", "invalid", true), "dark")
})

test("storage failures cannot prevent a site from rendering", () => {
  const unavailable = {
    getItem() { throw new Error("blocked") },
    setItem() { throw new Error("blocked") },
  }
  assert.equal(readStoredColorMode(unavailable), null)
  assert.equal(writeStoredColorMode(unavailable, "dark"), false)
  assert.equal(readStoredColorMode({ getItem: () => "invalid" }), null)
})

test("pre-paint bootstrap is standalone and uses the canonical state", () => {
  assert.match(COLOR_MODE_BOOTSTRAP_SCRIPT, new RegExp(COLOR_MODE_STORAGE_KEY))
  assert.match(COLOR_MODE_BOOTSTRAP_SCRIPT, /prefers-color-scheme: dark/)
  assert.match(COLOR_MODE_BOOTSTRAP_SCRIPT, /siabColorMode/)
  assert.match(COLOR_MODE_BOOTSTRAP_SCRIPT, /rtMode/)
})

test("theme canvas exposes configured and server-resolved modes", () => {
  const system = renderToStaticMarkup(React.createElement(ThemeCanvas, {
    theme: { version: 3, appearance: { mode: "system" } },
  }))
  const dark = renderToStaticMarkup(React.createElement(ThemeCanvas, {
    theme: { version: 3, appearance: { mode: "dark" } },
  }))
  assert.match(system, /data-rt-mode="light"/)
  assert.match(system, /data-siab-theme-mode="system"/)
  assert.match(dark, /data-rt-mode="dark"/)
  assert.match(dark, /data-siab-theme-mode="dark"/)
})
