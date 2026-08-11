import assert from "node:assert/strict"
import test from "node:test"

import { extractWorkflowPaths, usesRootDockerContext } from "./workflow-path-parser.mjs"

test("extractWorkflowPaths accepts quoted paths and inline comments", () => {
  const source = `on:\n  push:\n    paths:\n      - "apps/site/**" # static site\n      - .dockerignore\n`
  assert.deepEqual(extractWorkflowPaths(source), ["apps/site/**", ".dockerignore"])
})

test("extractWorkflowPaths accepts an inline array", () => {
  assert.deepEqual(
    extractWorkflowPaths("on:\n  push:\n    paths: [apps/site/**, .dockerignore]\n"),
    ["apps/site/**", ".dockerignore"],
  )
})

test("extractWorkflowPaths ignores YAML block scalar contents", () => {
  assert.throws(
    () => extractWorkflowPaths(`jobs:\n  test:\n    steps:\n      - run: |\n          push:\n            paths:\n              - fake/**\n`),
    /could not find an on\.push\.paths block/,
  )
})

test("usesRootDockerContext only inspects docker build action inputs", () => {
  assert.equal(
    usesRootDockerContext(`steps:\n  - name: Build\n    uses: docker/build-push-action@v7\n    with:\n      context: \"./\" # repository root\n`),
    true,
  )
  assert.equal(
    usesRootDockerContext(`steps:\n  - name: Explain\n    run: |\n      context: .\n`),
    false,
  )
  assert.equal(
    usesRootDockerContext(`steps:\n  - uses: docker/build-push-action@v7\n    with:\n      context: apps/site\n  - uses: docker/build-push-action@v7\n    with:\n      context: .\n`),
    true,
  )
})
