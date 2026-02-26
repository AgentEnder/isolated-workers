// functional-examples.config.ts
import { createDocumentationPlugin } from '@functional-examples/documentation'
import { createJavaScriptPlugin } from '@functional-examples/javascript'
import { createTestPlugin } from '@functional-examples/test'
import { createYamlManifestPlugin } from '@functional-examples/yaml-manifest'

export default {
  scan: { root: 'examples' },
  metadata: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['title'],
  },
  plugins: [
    createYamlManifestPlugin(),
    createJavaScriptPlugin(),
    createTestPlugin(),
    createDocumentationPlugin(),
  ],
}
