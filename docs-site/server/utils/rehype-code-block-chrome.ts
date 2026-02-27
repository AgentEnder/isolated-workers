import type { Element, ElementContent, Root } from 'hast'
import { SKIP, visit } from 'unist-util-visit'

/**
 * Language display names for the terminal chrome header.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  js: 'JavaScript',
  tsx: 'TSX',
  jsx: 'JSX',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  bash: 'Bash',
  sh: 'Shell',
  html: 'HTML',
  css: 'CSS',
  plaintext: 'Text',
  text: 'Text',
}

/**
 * Resolve the class list from an element's properties.
 *
 * Standard HAST uses `className` (string[]), but Shiki's rehype plugin
 * sets `class` as a raw string. This helper normalizes both forms.
 */
function getClassList(el: Element): string[] {
  const props = el.properties
  if (!props) return []

  // Standard HAST: className is string[]
  if (Array.isArray(props.className)) {
    return props.className.filter((c): c is string => typeof c === 'string')
  }

  // Shiki sets `class` as a string or array (non-standard but common)
  const raw = props['class']
  if (typeof raw === 'string') {
    return raw.split(/\s+/).filter(Boolean)
  }
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === 'string')
  }

  return []
}

/**
 * Extract the language from a `<code>` element's class list.
 * Shiki adds `language-*` classes when `addLanguageClass: true`.
 */
function extractLanguage(codeEl: Element): string | null {
  for (const cls of getClassList(codeEl)) {
    if (cls.startsWith('language-')) {
      return cls.slice('language-'.length)
    }
  }
  return null
}

/**
 * Extract a title from the `<pre>` element's `data-title` property.
 * This is set by the `titleTransformer` Shiki transformer when the
 * fenced code block meta string contains `title="..."`.
 */
function extractTitle(preEl: Element): string | null {
  const title = preEl.properties?.['dataTitle'] ?? preEl.properties?.['data-title']
  return typeof title === 'string' ? title : null
}

/**
 * Build the terminal chrome header as HAST nodes.
 *
 * When a `title` is provided (e.g. a filename), it is displayed instead
 * of the language label. The language serves as a fallback.
 */
function buildHeader(language: string | null, title?: string | null): Element {
  const label = title
    || (language ? LANGUAGE_LABELS[language] || language : 'Code')

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-block-header'] },
    children: [
      // macOS dots
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block-dots'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['dot-red'] },
            children: [],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['dot-yellow'] },
            children: [],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['dot-green'] },
            children: [],
          },
        ],
      },
      // Language label
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['code-block-lang'] },
        children: [{ type: 'text', value: label }],
      },
      // Copy button (hydrated client-side)
      {
        type: 'element',
        tagName: 'button',
        properties: {
          className: ['code-block-copy'],
          'data-code-copy': '',
        },
        children: [
          // Copy icon SVG
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              className: ['code-block-copy-icon'],
              fill: 'none',
              stroke: 'currentColor',
              viewBox: '0 0 24 24',
              width: '14',
              height: '14',
            },
            children: [
              {
                type: 'element',
                tagName: 'path',
                properties: {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: '2',
                  d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
                },
                children: [],
              },
            ],
          },
          { type: 'text', value: 'Copy' },
        ],
      },
    ],
  }
}

/**
 * Rehype plugin that preserves the fenced code block meta string across
 * `rehypeRaw`.  `remark-rehype` stores the meta in `node.data.meta`, but
 * `rehypeRaw` re-parses HTML and drops `data`.  Shiki's rehype plugin
 * falls back to `properties.metastring`, so we copy it there.
 *
 * Must run **before** `rehypeRaw` in the pipeline.
 */
export function rehypePreserveCodeMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'code') return
      const meta = (node.data as Record<string, unknown> | undefined)?.meta
      if (typeof meta === 'string' && meta) {
        node.properties = node.properties || {}
        node.properties['metastring'] = meta
      }
    })
  }
}

/**
 * Rehype plugin that wraps Shiki-highlighted `<pre class="shiki">` blocks
 * in terminal chrome HTML matching the CodeBlock React component's structure.
 *
 * Transforms:
 *   <pre class="shiki"><code class="language-ts">...</code></pre>
 *
 * Into:
 *   <div class="code-block-wrapper">
 *     <div class="code-block-container">
 *       <div class="code-block-header">...</div>
 *       <div class="code-block-content">
 *         <pre class="shiki"><code>...</code></pre>
 *       </div>
 *     </div>
 *   </div>
 */
export function rehypeCodeBlockChrome() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !getClassList(node).includes('shiki')) {
        return
      }

      if (index == null || !parent) return

      // Find the <code> child to extract language
      const codeChild = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code'
      )
      const language = codeChild ? extractLanguage(codeChild) : null
      const title = extractTitle(node)

      // Build the wrapper structure
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block-wrapper'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block-container'] },
            children: [
              buildHeader(language, title),
              {
                type: 'element',
                tagName: 'div',
                properties: { className: ['code-block-content'] },
                children: [node as ElementContent],
              },
            ],
          },
        ],
      }

      // Replace the <pre> with the wrapped version and skip
      // descending into the wrapper (the original <pre> is still
      // inside and would otherwise be wrapped again).
      parent.children[index] = wrapper
      return SKIP
    })
  }
}

/**
 * Parse `title="..."` from a fenced code block meta string.
 *
 * Use as @shikijs/rehype `parseMetaString` option so the title is
 * available to transformers via `options.meta.title`.
 */
export function parseCodeBlockMeta(metaString: string): Record<string, unknown> {
  const match = metaString.match(/title="([^"]*)"/)
  return match ? { title: match[1] } : {}
}

/**
 * Shiki transformer that copies `meta.title` to a `data-title` attribute
 * on the `<pre>` element, where `rehypeCodeBlockChrome` can read it.
 */
export const titleTransformer = {
  name: 'rehype-code-block-chrome:title',
  pre(node: Element) {
    const title = (this as { options?: { meta?: { title?: string } } }).options?.meta?.title
    if (title) {
      node.properties = node.properties || {}
      node.properties['dataTitle'] = title
    }
    return node
  },
}
