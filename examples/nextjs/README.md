# Unleash Toolbar - Next.js Example

This example demonstrates how to integrate the Unleash Toolbar with a Next.js App Router application for both **client-side and server-side rendering**.

## Features

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- **Client-side integration** with config-based API (no manual client instantiation!)
- **Server-side support** via cookie-based override sync
- Built-in hooks (`useFlag`, `useVariant`) from `@unleash/toolbar/next`
- Override Toolbar for testing flags locally

## Running the Example

1. **Configure Unleash credentials**:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your Unleash instance URL and client key.

2. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Integration Patterns

### Client Components

Simple, direct integration - use `UnleashToolbarProvider` directly in your root layout:

```tsx
// app/layout.tsx
import { UnleashToolbarProvider } from '@unleash/toolbar/next';
import '@unleash/toolbar/toolbar.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <UnleashToolbarProvider 
          config={{
            url: process.env.NEXT_PUBLIC_UNLEASH_URL,
            clientKey: process.env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY,
            appName: 'my-app'
          }}
          toolbarOptions={{ themePreset: 'dark' }}
        >
          {children}
        </UnleashToolbarProvider>
      </body>
    </html>
  );
}
```

Then use hooks in any client component:

```tsx
'use client';
import { useFlag, useVariant } from '@unleash/toolbar/next';

export function MyComponent() {
  const newCheckout = useFlag('new-checkout');
  const paymentVariant = useVariant('payment-provider');
  
  return <div>...</div>;
}
```

### Server Components (Requires @unleash/nextjs SDK)

For server-side rendering with toolbar overrides:

```tsx
import { cookies } from 'next/headers';
import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
import { applyToolbarOverrides } from '@unleash/toolbar/next/server';

export default async function ServerPage() {
  const cookieStore = await cookies();
  const definitions = await getDefinitions();
  
  // Apply toolbar overrides to definitions
  const modifiedDefinitions = applyToolbarOverrides(definitions, cookieStore);
  
  const { toggles } = evaluateFlags(modifiedDefinitions, {
    sessionId: 'session-123'
  });
  
  const flags = flagsClient(toggles);
  const isEnabled = flags.isEnabled('my-flag');
  
  return <div>{isEnabled ? 'ON' : 'OFF'}</div>;
}
```

Visit `/server-demo` to see server component documentation.

## How It Works

1. **Client-side**: Toolbar wraps the Unleash client and stores overrides in localStorage + cookies
2. **Server-side**: `applyToolbarOverrides()` reads from cookies and modifies flag definitions before evaluation
3. **Sync**: Client changes sync to cookies automatically, server picks them up on next request
4. **FOUC**: Accept Flash of Unstyled Content (server renders original, client updates) - fine for dev tooling

## Using the Toolbar

1. The toolbar appears at the bottom of the page
2. Click the "Flags" tab to override feature flags
3. Click the "Context" tab to override context fields
4. Changes trigger automatic re-renders in client components
5. Server components receive overrides on next page load
6. Overrides persist across page reloads via localStorage + cookies

## Feature Flags in Demo

- `new-checkout` (boolean): Enable new checkout flow
- `dark-mode` (boolean): Toggle dark mode
- `payment-provider` (variant): Select payment provider (stripe, paypal, square)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

**Note**: Disable the toolbar in production by setting `toolbarOptions={undefined}` or using environment checks.
