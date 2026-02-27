import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Rehype plugin that prepends a base URL to root-relative links and images
 * in rendered markdown.
 *
 * This handles the gap between React components (which use `applyBaseUrl()`
 * via the `<Link>` component) and server-rendered markdown injected via
 * `dangerouslySetInnerHTML`, where links bypass React entirely.
 *
 * Only rewrites paths starting with `/` that don't already include the
 * base URL.  Absolute URLs (`https://...`) are left untouched.
 */
export function rehypeBaseUrl(options: { base: string }) {
  const base = options.base.replace(/\/+$/, '') // strip trailing slash

  return (tree: Root) => {
    if (!base || base === '/' || base === './' || base === '.') return

    visit(tree, 'element', (node) => {
      rewriteAttr(node, 'href', base)
      rewriteAttr(node, 'src', base)
    })
  }
}

function rewriteAttr(
  node: { properties?: Record<string, unknown> },
  attr: string,
  base: string
) {
  const val = node.properties?.[attr]
  if (typeof val !== 'string') return
  // Only rewrite root-relative paths that aren't already prefixed
  if (val.startsWith('/') && !val.startsWith('//') && !val.startsWith(base + '/')) {
    node.properties![attr] = base + val
  }
}
