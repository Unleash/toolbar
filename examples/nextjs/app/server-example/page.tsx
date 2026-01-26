import { cookies } from 'next/headers';
import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
import type { IToggle } from '@unleash/nextjs';
import type { ClientFeaturesResponse } from 'unleash-client';
import { applyToolbarOverrides } from '@unleash/toolbar/next/server';

/**
 * Full example of server-side rendering with Unleash and Toolbar
 * 
 * This demonstrates the recommended pattern:
 * 1. Fetch definitions from Unleash API (using env configuration)
 * 2. Apply toolbar overrides from cookies
 * 3. Evaluate flags with context
 * 4. Use flagsClient for checking flags
 * 
 * Environment variables used by @unleash/nextjs:
 * - UNLEASH_SERVER_API_URL or NEXT_PUBLIC_UNLEASH_SERVER_API_URL
 * - UNLEASH_SERVER_API_TOKEN
 * - UNLEASH_APP_NAME or NEXT_PUBLIC_UNLEASH_APP_NAME
 */
export default async function ServerExample() {
  // Get definitions from Unleash (uses env configuration automatically)
  const definitions = await getDefinitions({
    fetchOptions: { next: { revalidate: 15 } },
  }) as ClientFeaturesResponse;

  // Apply toolbar overrides from cookies
  const cookieStore = await cookies();
  const modifiedDefinitions = applyToolbarOverrides(definitions, cookieStore);

  // Evaluate flags with context
  const { toggles } = evaluateFlags(modifiedDefinitions, {
    sessionId: 'demo-session',
    userId: 'demo-user',
  });

  // Create offline client with evaluated toggles
  const flags = flagsClient(toggles);

  // Check flags
  const newCheckoutEnabled = flags.isEnabled('new-checkout');
  const darkModeEnabled = flags.isEnabled('dark-mode');
  const paymentVariant = flags.getVariant('payment-provider');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-8">
      <main className="flex flex-col items-center gap-8 max-w-4xl">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-black dark:text-white">
            Server-Side Example
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            This page uses @unleash/nextjs SDK with toolbar overrides
          </p>
        </div>

        <div className="w-full grid gap-6 md:grid-cols-2">
          <FlagCard
            name="new-checkout"
            enabled={newCheckoutEnabled}
            description="New checkout flow"
          />
          <FlagCard
            name="dark-mode"
            enabled={darkModeEnabled}
            description="Dark mode theme"
          />
          <VariantCard
            name="payment-provider"
            variant={paymentVariant.enabled ? paymentVariant.name : 'default'}
            description="Payment provider selection"
          />
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-6 space-y-3 w-full">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            💡 How It Works
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
            <li>Server fetches definitions from Unleash API (env configured)</li>
            <li>Toolbar overrides are applied from cookies</li>
            <li>Flags are evaluated with context (user, session, etc.)</li>
            <li>Offline client is created for flag checks</li>
            <li>Changes in toolbar automatically sync via cookies</li>
          </ol>
        </div>

        <a
          href="/"
          className="px-6 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          ← Back to Home
        </a>
      </main>
    </div>
  );
}

function FlagCard({ name, enabled, description }: { name: string; enabled: boolean; description: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-black dark:text-white font-mono">
          {name}
        </h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          enabled 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
        }`}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function VariantCard({ name, variant, description }: { name: string; variant: string; description: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 md:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-black dark:text-white font-mono">
          {name}
        </h3>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {variant}
        </span>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
