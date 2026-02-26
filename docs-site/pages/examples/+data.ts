import type { ScannedExample } from '@functional-examples/devkit'
import type { PageContextServer } from 'vike/types'

interface ExampleSummary {
  id: string
  title: string
  description: string
}

interface Data {
  examples: ExampleSummary[]
}

export async function data(pageContext: PageContextServer): Promise<Data> {
  const examples = pageContext.globalContext.scannedExamples
    .filter((ex: ScannedExample) => !ex.metadata.hidden)
    .map((ex: ScannedExample) => ({
      id: ex.id,
      title: ex.title,
      description: ex.description ?? '',
    }))
  return { examples }
}
