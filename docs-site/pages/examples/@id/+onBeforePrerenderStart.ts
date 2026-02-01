import type { OnBeforePrerenderStartAsync } from 'vike/types';
import { scanExamples } from '../../../server/utils/examples';

const onBeforePrerenderStart: OnBeforePrerenderStartAsync = async () => {
  const examples = await scanExamples();
  return examples.map((ex) => `/examples/${ex.id}`);
};

export default onBeforePrerenderStart;
