import { useEffect, useRef } from 'react'

/**
 * Hydrates `button[data-code-copy]` elements rendered by the
 * `rehypeCodeBlockChrome` rehype plugin. Attaches click handlers
 * that copy the sibling code content to the clipboard and show
 * a brief "Copied!" confirmation.
 *
 * Usage: render this component inside a container that holds
 * `dangerouslySetInnerHTML` content with code blocks.
 *
 * @param containerRef - ref to the DOM element containing the rendered HTML
 */
export function useCodeCopyHydration(
  containerRef: React.RefObject<HTMLElement | null>
) {
  // Track active timeouts so we can clean them up
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      'button[data-code-copy]'
    )

    const controllers: AbortController[] = []

    for (const button of buttons) {
      const controller = new AbortController()
      controllers.push(controller)

      button.addEventListener('click', () => {
        const wrapper = button.closest('.code-block-container')
        if (!wrapper) return

        const codeEl = wrapper.querySelector('.code-block-content pre code')
        if (!codeEl) return

        const text = codeEl.textContent || ''

        navigator.clipboard.writeText(text).then(() => {
          // Show "Copied!" feedback only on success
          const svg = button.querySelector('svg')
          const originalHtml = svg ? svg.outerHTML : ''
          button.innerHTML =
            '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!'
          button.classList.add('copied')

          const timeout = window.setTimeout(() => {
            button.innerHTML = originalHtml + 'Copy'
            button.classList.remove('copied')
          }, 2000)
          timeoutsRef.current.push(timeout)
        }, () => {
          // Clipboard write failed — silently ignore
        })
      }, { signal: controller.signal })
    }

    return () => {
      for (const controller of controllers) {
        controller.abort()
      }
      for (const t of timeoutsRef.current) {
        clearTimeout(t)
      }
      timeoutsRef.current = []
    }
  }, [containerRef])
}
