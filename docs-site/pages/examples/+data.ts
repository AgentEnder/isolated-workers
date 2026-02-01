import type { PageContextServer } from 'vike/types';
import {
  scanExamples,
  type ExampleMetadata,
} from '../../server/utils/examples';

interface Data {
  examples: ExampleMetadata[];
}

export async function data(_pageContext: PageContextServer): Promise<Data> {
  const examples = await scanExamples();
  // Filter out hidden examples from the listing page
  return { examples: examples.filter((ex) => !ex.hidden) };
}
