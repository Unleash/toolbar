# Unleash Toolbar - Next.js Example

This example demonstrates how to integrate the Unleash Toolbar with a Next.js App Router application using **built-in React hooks**.

## Features

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Unleash SDK integration with client-side feature flags
- **Built-in hooks** (`useFlag`, `useVariant`) - minimal integration!
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

## How It Works

1. **UnleashProvider** (`components/UnleashProvider.tsx`): 
   - Creates Unleash client
   - Wraps app with `UnleashToolbarProvider` (initializes toolbar automatically)
   - That's it - one simple wrapper!

2. **FeatureDemo** (`components/FeatureDemo.tsx`): 
   - Uses `useFlag('flag-name')` for boolean flags
   - Uses `useVariant('flag-name')` for variant flags
   - No manual subscriptions or state management needed!

3. **Layout** (`app/layout.tsx`): Wraps the app with UnleashProvider

## Integration Simplicity

**The entire integration is just 3 lines:**
```tsx
<UnleashToolbarProvider client={client} toolbarOptions={{...}}>
  {children}
</UnleashToolbarProvider>
```

**Then use hooks anywhere:**
```tsx
const newCheckout = useFlag('new-checkout');
const paymentVariant = useVariant('payment-provider');
```

No event subscriptions. No state management. Just hooks that work.

## Using the Toolbar

1. The toolbar appears at the bottom of the page
2. Click the "Flags" tab to override feature flags
3. Click the "Context" tab to override context fields
4. Changes trigger automatic re-renders
5. Overrides are persisted in localStorage
6. Refresh the page to see that overrides persist

## Feature Flags in Demo

- `new-checkout` (boolean): Enable new checkout flow
- `dark-mode` (boolean): Toggle dark mode
- `payment-provider` (variant): Select payment provider (stripe, paypal, square)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
