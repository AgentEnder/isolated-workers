import type { Root as MdastRoot, RootContent } from 'mdast'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import type { RehypeTypedocOptions, RemarkCodePropsOptions } from 'rehype-typedoc'
import { rehypeTypedoc, rehypeTypedocCodeBlocks, remarkCodeProps } from 'rehype-typedoc'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import type { Plugin } from 'unified'
import { unified } from 'unified'
import type { Literal, Node, Parent } from 'unist'
import { visit } from 'unist-util-visit'
import { applyBaseUrl } from '../../utils/base-url'
import { parseLiquidTag, type LiquidTag } from './liquid-tags'
import {
  remarkLiquidTags,
  type RemarkLiquidTagsOptions,
} from './remark-liquid-tags'
import type { ApiDocs, ApiExport } from './typedoc'

export type { RemarkLiquidTagsOptions }

let _rehypeOptions: RehypeTypedocOptions | undefined
let _remarkCodePropsOptions: RemarkCodePropsOptions | undefined

export function configureRehypeTypedoc(options: RehypeTypedocOptions): void {
  _rehypeOptions = options
}

export function configureRemarkCodeProps(options: RemarkCodePropsOptions): void {
  _remarkCodePropsOptions = options
}

/**
 * Render a Markdown string to syntax-highlighted HTML.
 *
 * Pipeline:
 *   remarkParse → remarkGfm → remarkDirective → remarkCodeProps
 *   → remarkRehype → rehypeRaw → rehypeTypedoc (if configured)
 *   → @shikijs/rehype → rehypeTypedocCodeBlocks (if configured)
 *   → rehypeStringify
 */
export async function renderMarkdown(md: string): Promise<string> {
  const { default: rehypeShiki } = await import('@shikijs/rehype')

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeProps, _remarkCodePropsOptions ?? {})
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)

  if (_rehypeOptions) {
    processor.use(rehypeTypedoc, _rehypeOptions)
  }

  processor.use(rehypeShiki, {
    theme: 'github-dark',
    addLanguageClass: true,
  })

  if (_rehypeOptions) {
    processor.use(rehypeTypedocCodeBlocks, _rehypeOptions)
  }

  processor.use(rehypeStringify)

  const file = await processor.process(md)
  return String(file)
}

/**
 * Parse a Markdown string to an MDAST root node.
 */
export function parseMarkdown(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown)
}

export interface ProcessMarkdownChunkOptions {
  liquidTags?: RemarkLiquidTagsOptions
  apiDocs: ApiDocs
}

export interface HtmlElementNode extends Node {
  type: 'element'
  tagName: string
  properties?: {
    [prop: string]: unknown
  }
  children?: Node[]
}

export const applyBaseUrlToLinks: Plugin<[]> = () => {
  return (tree: Node) => {
    visit(tree, 'element', (node: HtmlElementNode) => {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        node.properties.href = applyBaseUrl(node.properties.href)
      }
    })
  }
}

export const hydrateInlineCodeLinks: Plugin<
  [
    {
      apiDocs: ApiDocs
    },
  ]
> = ({ apiDocs }: { apiDocs: ApiDocs }) => {
  const symbolToExport = new Map<string, ApiExport>()
  for (const apiExport of apiDocs.allExports) {
    if (!symbolToExport.has(apiExport.name)) {
      if (apiExport) {
        symbolToExport.set(apiExport.name, apiExport)
      }
    }
  }

  return (tree: Node) => {
    visit(
      tree,
      'inlineCode',
      (node: Literal, index: number, parent: Parent) => {
        if (typeof node.value !== 'string') return

        const apiDoc = symbolToExport.get(node.value)

        const codeNode = {
          type: 'html',
          value: `<code class="inline-code">${
            apiDoc
              ? `<a class="code-link" href=${applyBaseUrl(apiDoc.path)}>${
                  node.value
                }</a>`
              : node.value
          }</code>`,
        }

        // Replace node with HTML snippet
        parent.children.splice(index, 1, codeNode)
      }
    )
  }
}

/**
 * Process an array of MDAST nodes to HTML, applying liquid tags and inline code links.
 */
export async function processMarkdownChunk(
  nodes: RootContent[],
  options: ProcessMarkdownChunkOptions
): Promise<string> {
  if (nodes.length === 0) return ''

  const root: MdastRoot = {
    type: 'root',
    children: nodes,
  }

  const processor = unified()

  if (options.liquidTags) {
    processor.use(remarkLiquidTags, options.liquidTags)
  }

  processor.use(hydrateInlineCodeLinks, options)

  processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(applyBaseUrlToLinks)
    .use(rehypeStringify, { allowDangerousHtml: true })

  const result = await processor.run(root)
  return String(processor.stringify(result))
}

export type LiquidTagCheck =
  | { isPlaceholder: true; tag: LiquidTag }
  | { isPlaceholder: false }

/**
 * Check if an MDAST node is a standalone liquid tag paragraph.
 * Returns the parsed tag if so, otherwise isPlaceholder: false.
 */
export function extractLiquidTag(node: RootContent): LiquidTagCheck {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false }
  }

  const child = node.children[0]
  if (child.type !== 'text') {
    return { isPlaceholder: false }
  }

  const tag = parseLiquidTag(child.value.trim())
  if (tag) {
    return { isPlaceholder: true, tag }
  }

  return { isPlaceholder: false }
}

export type FilePlaceholderCheck =
  | { isPlaceholder: true; filename: string; hunk?: string }
  | { isPlaceholder: false }

/**
 * Check if an MDAST node is a {% file path %} or {{file:path}} placeholder.
 * Returns filename and optional hunk if so.
 */
export function extractFilePlaceholder(
  node: RootContent
): FilePlaceholderCheck {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return { isPlaceholder: false }
  }

  const child = node.children[0]
  if (child.type !== 'text') {
    return { isPlaceholder: false }
  }

  const text = child.value.trim()

  const tag = parseLiquidTag(text)
  if (tag && tag.type === 'file') {
    return { isPlaceholder: true, filename: tag.path, hunk: tag.hunk }
  }

  const legacyMatch = text.match(/^\{\{file:([^}]+)\}\}$/)
  if (legacyMatch) {
    const [filename, hunk] = legacyMatch[1].trim().split('#')
    return { isPlaceholder: true, filename, hunk }
  }

  return { isPlaceholder: false }
}

/**
 * Convenience: parse markdown and process all nodes to HTML with typedoc options.
 */
export async function processMarkdownWithTypedoc(
  markdown: string,
  options: ProcessMarkdownChunkOptions
): Promise<string> {
  const root = parseMarkdown(markdown)
  return processMarkdownChunk(root.children, options)
}
