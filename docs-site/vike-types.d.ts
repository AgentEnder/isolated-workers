import { type ExampleMetadata } from './server/utils/examples';

interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
}

declare global {
  namespace Vike {
    interface GlobalContext {
      examples: Record<string, ExampleMetadata>;
      navigation: NavigationItem[];
    }
  }
}
