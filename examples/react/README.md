# Unleash Toolbar - React Example

This example demonstrates how to use the Unleash Toolbar with React and the official **Unleash React SDK** - minimal integration required!

## Setup

1. **Configure Unleash credentials**:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your Unleash instance URL and client key.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open the URL shown in the terminal (usually `http://localhost:5173`)

## Features Demonstrated

- ✅ **Official Unleash React SDK** integration (`useFlag`, `useVariant`, `useUnleashClient`)
- ✅ **Config-based setup** - just pass a config object, no manual client instantiation
- ✅ **No extra imports** - `UnleashToolbarProvider` includes the `FlagProvider` automatically
- ✅ Automatic re-renders when toolbar overrides change
- ✅ No manual state management or event subscriptions needed
- ✅ Clean, simple integration

## How It Works

1. Wrap your app with `UnleashToolbarProvider` and pass a `config` object (no client instantiation needed!)
2. Use standard Unleash React hooks: `useFlag('flag-name')`, `useVariant('flag-name')`, etc.
3. That's it! The toolbar wraps your client and overrides work seamlessly.

**No manual client instantiation. No extra provider imports. Just config and hooks.**

## Code Example

**Simple config-based setup:**
```jsx
import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import { useFlag, useVariant } from '@unleash/proxy-client-react';

function App() {
  return (
    <UnleashToolbarProvider
      config={{
        url: 'https://your-unleash.com/api/frontend',
        clientKey: 'your-client-key',
        appName: 'my-app'
      }}
      toolbarOptions={{ themePreset: 'dark' }}
    >
      <YourApp />
    </UnleashToolbarProvider>
  );
}

function YourApp() {
  const newCheckout = useFlag('new-checkout');
  const paymentVariant = useVariant('payment-provider');
  
  return <div>...</div>;
}
```

**That's it!** No client instantiation, no provider imports, no subscriptions.

## Benefits Over Manual Integration

- **Simpler**: Config object instead of manual `new UnleashClient()`
- **Cleaner**: No need to import and use `FlagProvider` separately
- **Compatible**: Works with all official Unleash React SDK hooks
- **Flexible**: Can still pass a pre-configured client if needed

## Testing

Try these scenarios:

1. **Flag Overrides**: Toggle flags in the toolbar and watch the UI update instantly
2. **Context Changes**: Change the userId in the toolbar to see context-based targeting
3. **Variant Testing**: Override the payment-provider variant to test different providers
4. **Reset**: Clear overrides to restore original SDK values

Enjoy! 🚀
