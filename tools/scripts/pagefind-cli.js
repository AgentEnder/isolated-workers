#!/usr/bin/env node
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');
const path = require('path');

class PagefindCLI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.pagefindPath = path.join(this.baseUrl, 'pagefind');
    this.entry = null;
    this.metadata = null;
    this.loadedChunks = new Map();
    this.loadedFragments = new Map();
  }

  async fetch(url) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const requestOptions = {
        headers: {
          'User-Agent': 'pagefind-cli/0.1.0',
          Accept: '*/*',
        },
      };

      const req = lib.get(url, requestOptions, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return this.fetch(res.headers.location).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(
            new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`)
          );
        }

        let data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      });

      req.on('error', reject);
    });
  }

  decompress(buffer) {
    const signature = buffer.subarray(0, 12).toString();
    if (signature === 'pagefind_dcd') {
      return buffer.subarray(12);
    }

    const decompressed = zlib.gunzipSync(buffer);
    const decompressedSignature = decompressed.subarray(0, 12).toString();

    if (decompressedSignature === 'pagefind_dcd') {
      return decompressed.subarray(12);
    }

    throw new Error('Invalid Pagefind data format');
  }

  async loadEntry() {
    const url = `${this.pagefindPath}/pagefind-entry.json`;
    const data = await this.fetch(url);
    this.entry = JSON.parse(data.toString());
    console.log(
      `Loaded Pagefind v${this.entry.version} with ${
        Object.keys(this.entry.languages).length
      } language(s)`
    );
  }

  async loadMeta(language = 'en') {
    if (!this.entry) {
      await this.loadEntry();
    }

    const langInfo = this.entry.languages[language];
    if (!langInfo) {
      throw new Error(
        `Language '${language}' not found. Available: ${Object.keys(
          this.entry.languages
        ).join(', ')}`
      );
    }

    const url = `${this.pagefindPath}/pagefind.${langInfo.hash}.pf_meta`;
    const compressed = await this.fetch(url);
    this.metadata = JSON.parse(this.decompress(compressed).toString());
    console.log(
      `Loaded metadata with ${
        Object.keys(this.metadata.fragments || {}).length
      } fragments`
    );
  }

  async loadFragment(hash) {
    if (this.loadedFragments.has(hash)) {
      return this.loadedFragments.get(hash);
    }

    const url = `${this.pagefindPath}/fragment/${hash}.pf_fragment`;
    const compressed = await this.fetch(url);
    const fragment = JSON.parse(this.decompress(compressed).toString());
    this.loadedFragments.set(hash, fragment);
    return fragment;
  }

  async loadIndexChunk(hash) {
    if (this.loadedChunks.has(hash)) {
      return this.loadedChunks.get(hash);
    }

    const url = `${this.pagefindPath}/index/${hash}.pf_index`;
    const compressed = await this.fetch(url);
    const decompressed = this.decompress(compressed);
    this.loadedChunks.set(hash, decompressed);
    return decompressed;
  }

  simpleSearch(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    if (!this.metadata?.fragments) {
      return results;
    }

    for (const [hash, fragment] of Object.entries(this.metadata.fragments)) {
      if (!fragment.meta) continue;

      const title = fragment.meta.title?.toLowerCase() || '';
      const content = fragment.content?.toLowerCase() || '';

      let score = 0;
      if (title.includes(queryLower)) score += 10;
      if (content.includes(queryLower)) score += 1;

      if (score > 0) {
        results.push({
          hash,
          score,
          title: fragment.meta.title,
          url: fragment.url,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async search(query, options = {}) {
    if (!this.metadata) {
      await this.loadMeta(options.language);
    }

    console.log(`Searching for: "${query}"`);
    const results = this.simpleSearch(query);

    if (results.length === 0) {
      console.log('No results found');
      return;
    }

    console.log(`\nFound ${results.length} result(s):\n`);

    const maxResults = options.limit || 10;
    for (const result of results.slice(0, maxResults)) {
      console.log(`[${result.score}] ${result.title}`);
      console.log(`    URL: ${result.url}`);

      if (options.excerpt) {
        try {
          const fragment = await this.loadFragment(result.hash);
          const excerpt = this.generateExcerpt(fragment.content, query);
          console.log(`    ${excerpt}...`);
        } catch (err) {
          console.log(`    [Could not load excerpt]`);
        }
      }
      console.log();
    }

    if (results.length > maxResults) {
      console.log(`... and ${results.length - maxResults} more results`);
    }
  }

  generateExcerpt(content, query, maxLength = 200) {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    const index = contentLower.indexOf(queryLower);
    if (index === -1) {
      return content.slice(0, maxLength);
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);

    let excerpt = content.slice(start, end);
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  async init(language = 'en') {
    await this.loadEntry();
    await this.loadMeta(language);
  }

  async filters() {
    if (!this.metadata) {
      await this.loadMeta();
    }
    return this.metadata.filters || {};
  }

  info() {
    if (!this.entry) {
      console.log('Not initialized. Run init first.');
      return;
    }

    console.log(`Pagefind v${this.entry.version}`);
    console.log(`Languages: ${Object.keys(this.entry.languages).join(', ')}`);
    console.log(`Base URL: ${this.pagefindPath}`);

    if (this.metadata) {
      console.log(
        `Fragments: ${Object.keys(this.metadata.fragments || {}).length}`
      );
      console.log(
        `Filters: ${Object.keys(this.metadata.filters || {}).length}`
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const baseUrlArg = args.find((a) => a.startsWith('--url='));
  const baseUrl = baseUrlArg ? baseUrlArg.slice(6) : 'https://nx.dev/docs';
  const cli = new PagefindCLI(baseUrl);

  try {
    switch (command) {
      case 'init': {
        const lang =
          args.find((a) => a.startsWith('--lang='))?.slice(7) || 'en';
        await cli.init(lang);
        break;
      }

      case 'search': {
        const query = args[1];
        if (!query) {
          console.error(
            'Usage: search <query> [--lang=en] [--excerpt] [--limit=10]'
          );
          process.exit(1);
        }

        const lang =
          args.find((a) => a.startsWith('--lang='))?.slice(7) || 'en';
        const excerpt = args.includes('--excerpt');
        const limit = parseInt(
          args.find((a) => a.startsWith('--limit='))?.slice(7) || '10'
        );

        await cli.search(query, { language: lang, excerpt, limit });
        break;
      }

      case 'filters': {
        await cli.init();
        const filters = await cli.filters();
        console.log('Available filters:');
        for (const [key, values] of Object.entries(filters)) {
          console.log(`  ${key}: ${Object.keys(values).join(', ')}`);
        }
        break;
      }

      case 'info': {
        await cli.init();
        cli.info();
        break;
      }

      default:
        console.log('Pagefind CLI - Search documentation sites locally');
        console.log('');
        console.log('Usage:');
        console.log('  node pagefind-cli.js <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  init [--lang=<code>]     Initialize the search index');
        console.log('  search <query> [--options] Search for a query');
        console.log('  filters                   List available filters');
        console.log('  info                      Show index information');
        console.log('');
        console.log('Options:');
        console.log(
          '  --url=<url>               Base URL of the site (default: https://nx.dev/docs)'
        );
        console.log('  --lang=<code>             Language code (default: en)');
        console.log(
          '  --excerpt                 Show excerpt from each result'
        );
        console.log(
          '  --limit=<number>          Maximum results to show (default: 10)'
        );
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PagefindCLI;
