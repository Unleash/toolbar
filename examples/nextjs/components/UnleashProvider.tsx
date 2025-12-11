'use client';

import { UnleashClient } from 'unleash-proxy-client';
import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import '@unleash/toolbar/toolbar.css';

// Create Unleash client from environment variables
const client = new UnleashClient({
  url: process.env.NEXT_PUBLIC_UNLEASH_URL!,
  clientKey: process.env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY!,
  appName: process.env.NEXT_PUBLIC_UNLEASH_APP_NAME!,
  environment: 'development',
  refreshInterval: 15,
});

/**
 * Thin wrapper around UnleashToolbarProvider for Next.js App Router.
 * This is a Client Component ('use client') so it can use React hooks,
 * while keeping the layout as a Server Component.
 * 
 * For non-Next.js React apps, you can use UnleashToolbarProvider directly.
 */
export function UnleashProvider({ children }: { children: React.ReactNode }) {
  // Only enable toolbar in development mode
  const toolbarOptions = process.env.NODE_ENV !== 'production' ? {
    themePreset: 'dark' as const,
    initiallyVisible: false,
  } : undefined;

  return (
    <UnleashToolbarProvider 
      client={client}
      toolbarOptions={toolbarOptions}
    >
      {children}
    </UnleashToolbarProvider>
  );
}
