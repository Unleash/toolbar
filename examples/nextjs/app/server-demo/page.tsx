import { cookies } from 'next/headers';
import { getToolbarStateFromCookies } from '@unleash/toolbar/next/server';

/**
 * Server Component demo for Unleash Toolbar + Next.js
 * 
 * This demonstrates how toolbar overrides are accessible in Next.js Server Components.
 * The toolbar syncs client-side overrides to cookies, which server components can read.
 * 
 * To apply overrides to actual flag evaluations with @unleash/nextjs SDK:
 * 
 * import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
 * import { applyToolbarOverrides } from '@unleash/toolbar/next/server';
 * 
 * const definitions = await getDefinitions();
 * const modified = applyToolbarOverrides(definitions, await cookies());
 * const { toggles } = evaluateFlags(modified, { sessionId: '123' });
 * const flags = flagsClient(toggles);
 */
export default async function ServerComponentDemo() {
  const cookieStore = await cookies();
  const toolbarState = getToolbarStateFromCookies(cookieStore);
  
  const hasOverrides = toolbarState && Object.keys(toolbarState.flags).length > 0;
  const flagCount = toolbarState ? Object.keys(toolbarState.flags).length : 0;
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-8">
      <main className="flex flex-col items-center gap-8 max-w-3xl">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-black dark:text-white">
            Server Component Demo
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            This Next.js Server Component reads toolbar state from cookies.
          </p>
        </div>
        
        <div className="w-full space-y-6">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <h2 className="text-2xl font-semibold text-black dark:text-white">
              Server-Side Toolbar State
            </h2>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                hasOverrides
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
              }`}>
                {hasOverrides ? `${flagCount} Flags${flagCount !== 1 ? 's' : ''}` : 'No Flags'}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {hasOverrides
                ? 'Server component successfully read toolbar state from cookies!'
                : 'No flags detected. Go to the home page and set some flags using the toolbar.'}
            </p>
          </div>

          {hasOverrides && toolbarState && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
              <h3 className="text-lg font-medium text-black dark:text-white">
                Flags Detected
              </h3>
              <div className="space-y-3">
                {Object.entries(toolbarState.flags).map(([flagName, metadata]) => (
                  <div key={flagName} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
                    <code className="text-sm font-mono text-black dark:text-white">
                      {flagName}
                    </code>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {metadata.override?.type === 'flag' 
                        ? `Override: ${metadata.override.value ? 'ON' : 'OFF'}`
                        : metadata.override?.type === 'variant'
                        ? `Variant: ${metadata.override.variantKey}`
                        : 'No override'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-6 space-y-4">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
              📦 Using with @unleash/nextjs
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              To apply these overrides to actual flag evaluations, use applyToolbarOverrides():
            </p>
            <pre className="bg-blue-100 dark:bg-blue-900 rounded p-3 text-xs text-blue-900 dark:text-blue-100 overflow-x-auto font-mono">
              {`import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
import { applyToolbarOverrides } from '@unleash/toolbar/next/server';

const definitions = await getDefinitions();
const modified = applyToolbarOverrides(definitions, await cookies());
const { toggles } = evaluateFlags(modified, context);
const flags = flagsClient(toggles);`}
            </pre>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-medium text-black dark:text-white mb-3">
              How It Works
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Client-side toolbar sets overrides in localStorage</li>
              <li>Overrides are automatically synced to cookies (7-day expiration)</li>
              <li>Server components read cookies using getToolbarStateFromCookies()</li>
              <li>applyToolbarOverrides() modifies flag definitions before evaluation</li>
              <li>Server renders with overridden values (accepts FOUC on first load)</li>
            </ol>
          </div>

          <div className="flex gap-4">
            <a
              href="/"
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              ← Back to Client Demo
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
