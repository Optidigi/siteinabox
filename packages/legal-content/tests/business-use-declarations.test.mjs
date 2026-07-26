import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUSINESS_USE_DECLARATION_TEXT_NL,
  BUSINESS_USE_DECLARATION_VERSION,
  businessUseDeclarations,
  currentBusinessUseDeclaration,
  getBusinessUseDeclaration,
  validateBusinessUseDeclarations,
} from '../src/index.js'

const lockedDeclaration =
  'Ik sluit deze overeenkomst uitsluitend af voor mijn huidige of voorgenomen bedrijfs- of beroepsactiviteit en niet hoofdzakelijk voor privédoeleinden. Ik begrijp dat Siteinabox uitsluitend zakelijk levert.'

test('the current business-use declaration preserves the locked Dutch text and version', () => {
  assert.equal(BUSINESS_USE_DECLARATION_VERSION, 'business-use-declaration-2026-07-26.1')
  assert.equal(BUSINESS_USE_DECLARATION_TEXT_NL, lockedDeclaration)
  assert.deepEqual(currentBusinessUseDeclaration, {
    version: BUSINESS_USE_DECLARATION_VERSION,
    locale: 'nl',
    text: lockedDeclaration,
    audience: 'business_professional_only',
    effectiveAt: '2026-07-26T00:00:00+02:00',
  })
})

test('business-use declarations are versioned, immutable, and resolvable', () => {
  assert.equal(Object.isFrozen(businessUseDeclarations), true)
  assert.equal(Object.isFrozen(currentBusinessUseDeclaration), true)
  assert.equal(getBusinessUseDeclaration(), currentBusinessUseDeclaration)
  assert.equal(
    getBusinessUseDeclaration(BUSINESS_USE_DECLARATION_VERSION),
    currentBusinessUseDeclaration,
  )
  assert.throws(
    () => getBusinessUseDeclaration('business-use-declaration-unknown'),
    /Unknown business-use declaration/,
  )
  assert.deepEqual(validateBusinessUseDeclarations(), [])
})
