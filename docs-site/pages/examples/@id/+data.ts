import { createGuideRenderer } from '@functional-examples/documentation'
import type { ScannedExample } from '@functional-examples/devkit'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PageContextServer } from 'vike/types'
import { renderMarkdown } from '../../../server/utils/markdown.js'

export interface ExampleData {
  example: ScannedExample | null
  renderedHtml: string
}

export async function data(pageContext: PageContextServer): Promise<ExampleData> {
  const { id } = pageContext.routeParams
  const scannedExamples = pageContext.globalContext.scannedExamples
  const example = scannedExamples.find((ex) => ex.id === id) ?? null

  if (!example) {
    return { example: null, renderedHtml: '' }
  }

  // Load content.md from examples/<id>/content.md relative to repo root
  // import.meta.dirname = docs-site/pages/examples/@id
  // ../../../.. = repo root
  const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..')
  const contentPath = path.join(repoRoot, 'examples', id, 'content.md')

  let rawContent: string
  let needsEta = true
  try {
    rawContent = await fs.readFile(contentPath, 'utf-8')
  } catch {
    // Auto-generate content from the example's files.
    // Build fenced code blocks directly with title metadata so the
    // chrome header shows filenames instead of just the language.
    const langMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
      '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
      '.html': 'html', '.css': 'css', '.sh': 'bash',
    }
    const fileParts = example.files
      .map((f) => {
        const ext = path.extname(f.relativePath)
        const lang = langMap[ext] || 'text'
        const content = f.parsed ?? f.raw ?? ''
        return `\`\`\`${lang} title="${f.relativePath}"\n${content}\n\`\`\``
      })
      .join('\n\n')
    rawContent = fileParts || `*No source files found.*`
    needsEta = false
  }

  // Expand Eta example references, then render to HTML
  let expandedContent = rawContent
  if (needsEta) {
    const renderer = createGuideRenderer(scannedExamples)
    try {
      expandedContent = renderer.render(rawContent)
    } catch (err) {
      console.warn(`[examples] Hydration failed for "${id}":`, (err as Error).message)
    }
  }

  const renderedHtml = await renderMarkdown(expandedContent)
  return { example, renderedHtml }
}
