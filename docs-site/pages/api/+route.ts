import { PageContext } from 'vike/types';

export function route(pageContext: PageContext) {
  const { urlPathname } = pageContext;

  // Match /api, /api/:module, /api/:module/:export
  if (urlPathname === '/api' || urlPathname.startsWith('/api/')) {
    return true;
  }

  return false;
}
