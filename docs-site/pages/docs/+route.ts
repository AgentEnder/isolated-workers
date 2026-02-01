import { PageContext } from 'vike/types';

export function route(pageContext: PageContext) {
  const match = pageContext.urlPathname.startsWith('/docs/')
    ? true
    : pageContext.urlPathname === '/docs';
  if (match) {
    return match;
  }
  return false;
}
