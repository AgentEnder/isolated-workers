import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { loadApiDocs } from '../../server/utils/typedoc';

export const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const api = await loadApiDocs();

  const urls: string[] = ['/api'];

  // Add module pages
  for (const module of Object.values(api.modules)) {
    urls.push(module.path);

    // Add export pages
    for (const exp of module.exports) {
      urls.push(exp.path);
    }
  }

  return urls;
};
