import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { loadApiDocs } from '../../server/utils/typedoc';

export const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const api = await loadApiDocs();

  const urls: string[] = ['/api'];

  // Add individual export pages
  for (const exp of api.allExports) {
    urls.push(exp.path);
  }

  return urls;
};
