import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ESLint } from 'eslint'
import config from '../eslint.config.mjs'
import { COLOR_MODE_BOOTSTRAP_SCRIPT } from '../packages/site-renderer/src/theme/color-mode.ts'

const execFileAsync = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function fixtureProject(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'siab-astro-type-boundaries-'))
  const app = path.join(directory, 'apps/landing')
  await mkdir(path.join(app, 'src/pages'), { recursive: true })
  await symlink(path.join(root, 'apps/landing/node_modules'), path.join(app, 'node_modules'), 'dir')
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'astro-type-contract-fixture', type: 'module' }))
  await writeFile(path.join(app, 'tsconfig.json'), JSON.stringify({ extends: 'astro/tsconfigs/strict', include: ['.astro/types.d.ts', '**/*'], exclude: ['dist'] }))
  try { return await run({ directory, app }) } finally { await rm(directory, { recursive: true, force: true }) }
}

const isolatedConfig = (directory) => config.map((entry) => entry.languageOptions?.parserOptions ? {
  ...entry,
  languageOptions: {
    ...entry.languageOptions,
    parserOptions: { ...entry.languageOptions.parserOptions, tsconfigRootDir: directory },
  },
} : entry)

test('required unsafe rules inspect Astro frontmatter, template expressions and client scripts', { timeout: 60_000 }, async () => fixtureProject(async ({ directory, app }) => {
  const file = path.join(app, 'src/pages/unsafe-json.astro')
  await writeFile(file, '---\nconst front = JSON.parse("{}");\n---\n<div>{front.value}</div>\n<script>\nconst client = JSON.parse("{}");\nconsole.log(client.value);\n</script>\n')
  const eslint = new ESLint({ cwd: directory, overrideConfigFile: true, overrideConfig: isolatedConfig(directory) })
  const [result] = await eslint.lintFiles([file])
  assert(result)
  assert.equal(result.messages.filter((message) => message.fatal).length, 0, JSON.stringify(result.messages))
  for (const [line, ruleId] of [[2, '@typescript-eslint/no-unsafe-assignment'], [4, '@typescript-eslint/no-unsafe-member-access'], [6, '@typescript-eslint/no-unsafe-assignment'], [7, '@typescript-eslint/no-unsafe-member-access']]) {
    assert(result.messages.some((message) => message.line === line && message.ruleId === ruleId), `missing ${ruleId} at source line ${line}: ${JSON.stringify(result.messages)}`)
  }
  assert(result.errorCount >= 4)
}))

test('required Astro compiler rejects an actual broken component in an isolated project', { timeout: 60_000 }, async () => fixtureProject(async ({ app }) => {
  await writeFile(path.join(app, 'src/pages/broken-compiler.astro'), '---\nconst count: number = "broken";\n---\n<p>{count}</p>\n')
  const cli = path.join(root, 'apps/landing/node_modules/astro/bin/astro.mjs')
  let failure
  try {
    await execFileAsync(process.execPath, [cli, 'check'], { cwd: app, env: { ...process.env, NO_COLOR: '1', ASTRO_TELEMETRY_DISABLED: '1' }, timeout: 45_000 })
  } catch (error) { failure = error }
  assert(failure, 'the actual Astro compiler accepted the invalid number assignment')
  const output = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`
  assert.equal(failure.code, 1, output)
  assert.match(output, /Type 'string' is not assignable to type 'number'/)
  assert.match(output, /broken-compiler\.astro/)
}))


test('inline client scripts receive compiler diagnostics as well as unsafe rules', { timeout: 60_000 }, async () => fixtureProject(async ({ directory, app }) => {
  const file = path.join(app, 'src/pages/broken-inline.astro')
  await writeFile(file, '<main />\n<script is:inline>\nconst node = document.querySelector("main");\nif (node) node.methodThatDoesNotExist();\n</script>\n')
  const eslint = new ESLint({ cwd: directory, overrideConfigFile: true, overrideConfig: isolatedConfig(directory) })
  const [result] = await eslint.lintFiles([file])
  assert(result)
  assert(result.messages.some((message) => message.line === 4 && /methodThatDoesNotExist/.test(message.message)), JSON.stringify(result.messages))
  assert(result.errorCount > 0)
}))

// set:html contains no Astro child text, so exercise the actual shared emitted
// bootstrap through the same executable-body compiler and unsafe-rule path.
test('the emitted renderer bootstrap is checked as executed source', { timeout: 60_000 }, async () => fixtureProject(async ({ directory, app }) => {
  const file = path.join(app, 'src/pages/emitted-bootstrap.astro')
  const eslint = new ESLint({ cwd: directory, overrideConfigFile: true, overrideConfig: isolatedConfig(directory) })
  await writeFile(file, `<script is:inline>\n${COLOR_MODE_BOOTSTRAP_SCRIPT}\n</script>\n`)
  const [valid] = await eslint.lintFiles([file])
  assert(valid)
  assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages))
  assert(COLOR_MODE_BOOTSTRAP_SCRIPT.includes('document.documentElement'))
  const broken = COLOR_MODE_BOOTSTRAP_SCRIPT.replace('document.documentElement', 'document.methodThatDoesNotExist()')
  await writeFile(file, `<script is:inline>\n${broken}\n</script>\n`)
  const [invalid] = await eslint.lintFiles([file])
  assert(invalid)
  assert(invalid.messages.some((message) => message.line === 2 && /methodThatDoesNotExist/.test(message.message)), JSON.stringify(invalid.messages))
}))

test('client program configuration failures remain visible after Astro mapping', { timeout: 60_000 }, async () => fixtureProject(async ({ directory, app }) => {
  const file = path.join(app, 'src/pages/broken-config.astro')
  await writeFile(path.join(app, 'tsconfig.json'), JSON.stringify({ extends: 'astro/tsconfigs/strict', compilerOptions: { strict: 'invalid' }, include: ['**/*'] }))
  await writeFile(file, '<main />\n<script>\nconsole.log("checked");\n</script>\n')
  const eslint = new ESLint({ cwd: directory, overrideConfigFile: true, overrideConfig: isolatedConfig(directory) })
  const [result] = await eslint.lintFiles([file])
  assert(result)
  assert(result.messages.some((message) => message.fatal && message.line === 3 && /strict/.test(message.message)), JSON.stringify(result.messages))
}))
