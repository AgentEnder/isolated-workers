#!/usr/bin/env node

// Shim window and location for basePath resolution
global.window = undefined
global.document = undefined

class PagefindCLI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://nx.dev/docs';
    this.pagefindPath = `${this.baseUrl.replace(/\/$/, '')}/pagefind`;
    this.initialized = false;
  }

  async init(language = 'en') {
    if (this.initialized) {
      return this;
    }

    // Dynamically import Pagefind as ES module
    this.pagefindModule = await this.loadPagefind();
    this.pagefindModule.options({
      basePath: this.pagefindPath,
      baseUrl: this.baseUrl,
    });
    await this.pagefindModule.init(language);
    this.initialized = true;
    console.log(`Pagefind initialized for language: ${language}`);

    return this;
  }

  async loadPagefind() {
    const path = require('path');
    const fs = require('fs');
    const { fileURLToPath } = require('url');

    // Download pagefind.js if not cached
    const cacheDir = path.join(__dirname, '.cache');
    const pagefindPath = path.join(cacheDir, 'pagefind.js');
    const pagefindUrl = `${this.pagefindPath}/pagefind.js`;

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (!fs.existsSync(pagefindPath)) {
      console.log(`Downloading Pagefind from ${pagefindUrl}...`);
      const response = await fetch(pagefindUrl);
      if (!response.ok) {
        throw new Error(`Failed to download Pagefind: ${response.status}`);
      }
      const content = await response.text();
      fs.writeFileSync(pagefindPath, content);
      console.log('Pagefind downloaded');
    }

    // Import as ES module using dynamic import
    // Use proper file URL format
    const fileUrl = `file://localhost${pagefindPath}`;
    return await import(fileUrl);
  }

  async search(query, options = {}) {
    if (!this.initialized) {
      await this.init(options.language);
    }

    console.log(`Searching for: "${query}"`);
    const result = await this.pagefindModule.search(query, options);

    if (result.results.length === 0) {
      console.log('No results found');
      return result;
    }

    console.log(`\nFound ${result.results.length} result(s):\n`);

    const maxResults = options.limit || 10;
    for (const r of result.results.slice(0, maxResults)) {
      const data = await r.data();

      console.log(`[${r.score.toFixed(2)}] ${data.meta.title}`);
      console.log(`    URL: ${data.url}`);

      if (options.excerpt && data.excerpt) {
        console.log(
          `    ${data.excerpt.replace(/<[^>]*>/g, '').substring(0, 150)}...`
        );
      }
      console.log();
    }

    if (result.results.length > maxResults) {
      console.log(`... and ${result.results.length - maxResults} more results`);
    }

    return result;
  }

  async filters() {
    if (!this.initialized) {
      await this.init();
    }

    const filters = await this.pagefindModule.filters();
    console.log('Available filters:');
    for (const [key, values] of Object.entries(filters)) {
      console.log(`  ${key}: ${Object.keys(values).join(', ')}`);
    }

    return filters;
  }

  async info() {
    if (!this.initialized) {
      await this.init();
    }

    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Pagefind path: ${this.pagefindPath}`);
    console.log(`Initialized: ${this.initialized}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const baseUrlArg = args.find((a) => a.startsWith('--url='));
  const baseUrl = baseUrlArg ? baseUrlArg.slice(6) : 'https://nx.dev/docs';
  const cli = new PagefindCLI({ baseUrl });

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
        await cli.filters();
        break;
      }

      case 'info': {
        await cli.info();
        break;
      }

      default:
        console.log(
          'Pagefind CLI - Search documentation sites locally using WASM'
        );
        console.log('');
        console.log('Usage:');
        console.log('  node pagefind-wasm.js <command> [options]');
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
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PagefindCLI;
