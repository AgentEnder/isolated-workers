import { type ExampleMetadata } from './server/utils/examples';
import { type DocMetadata } from './server/utils/docs';

export interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
}

declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      docs: Record<string, DocMetadata>;
      navigation: NavigationItem[];
    }
  }
}

export { NavigationItem };
