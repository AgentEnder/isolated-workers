import type { ScannedExample } from '@functional-examples/devkit'
import type { DocMetadata } from './server/utils/docs.js'

export interface NavigationItem {
  title: string
  path?: string
  children?: NavigationItem[]
  order?: number
}

declare global {
  namespace Vike {
    interface GlobalContext {
      scannedExamples: ScannedExample[]
      docs: Record<string, DocMetadata>
      navigation: NavigationItem[]
    }
  }
}

export { NavigationItem }
