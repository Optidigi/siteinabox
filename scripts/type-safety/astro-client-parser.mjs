import tsParser from '@typescript-eslint/parser'
import ts from 'typescript'
import path from 'node:path'

/** @param {string} message */
const positionedError = (message) => Object.assign(new SyntaxError(message), { lineNumber: 1, column: 1 })

export const meta = { name: 'siteinabox/astro-client-parser', version: '1' }

/**
 * Use the maintained Astro processor's virtual TypeScript text with a real
 * project program. Relative imports retain the physical component's folder.
 * @param {string} code
 * @param {import('@typescript-eslint/parser').ParserOptions} options
 */
export function parseForESLint(code, options) {
  if (typeof options.filePath !== 'string') throw positionedError('Astro client parser requires a filePath')
  const virtualFile = path.resolve(options.filePath)
  const marker = virtualFile.lastIndexOf('.astro' + path.sep)
  if (marker < 0) throw positionedError(`Expected an Astro processor virtual file: ${virtualFile}`)
  const astroFile = virtualFile.slice(0, marker + '.astro'.length)
  const configPath = ts.findConfigFile(path.dirname(astroFile), ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) throw positionedError(`Missing Astro client tsconfig for ${astroFile}`)
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw positionedError(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  // TS18003 describes the disk-only input set; this program adds its virtual input below.
  const configErrors = parsed.errors.filter((diagnostic) => diagnostic.code !== 18003)
  if (configErrors.length) throw positionedError(configErrors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'))
  const host = ts.createCompilerHost(parsed.options)
  const read = host.readFile.bind(host)
  const exists = host.fileExists.bind(host)
  host.readFile = (file) => file === virtualFile ? code : read(file)
  host.fileExists = (file) => file === virtualFile || exists(file)
  host.resolveModuleNames = (names, containingFile) => names.map((name) => ts.resolveModuleName(name, containingFile === virtualFile ? astroFile : containingFile, parsed.options, host).resolvedModule)
  const program = ts.createProgram([...parsed.fileNames, virtualFile], parsed.options, host)
  const source = program.getSourceFile(virtualFile)
  if (!source) throw positionedError(`Missing Astro client program source: ${virtualFile}`)
  // Astro check does not type-check is:inline bodies. Check every executable
  // processor block with the same project compiler before running unsafe rules.
  const diagnostic = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
    .find((entry) => entry.category === ts.DiagnosticCategory.Error)
  if (diagnostic) {
    const position = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
    const error = new SyntaxError(`TypeScript TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
    throw Object.assign(error, { lineNumber: position.line + 1, column: position.character + 1 })
  }
  return tsParser.parseForESLint(code, { ...options, project: null, projectService: false, programs: [program] })
}
