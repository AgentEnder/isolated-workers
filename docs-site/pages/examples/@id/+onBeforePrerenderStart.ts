import { scan } from 'functional-examples'
import type { OnBeforePrerenderStartAsync } from 'vike/types'
import path from 'node:path'

const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const repoRoot = path.resolve(import.meta.dirname, '../../..')
  const { examples } = await scan({ root: repoRoot })
  return examples.map((ex) => `/examples/${ex.id}`)
}

export default onBeforePrerenderStart
