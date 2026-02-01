import { useCallback, useEffect, useRef } from 'react';

/**
 * Configuration for the neon flicker effect
 */
interface FlickerConfig {
  /** Minimum interval between flickers in ms (default: 2 minutes) */
  minInterval?: number;
  /** Maximum interval between flickers in ms (default: 5 minutes) */
  maxInterval?: number;
  /** Total duration of the flicker sequence in ms (default: 3000) */
  sequenceDuration?: number;
  /** Maximum duration for individual element flicker in ms (default: 500) */
  maxIndividualDuration?: number;
  /** Percentage of border-glow elements to flicker (default: 0.85) */
  borderGlowPercentage?: number;
  /** Percentage of text words to flicker (default: 0.15) */
  textPercentage?: number;
  /** Whether the effect is enabled (default: true) */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<FlickerConfig> = {
  minInterval: 2 * 60 * 1000, // 2 minutes
  maxInterval: 5 * 60 * 1000, // 5 minutes
  sequenceDuration: 1500,
  maxIndividualDuration: 500, // max 500ms per element
  borderGlowPercentage: 0.85,
  textPercentage: 0.15,
  enabled: true,
};

/** Random duration between 150ms and maxDuration */
function getRandomFlickerDuration(maxDuration: number): number {
  return 150 + Math.random() * (maxDuration - 150);
}

/** Elements to exclude from text wrapping */
const EXCLUDED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
  'NOSCRIPT',
  'SVG',
  'CANVAS',
]);

/**
 * Finds all text nodes in the document that are suitable for flickering.
 */
function getTextNodes(): Text[] {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty or whitespace-only text
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip excluded elements
        const parent = node.parentElement;
        if (!parent || EXCLUDED_TAGS.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip elements that are already wrapped for flickering
        if (parent.classList.contains('flicker-word')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node);
  }
  return textNodes;
}

/**
 * Wraps selected words in a text node with span elements and returns cleanup function.
 * Only wraps words selected by the percentage threshold.
 */
function wrapWordsForFlicker(
  textNode: Text,
  percentage: number
): { spans: HTMLSpanElement[]; restore: () => void } {
  const parent = textNode.parentNode;
  if (!parent) return { spans: [], restore: () => {} };

  const text = textNode.textContent || '';
  const words = text.split(/(\s+)/); // Keep whitespace as separate items
  const fragment = document.createDocumentFragment();
  const spans: HTMLSpanElement[] = [];

  for (const word of words) {
    if (/^\s+$/.test(word)) {
      // Whitespace - just add as text
      fragment.appendChild(document.createTextNode(word));
    } else if (word && Math.random() < percentage) {
      // Selected word - wrap in span
      const span = document.createElement('span');
      span.className = 'flicker-word';
      span.textContent = word;
      spans.push(span);
      fragment.appendChild(span);
    } else {
      // Non-selected word - add as text
      fragment.appendChild(document.createTextNode(word));
    }
  }

  // Replace the text node with our fragment
  parent.replaceChild(fragment, textNode);

  // Return cleanup function
  const restore = () => {
    // Find and remove all our spans, replacing with text
    for (const span of spans) {
      if (span.parentNode) {
        const textReplacement = document.createTextNode(span.textContent || '');
        span.parentNode.replaceChild(textReplacement, span);
      }
    }
    // Normalize to merge adjacent text nodes
    parent.normalize();
  };

  return { spans, restore };
}

/**
 * Hook that triggers a "power flicker" effect on neon elements at random intervals.
 * Targets 85% of .border-glow elements and 15% of text (word-by-word).
 * The effect is infrequent (every 2-5 minutes) to feel authentic like power fluctuations.
 * Respects prefers-reduced-motion.
 */
export function useNeonFlicker(config: FlickerConfig = {}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const {
    minInterval,
    maxInterval,
    sequenceDuration,
    maxIndividualDuration,
    borderGlowPercentage,
    textPercentage,
    enabled,
  } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const triggerFlicker = useCallback(() => {
    // Clean up any previous text wrapping
    for (const cleanup of cleanupRef.current) {
      cleanup();
    }
    cleanupRef.current = [];

    // 1. Collect border-glow elements (85% randomly selected)
    const borderGlowElements = Array.from(
      document.querySelectorAll('.border-glow')
    ).filter(() => Math.random() < borderGlowPercentage);

    // 2. Collect text nodes and wrap words (15% of words)
    const textNodes = getTextNodes();
    const wordSpans: HTMLSpanElement[] = [];

    for (const textNode of textNodes) {
      const { spans, restore } = wrapWordsForFlicker(textNode, textPercentage);
      wordSpans.push(...spans);
      cleanupRef.current.push(restore);
    }

    // Combine all elements to flicker
    const allElements: Element[] = [...borderGlowElements, ...wordSpans];

    // Stagger the start times across the sequence duration
    // Leave some buffer at the end for the last elements to complete
    const maxStartDelay = sequenceDuration - maxIndividualDuration;

    for (const el of allElements) {
      // Random start time within the sequence
      const startDelay = Math.random() * maxStartDelay;
      // Random duration up to max
      const flickerDuration = getRandomFlickerDuration(maxIndividualDuration);

      setTimeout(() => {
        el.classList.add('flickering');

        setTimeout(() => {
          el.classList.remove('flickering');
        }, flickerDuration);
      }, startDelay);
    }

    // Clean up text wrapping after sequence completes
    setTimeout(() => {
      for (const cleanup of cleanupRef.current) {
        cleanup();
      }
      cleanupRef.current = [];
    }, sequenceDuration + 100);
  }, [
    sequenceDuration,
    maxIndividualDuration,
    borderGlowPercentage,
    textPercentage,
  ]);

  const scheduleNextFlicker = useCallback(() => {
    // Random interval between min and max
    const interval = minInterval + Math.random() * (maxInterval - minInterval);

    timeoutRef.current = setTimeout(() => {
      triggerFlicker();
      scheduleNextFlicker();
    }, interval);
  }, [minInterval, maxInterval, triggerFlicker]);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!enabled || prefersReducedMotion) {
      return;
    }

    // Start the flicker cycle
    scheduleNextFlicker();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Clean up text wrapping on unmount
      for (const cleanup of cleanupRef.current) {
        cleanup();
      }
      cleanupRef.current = [];
    };
  }, [enabled, scheduleNextFlicker]);

  // Return a function to manually trigger a flicker (for testing or special effects)
  return { triggerFlicker };
}
