export function CodePreview() {
  return (
    <div className="rounded-lg overflow-hidden border border-tertiary/50 bg-tertiary/80 shadow-neon-sm">
      <div className="px-4 py-2 bg-tertiary border-b border-tertiary/50 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-2 text-xs text-gray-500">messages.ts</span>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className="font-mono">
          <span className="text-neon-purple">import</span>{' '}
          <span className="text-gray-300">{`{ DefineMessages }`}</span>{' '}
          <span className="text-neon-purple">from</span>{' '}
          <span className="text-neon-mint">{`'isolated-workers'`}</span>
          {'\n\n'}
          <span className="text-neon-purple">export type</span>{' '}
          <span className="text-yellow-300">Messages</span>{' '}
          <span className="text-gray-300">{`= DefineMessages<{\n`}</span>
          <span className="text-gray-300">{`  ping: {\n`}</span>
          <span className="text-gray-300">{`    payload: { message: string };\n`}</span>
          <span className="text-gray-300">{`    result: { message: string };\n`}</span>
          <span className="text-gray-300">{`  };\n`}</span>
          <span className="text-gray-300">{`}>;\n`}</span>
        </code>
      </pre>
    </div>
  );
}
