import vikeReact from 'vike-react/config';
import type { Config } from 'vike/types';

// Default config (can be overridden by pages)
// https://vike.dev/config

export default {
  // https://vike.dev/head-tags
  title: 'isolated-workers',
  description: 'Type-safe worker processes with end-to-end message contracts',

  // Enable static site generation
  prerender: true,
  passToClient: ['navigation', 'examples'],

  extends: [vikeReact],
} satisfies Config;
