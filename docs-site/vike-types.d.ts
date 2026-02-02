import { type DocMetadata } from './server/utils/docs';
import { type ExampleMetadata } from './server/utils/examples';
import { type ApiDocs } from './server/utils/typedoc';

export interface NavigationItem {
  title: string;
  path?: string;
  children?: NavigationItem[];
  order?: number;
}

declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      docs: Record<string, DocMetadata>;
      api: ApiDocs;
      navigation: NavigationItem[];
    }
  }
}

export { NavigationItem };
