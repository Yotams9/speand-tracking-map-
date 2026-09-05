import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(file)
      : /\.tsx?$/.test(file) && !file.endsWith('.test.ts') ? [file] : []
  })
}

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const names = clause?.namedBindings
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && names
        && ts.isNamedImports(names) && names.elements.length > 0
        && names.elements.every((entry) => entry.isTypeOnly))
      if (!onlyTypes) specifiers.push(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return specifiers.flatMap((specifier) => {
    const base = specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2))
      : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null
    if (!base) return []
    const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
      .find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate))
    return resolved ? [resolved] : []
  })
}

it('keeps fixture graphs outside every production feature runtime dependency', () => {
  const visited = new Set<string>()
  const pending = sourceFiles(path.resolve('src/features'))
  const forbidden = [path.resolve('src/data/spendscape-fixtures.ts'), path.resolve('src/data/fixtures.ts')]
  while (pending.length) {
    const file = pending.pop()!
    if (visited.has(file)) continue
    visited.add(file)
    expect(forbidden, `Feature dependency bypasses the repository: ${file}`).not.toContain(file)
    pending.push(...runtimeImports(file))
  }
  expect(visited.has(path.resolve('src/data/spendscape-globe.ts'))).toBe(true)
  expect(visited.has(path.resolve('src/data/spendscape-analytics.ts'))).toBe(true)
})
