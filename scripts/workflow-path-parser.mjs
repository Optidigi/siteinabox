export function stripYamlComment(value) {
  let quote = null
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if ((character === "'" || character === '"') && value[index - 1] !== "\\") {
      quote = quote === character ? null : quote ?? character
    }
    if (character === "#" && !quote && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd()
    }
  }
  return value.trimEnd()
}

function normalizeScalar(value) {
  const scalar = stripYamlComment(value.trim())
  if (scalar.length >= 2 && ((scalar.startsWith('"') && scalar.endsWith('"')) || (scalar.startsWith("'") && scalar.endsWith("'")))) {
    return scalar.slice(1, -1)
  }
  return scalar
}

export function indentation(line) {
  return line.length - line.trimStart().length
}

export function extractWorkflowPaths(source, file = "workflow") {
  const lines = source.split(/\r?\n/)
  let pushIndent = null
  let pathsIndent = null
  let blockScalarIndent = null
  const paths = []

  for (const line of lines) {
    const indent = indentation(line)
    const content = stripYamlComment(line.trim())

    if (blockScalarIndent !== null) {
      if (!content || indent > blockScalarIndent) continue
      blockScalarIndent = null
    }
    if (!content) continue

    if (/:\s*[|>](?:[+-]|\d[+-]?|[+-]\d)?\s*$/.test(content)) {
      blockScalarIndent = indent
      continue
    }

    if (pushIndent !== null && indent <= pushIndent && content !== "push:") {
      pushIndent = null
      pathsIndent = null
    }
    if (pathsIndent !== null && indent <= pathsIndent) {
      pathsIndent = null
    }

    if (content === "push:") {
      pushIndent = indent
      pathsIndent = null
      continue
    }
    if (pushIndent === null) continue

    const pathsMatch = content.match(/^paths:\s*(.*)$/)
    if (pathsMatch && indent > pushIndent) {
      const inline = normalizeScalar(pathsMatch[1])
      if (inline) {
        if (!inline.startsWith("[") || !inline.endsWith("]")) throw new Error(`${file}: unsupported inline paths value`)
        return inline.slice(1, -1).split(",").map((entry) => normalizeScalar(entry)).filter(Boolean)
      }
      pathsIndent = indent
      continue
    }
    if (pathsIndent !== null && indent > pathsIndent && content.startsWith("- ")) {
      paths.push(normalizeScalar(content.slice(2)))
    }
  }

  if (paths.length === 0) throw new Error(`${file}: could not find an on.push.paths block`)
  return paths
}

export function usesRootDockerContext(source) {
  let actionIndent = null
  let withIndent = null
  let blockScalarIndent = null
  let foundRootContext = false

  for (const line of source.split(/\r?\n/)) {
    const indent = indentation(line)
    const content = stripYamlComment(line.trim())

    if (blockScalarIndent !== null) {
      if (!content || indent > blockScalarIndent) continue
      blockScalarIndent = null
    }
    if (!content) continue

    if (/:\s*[|>](?:[+-]|\d[+-]?|[+-]\d)?\s*$/.test(content)) {
      blockScalarIndent = indent
      continue
    }

    if (actionIndent !== null && indent < actionIndent) {
      actionIndent = null
      withIndent = null
    }
    if (/^-?\s*uses:\s*docker\/build-push-action@/.test(content)) {
      actionIndent = indent
      withIndent = null
      continue
    }
    if (actionIndent === null) continue
    if (content === "with:" && indent >= actionIndent) {
      withIndent = indent
      continue
    }
    const contextMatch = content.match(/^context:\s*(.*)$/)
    if (withIndent !== null && indent > withIndent && contextMatch) {
      const context = normalizeScalar(contextMatch[1])
      foundRootContext ||= context === "." || context === "./"
    }
  }
  return foundRootContext
}
