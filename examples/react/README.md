# Unleash Toolbar - React Example

This example demonstrates how to use the Unleash Toolbar with React using **built-in hooks** - minimal integration required!

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

- ✅ **Built-in React hooks** (`useFlag`, `useVariant`) - no manual subscriptions!
- ✅ **UnleashToolbarProvider** - wraps your app in one line
- ✅ Automatic re-renders when toolbar overrides change
- ✅ No manual state management or event subscriptions needed
- ✅ Clean, simple integration

## How It Works

1. Wrap your app with `UnleashToolbarProvider` (handles client initialization and toolbar setup)
2. Use `useFlag('flag-name')` to get boolean flags
3. Use `useVariant('flag-name')` to get variant flags
4. That's it! Overrides automatically trigger re-renders.

**No manual subscriptions. No state management. Just hooks.**

## Code Comparison

**Without built-in hooks (❌ verbose):**
```jsx
const [flags, setFlags] = useState({});
useEffect(() => {
  const updateFlags = () => setFlags({...});
  const unsubscribe = toolbar.subscribe(updateFlags);
  return () => unsubscribe();
}, []);
```

**With built-in hooks (✅ simple):**
```jsx
const newCheckout = useFlag('new-checkout');
const paymentVariant = useVariant('payment-provider');
```

## Testing

Try these scenarios:

1. **Flag Overrides**: Toggle flags in the toolbar and watch the UI update instantly
2. **Context Changes**: Change the userId in the toolbar to see context-based targeting
3. **Variant Testing**: Override the payment-provider variant to test different providers
4. **Reset**: Clear overrides to restore original SDK values

Enjoy! 🚀
