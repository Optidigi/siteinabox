import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import * as legalContent from '../src/index.js'
import * as consentApproval from '../src/consent-approval.js'

function declaredValueExports(declarationPath) {
  const declaration = readFileSync(new URL(declarationPath, import.meta.url), 'utf8')
  return [...declaration.matchAll(/^export (?:const|function) ([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1])
    .sort()
}

function runtimeValueExports(module) {
  return Object.keys(module).sort()
}

test('legal package root value exports match its declaration', () => {
  assert.deepEqual(
    runtimeValueExports(legalContent),
    declaredValueExports('../src/index.d.ts'),
  )
})

test('consent approval value exports match its declaration', () => {
  assert.deepEqual(
    runtimeValueExports(consentApproval),
    declaredValueExports('../src/consent-approval.d.ts'),
  )
})
