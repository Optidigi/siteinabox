export const BUSINESS_USE_DECLARATION_VERSION = 'business-use-declaration-2026-07-26.1'

export const BUSINESS_USE_DECLARATION_TEXT_NL =
  'Ik sluit deze overeenkomst uitsluitend af voor mijn huidige of voorgenomen bedrijfs- of beroepsactiviteit en niet hoofdzakelijk voor privédoeleinden. Ik begrijp dat Siteinabox uitsluitend zakelijk levert.'

export const businessUseDeclarations = Object.freeze([
  Object.freeze({
    version: BUSINESS_USE_DECLARATION_VERSION,
    locale: 'nl',
    text: BUSINESS_USE_DECLARATION_TEXT_NL,
    audience: 'business_professional_only',
    effectiveAt: '2026-07-26T00:00:00+02:00',
  }),
])

export const currentBusinessUseDeclaration = businessUseDeclarations[0]

export function getBusinessUseDeclaration(version = BUSINESS_USE_DECLARATION_VERSION) {
  const declaration = businessUseDeclarations.find((entry) => entry.version === version)
  if (!declaration) throw new Error(`Unknown business-use declaration: ${version}`)
  return declaration
}

export function validateBusinessUseDeclarations() {
  const errors = []
  const versions = new Set()

  for (const declaration of businessUseDeclarations) {
    if (versions.has(declaration.version)) {
      errors.push(`Duplicate business-use declaration version: ${declaration.version}`)
    }
    versions.add(declaration.version)
    if (!/^business-use-declaration-\d{4}-\d{2}-\d{2}\.\d+$/.test(declaration.version)) {
      errors.push(`Invalid business-use declaration version: ${declaration.version}`)
    }
    if (declaration.locale !== 'nl') {
      errors.push(`Unsupported business-use declaration locale: ${declaration.locale}`)
    }
    if (declaration.audience !== 'business_professional_only') {
      errors.push(`Invalid business-use declaration audience: ${declaration.audience}`)
    }
    if (!declaration.text.trim()) {
      errors.push(`Empty business-use declaration text: ${declaration.version}`)
    }
    if (Number.isNaN(new Date(declaration.effectiveAt).valueOf())) {
      errors.push(`Invalid business-use declaration effectiveAt: ${declaration.version}`)
    }
  }

  return errors
}
