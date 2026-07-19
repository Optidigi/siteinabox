import { createRequire } from "node:module"
const require = createRequire(new URL("../../packages/site-renderer/package.json", import.meta.url))
const ts = require("typescript")

const decodedText = (value) => value
  .replaceAll("&apos;", "'").replaceAll("&#39;", "'").replaceAll("&quot;", '"')
  .replaceAll("&amp;", "&").replaceAll("&nbsp;", "\u00a0").replace(/\s+/g, " ").trim()

function compileBlockBindings(contents, blockType, declaredBindings, label = blockType) {
  const source = ts.createSourceFile("literal.tsx", contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const remaining = (declaredBindings ?? []).map((binding, index) => ({ ...binding, index }))
  const edits = []
  const bindings = []
  let needsRuntime = false
  const staticItemsBinding = remaining.find((binding) => binding.kind === "static-items")
  const staticStatsBinding = remaining.find((binding) => binding.kind === "static-stat-items")
  const staticContactBinding = remaining.find((binding) => binding.kind === "static-contact-items")
  let staticItemsCount = 0
  let staticStatIndex = -1
  let staticStatTextIndex = 0
  let staticContactIndex = -1

  const insideMap = (node) => {
    let current = node.parent
    while (current) {
      if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "map") return true
      current = current.parent
    }
    return false
  }
  const insideElement = (node, tagName) => {
    let current = node.parent
    while (current) {
      if (ts.isJsxElement(current) && current.openingElement.tagName.getText(source) === tagName) return true
      current = current.parent
    }
    return false
  }
  const elementText = (node) => {
    const parts = []
    let dynamic = false
    const collect = (child) => {
      if (ts.isJsxText(child)) parts.push(child.getText(source))
      else if (ts.isStringLiteral(child)) parts.push(child.text)
      else if (ts.isJsxExpression(child)) {
        if (child.expression && ts.isStringLiteral(child.expression)) parts.push(child.expression.text)
        else dynamic = true
      } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) child.children.forEach(collect)
      else if (!ts.isJsxSelfClosingElement(child)) dynamic = true
    }
    node.children.forEach(collect)
    return dynamic ? null : decodedText(parts.join(" "))
  }
  const visit = (node) => {
    if (staticItemsBinding && ts.isJsxSelfClosingElement(node) && /^Logo\d+$/.test(node.tagName.getText(source))) {
      const fallback = node.getText(source)
      const itemIndex = Number(node.tagName.getText(source).match(/\d+$/)?.[0] ?? 1) - 1
      edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderLogo field=${JSON.stringify(staticItemsBinding.field)} index={${itemIndex}} fallback={${fallback}} />` })
      staticItemsCount = Math.max(staticItemsCount, itemIndex + 1)
      needsRuntime = true
      return
    }
    if (blockType === "hero" && ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Link" && insideElement(node, "Badge") && !insideMap(node)) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const decorations = node.children.filter((child) => ts.isJsxSelfClosingElement(child)).map((child) => child.getText(source)).join("")
        const href = node.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "href")
        edits.push({ start: node.openingElement.tagName.getStart(source), end: node.openingElement.tagName.end, text: "span" })
        edits.push({ start: node.closingElement.tagName.getStart(source), end: node.closingElement.tagName.end, text: "span" })
        if (href) edits.push({ start: href.getFullStart(), end: href.end, text: "" })
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={${JSON.stringify(fallback)}} inline />${decorations}` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "div" && !insideMap(node)) {
      const regionAttribute = node.attributes.properties.find((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "data-provider-image-region"
      )
      const regionField = regionAttribute && ts.isStringLiteral(regionAttribute.initializer)
        ? regionAttribute.initializer.text
        : null
      const declared = regionField
        ? remaining.find((binding) => binding.kind === "image" && binding.field === regionField)
        : null
      if (declared?.field && regionAttribute) {
        const literal = node.getText(source).replace(/\s*data-provider-image-region="[^"]+"/, "")
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderImage field=${JSON.stringify(declared.field)} fallback={${literal}} />` })
        bindings.push({ field: declared.field, kind: "image" })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "Image" && !insideMap(node)) {
      const declared = remaining.find((binding) => binding.kind === "image")
      if (declared?.field) {
        const literal = node.getText(source)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderImage field=${JSON.stringify(declared.field)} fallback={${literal}} />` })
        bindings.push({ field: declared.field, kind: "image" })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (blockType === "featureList" && ts.isJsxElement(node) && !insideMap(node) && node.children.some((child) => ts.isJsxSelfClosingElement(child))) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node) && node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))) {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      if (fallback && declared?.field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(declared.field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field: declared.field, kind: "field", fallback })
        needsRuntime = true
        remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node) && node.openingElement.tagName.getText(source) === "Button") {
      const fallback = elementText(node)
      const declared = fallback ? remaining.find((binding) => binding.kind === "action" && binding.fallback === fallback) : null
      const field = declared?.field
      if (fallback && field) {
        const meaningfulChildren = node.children.filter((child) => !ts.isJsxText(child) || child.getText(source).trim())
        const decoration = meaningfulChildren[0] && ts.isJsxSelfClosingElement(meaningfulChildren[0]) ? "before" : "after"
        const decorations = node.children.filter((child) => ts.isJsxSelfClosingElement(child)).map((child) => child.getText(source)).join("")
        const labelNodes = node.children.filter((child) => !ts.isJsxSelfClosingElement(child))
        const hasLabelMarkup = labelNodes.some((child) => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) !== "Link")
        const labelChildren = labelNodes.map((child) => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === "Link"
          ? contents.slice(child.openingElement.end, child.closingElement.pos)
          : child.getText(source)).join("")
        const fallbackExpression = hasLabelMarkup ? `<>${labelChildren}</>` : JSON.stringify(fallback)
        if (!node.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "asChild")) {
          edits.push({ start: node.openingElement.end - 1, end: node.openingElement.end - 1, text: " asChild" })
        }
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderAction field=${JSON.stringify(field)} fallback={${fallbackExpression}} decoration=${JSON.stringify(decoration)}>${decorations}</ProviderAction>` })
        bindings.push({ field, kind: "action", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Button") {
      const literal = node.getText(source)
      if (!insideMap(node) || /href=["'](?:#|about:blank)/.test(literal)) {
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderDemoOnly fallback={<>${literal}</>} />` })
        needsRuntime = true
        return
      }
    }
    if (ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source).toLowerCase()
      const kind = /^h[1-6]$/.test(tag) ? "heading" : tag === "p" ? "paragraph" : /^(b|strong|small)$/.test(tag) ? "eyebrow" : null
      const fallback = kind ? elementText(node) : null
      const declared = fallback ? remaining.find((binding) => binding.kind === "field" && binding.fallback === fallback) : null
      const field = declared?.field
      if (kind === "eyebrow" && fallback?.toLowerCase() === "contact us" && !declared) {
        const literal = node.getText(source)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderDemoOnly fallback={<>${literal}</>} />` })
        needsRuntime = true
        return
      }
      if (fallback && field) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderField field=${JSON.stringify(field)} fallback={<>${literalChildren}</>} inline />` })
        bindings.push({ field, kind: "field", fallback })
        needsRuntime = true
        if (declared) remaining.splice(remaining.indexOf(declared), 1)
        return
      }
    }
    if (staticStatsBinding && ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source).toLowerCase()
      const fallback = elementText(node)
      const leafText = node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))
      const startsItem = leafText && fallback && tag !== "p" && /\d/.test(fallback)
      const continuesItem = leafText && fallback && tag === "p" && staticStatIndex >= 0
      if (startsItem || continuesItem) {
        if (startsItem) {
          staticStatIndex += 1
          staticStatTextIndex = 0
        }
        const subField = startsItem ? "value" : staticStatTextIndex++ === 0 ? "label" : "description"
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticStatsBinding.field)} index={${staticStatIndex}} subField=${JSON.stringify(subField)} fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
    }
    if (staticContactBinding && ts.isJsxElement(node) && !insideMap(node)) {
      const tag = node.openingElement.tagName.getText(source)
      const fallback = elementText(node)
      const leafText = node.children.every((child) => ts.isJsxText(child) || ts.isJsxExpression(child))
      if (leafText && fallback && tag === "h3") {
        staticContactIndex += 1
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} subField="title" fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
      if (leafText && fallback && tag === "p" && staticContactIndex >= 0) {
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.openingElement.end, end: node.closingElement.pos, text: `<ProviderItemField field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} subField="description" fallback={<>${literalChildren}</>} />` })
        needsRuntime = true
        return
      }
      if (fallback && tag === "Link" && staticContactIndex >= 0) {
        const attributes = node.openingElement.attributes.properties
          .filter((attribute) => !(ts.isJsxAttribute(attribute) && attribute.name.text === "href"))
          .map((attribute) => attribute.getText(source)).join(" ")
        const literalChildren = contents.slice(node.openingElement.end, node.closingElement.pos)
        edits.push({ start: node.getStart(source), end: node.end, text: `<ProviderContactLink field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex}} fallback={<>${literalChildren}</>} ${attributes} />` })
        needsRuntime = true
        return
      }
    }
    if (staticContactBinding && ts.isJsxSelfClosingElement(node) && !insideMap(node)) {
      const tag = node.tagName.getText(source)
      if (tag.endsWith("Icon")) {
        edits.push({
          start: node.getStart(source),
          end: node.end,
          text: `<ProviderContactIcon field=${JSON.stringify(staticContactBinding.field)} index={${staticContactIndex + 1}} fallback={<${tag} />} />`,
        })
        needsRuntime = true
        return
      }
    }
    if (ts.isCallExpression(node)) {
      const call = node
      if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "map" && call.arguments.length === 1) {
        const receiver = call.expression.expression
        const name = ts.isIdentifier(receiver)
          ? receiver.text
          : ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) && ts.isIdentifier(receiver.expression.expression)
            ? receiver.expression.expression.text
            : null
        if (!name) return ts.forEachChild(node, visit)
        const declared = remaining.find((binding) => binding.kind === "items" && binding.source === name)
        const field = declared?.field
        if (field) {
          let callback = call.arguments[0].getText(source)
          if (blockType === "team") {
            let linkIndex = 0
            const wrap = (literal) => `<ProviderItemLink value={member.links?.[${linkIndex++}]} fallback={<>${literal}</>} />`
            const buttons = []
            callback = callback.replace(/<Button\b[^>]*>[\s\S]*?<Link\s+href=["']#["'][^>]*>[\s\S]*?<\/Link>\s*<\/Button>/g, (literal) => {
              const marker = `__SIAB_TEAM_LINK_${buttons.length}__`
              buttons.push(wrap(literal))
              return marker
            })
            callback = callback.replace(/<Link\s+href=["']#["'][^>]*>[\s\S]*?<\/Link>/g, wrap)
            buttons.forEach((button, index) => { callback = callback.replace(`__SIAB_TEAM_LINK_${index}__`, button) })
          }
          const receiverText = receiver.getText(source)
          const templates = receiverText.replaceAll(/\s/g, "") === `${name}.reverse()` ? `[...${name}].reverse()` : receiverText
          edits.push({ start: call.getStart(source), end: call.end, text: `<ProviderItems field=${JSON.stringify(field)} templates={${templates}}>{(providerItems) => providerItems.map(${callback})}</ProviderItems>` })
          bindings.push({ field, kind: "items", source: name })
          needsRuntime = true
          if (declared) remaining.splice(remaining.indexOf(declared), 1)
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (staticItemsBinding && staticItemsCount > 0) {
    bindings.push({ field: staticItemsBinding.field, kind: "static-items", maxItems: staticItemsCount })
    remaining.splice(remaining.indexOf(staticItemsBinding), 1)
  }
  if (staticStatsBinding && staticStatIndex >= 0) {
    bindings.push({ field: staticStatsBinding.field, kind: "static-stat-items", maxItems: staticStatIndex + 1 })
    remaining.splice(remaining.indexOf(staticStatsBinding), 1)
  }
  if (staticContactBinding && staticContactIndex >= 0) {
    bindings.push({ field: staticContactBinding.field, kind: "static-contact-items", maxItems: staticContactIndex + 1 })
    remaining.splice(remaining.indexOf(staticContactBinding), 1)
  }
  if (remaining.length) throw new Error(`Declared provider bindings were not found in ${label}: ${remaining.map((binding) => `${binding.kind}:${binding.field}:${binding.fallback ?? binding.source}`).join(", ")}`)
  if (!needsRuntime) return { contents, bindings }
  const prologue = contents.match(/^\/\/ @ts-nocheck[^\n]*\n(?:\s*["']use client["'];?\s*\n)?/)
  const insertAt = prologue?.[0].length ?? contents.indexOf("\n") + 1
  const runtimeImports = ["ProviderAction", "ProviderContactLink", "ProviderDemoOnly", "ProviderField", "ProviderImage", "ProviderItemField", "ProviderItemLink", "ProviderItems", "ProviderLogo"]
  if (staticContactBinding) runtimeImports.splice(1, 0, "ProviderContactIcon")
  edits.push({ start: insertAt, end: insertAt, text: `import { ${runtimeImports.join(", ")} } from "../../runtime/content";\n` })
  const adapted = edits.sort((a, b) => b.start - a.start).reduce((value, edit) => value.slice(0, edit.start) + edit.text + value.slice(edit.end), contents)
  return { contents: adapted, bindings }
}

export { compileBlockBindings }
