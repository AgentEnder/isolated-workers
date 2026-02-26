import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import type { RehypeTypedocOptions, RemarkCodePropsOptions } from 'rehype-typedoc'
import { rehypeTypedoc, rehypeTypedocCodeBlocks, remarkCodeProps } from 'rehype-typedoc'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

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
