import { validateLegalReleases } from '../src/index.js'
import { execFileSync } from 'node:child_process'

function findModifiedPublishedDocuments() {
  const baseRef = process.env.LEGAL_BASE_REF
  const args = baseRef
    ? ['diff', '--name-status', `${baseRef}...HEAD`, '--', 'packages/legal-content/documents']
    : process.env.CI
      ? ['diff', '--name-status', 'HEAD^', 'HEAD', '--', 'packages/legal-content/documents']
    : ['diff', '--name-status', '--', 'packages/legal-content/documents']

  try {
    return execFileSync('git', args, { cwd: new URL('../../..', import.meta.url), encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.startsWith('A\t'))
      .map((line) => `Published legal document changed in place (${line}). Add a new version instead.`)
  } catch {
    return []
  }
}

const errors = [...validateLegalReleases(), ...findModifiedPublishedDocuments()]

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log('Legal release registry is valid.')
}
