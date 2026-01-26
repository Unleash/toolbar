'use client';

import { useFlag, useVariant } from '@unleash/toolbar/next';

export function FeatureDemo() {
  // Use hooks from toolbar/next - they automatically handle re-renders on override changes!
  const newCheckout = useFlag('new-checkout');
  const darkMode = useFlag('dark-mode');
  const paymentVariant = useVariant('payment-provider');

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
        <h2 className="text-2xl font-semibold text-black dark:text-white">
          Feature Flags Demo
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Try overriding these flags using the toolbar at the bottom of the page.
          Changes trigger automatic re-renders!
        </p>
      </div>

      <div className="space-y-4">
        <FlagCard
          name="new-checkout"
          enabled={newCheckout}
          description="Enable the new checkout flow with improved UX"
        />
        <FlagCard
          name="dark-mode"
          enabled={darkMode}
          description="Toggle dark mode theme"
        />
        <VariantCard
          name="payment-provider"
          variant={paymentVariant.enabled ? paymentVariant.name || 'default' : 'default'}
          description="Select payment provider (stripe, paypal, square)"
        />
      </div>
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
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
