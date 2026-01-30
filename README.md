# isolated-workers

Type-safe worker process library for Node.js, extracting proven patterns from Nx's isolated plugin architecture.

## Status

🚧 **In Development** - This project is currently in the initial setup phase.

## Goals

- Type-safe IPC (inter-process communication) with full TypeScript inference
- Worker lifecycle management (spawn, connect, shutdown)
- Request/response pattern with timeout support
- Cross-platform support (Unix domain sockets / named pipes)
- Developer-friendly API with clear error messages

## Development

This is an Nx monorepo managed with pnpm.

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build packages
pnpm build

# Run development server (docs)
pnpm dev

# Show project graph
npx nx graph
```

## Documentation

Full documentation is available at: `./docs`

See [`AGENTS.md`](./AGENTS.md) for development guidelines and context for AI agents.

See [`.ai/design-decisions/`](./.ai/design-decisions/) for architecture decisions.

See [`.ai/plans/`](./.ai/plans/) for implementation plans.

## License

MIT
