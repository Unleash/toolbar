# Unleash Toolbar

A client-side debugging toolbar for [Unleash](https://www.getunleash.io/) feature flags. Override flag values and context in real-time without server changes.

## Features

- **Flag Overrides**: Force boolean flags ON/OFF or override variant values
- **Context Overrides**: Modify userId, sessionId, environment, and custom properties
- **Persistence**: Save overrides in memory, sessionStorage, or localStorage
- **Customizable UI**: Theming support and positioning options
- **React Support**: Built-in hooks and provider component
- **SDK Compatible**: Works with the Unleash JS SDK

## Bundle Size

The toolbar is optimized for minimal impact on your application:

- **JavaScript**: 27.4 KB uncompressed / 8.8 KB gzipped
- **CSS**: 10 KB uncompressed / 2.4 KB gzipped

## Installation

```bash
# note: this doesn't work yet
npm install @unleash/toolbar
```

## Quick Start

### Vanilla JavaScript

```javascript
import { initUnleashToolbar } from '@unleash/toolbar';
import { UnleashClient } from 'unleash-proxy-client';
import '@unleash/toolbar/toolbar.css';

// Initialize toolbar with new Unleash client - returns wrapped client
const client = initUnleashToolbar(new UnleashClient({
  url: 'https://your-unleash-instance.com/api/frontend',
  clientKey: 'your-client-key',
  appName: 'my-app'
}), {
  storageMode: 'local',
  position: 'bottom-right',
  initiallyVisible: true
});

// Start the client
await client.start();

// Use the client for all flag evaluations
const isEnabled = client.isEnabled('my-feature');
const variant = client.getVariant('my-experiment');

// Listen for changes (from toolbar or SDK updates)
client.on('update', () => {
  // Re-evaluate flags when overrides change
  const newValue = client.isEnabled('my-feature');
  updateUI(newValue);
});
```

### React

The toolbar integrates seamlessly with the official **`@unleash/proxy-client-react`** SDK. Just pass your configuration - the toolbar handles everything automatically!

```bash
npm install @unleash/toolbar @unleash/proxy-client-react unleash-proxy-client
```

```tsx
import { useFlag, useVariant } from '@unleash/proxy-client-react';
import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import '@unleash/toolbar/toolbar.css';

// Same config format as the official React SDK
const config = {
  url: 'https://your-unleash-instance.com/api/frontend',
  clientKey: 'your-client-key',
  appName: 'my-app',
  refreshInterval: 15
};

// That's it! No need to import FlagProvider or manage the SDK client
function App() {
  return (
    <UnleashToolbarProvider 
      config={config}
      toolbarOptions={{
        storageMode: 'local',
        position: 'bottom-right'
      }}
    >
      <MyComponent />
    </UnleashToolbarProvider>
  );
}

// Use hooks from the official React SDK - they work with toolbar overrides!
function MyComponent() {
  const isEnabled = useFlag('my-feature');
  const variant = useVariant('my-experiment');
  
  return (
    <div>
      {isEnabled && <NewFeature />}
      {variant.name === 'variant-a' && <VariantA />}
    </div>
  );
}
```

**Key Points:**
- Pass `config` directly to `UnleashToolbarProvider` - no other imports needed!
- The toolbar automatically uses `FlagProvider` from the React SDK
- Import hooks from `@unleash/proxy-client-react` (the official SDK)
- All official React SDK hooks work seamlessly with toolbar overrides

**Advanced: Custom FlagProvider or pre-instantiated client**
```tsx
import { FlagProvider } from '@unleash/proxy-client-react';
import { UnleashClient } from 'unleash-proxy-client';

// Option 1: Custom FlagProvider
<UnleashToolbarProvider 
  FlagProvider={FlagProvider}  // Optional - use if you need customization
  config={config}
>
  <MyApp />
</UnleashToolbarProvider>

// Option 2: Pre-instantiated client
const client = new UnleashClient({ /* config */ });

<UnleashToolbarProvider 
  client={client}  // Pass client instead of config
  toolbarOptions={{ /* ... */ }}
>
  <MyApp />
</UnleashToolbarProvider>
```
```

### Next.js (Client Components)

```tsx
'use client';

import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import '@unleash/toolbar/toolbar.css';

const config = {
  url: process.env.NEXT_PUBLIC_UNLEASH_URL,
  clientKey: process.env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY,
  appName: 'my-next-app'
};

export function Providers({ children }) {
  return (
    <UnleashToolbarProvider config={config}>
      {children}
    </UnleashToolbarProvider>
  );
}
```

### Vue 3 (Composition API)

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUnleash } from './composables/useUnleash'

// Initialize Unleash with the composable
const { unleashClient, isReady, updateTrigger } = useUnleash()

// Reactive flag states
const isEnabled = ref(false)

// Evaluate flags
const evaluateFlags = () => {
  if (!unleashClient.value) return
  isEnabled.value = unleashClient.value.isEnabled('my-feature')
}

// Evaluate when ready
watch(isReady, (ready) => {
  if (ready) evaluateFlags()
})
</script>
```

## Configuration Options

### `initUnleashToolbar(client, options)`

```typescript
interface InitToolbarOptions {
  // Persistence mode (default: 'local')
  // - 'local': Persists across tabs and browser restarts (RECOMMENDED for development)
  // - 'session': Persists only in current tab, cleared when tab closes
  // - 'memory': No persistence, cleared on page reload
  storageMode?: 'memory' | 'session' | 'local';
  
  // Storage key for persistence (default: 'unleash-toolbar-state')
  storageKey?: string;
  
  // UI position (default: 'bottom-right')
  // Corner positions: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  // Side positions (vertically centered): 'left' | 'right'
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right';
  
  // Initial visibility (default: false, but respects persisted state if available)
  initiallyVisible?: boolean;
  
  // Sort flags alphabetically instead of by evaluation order (default: false)
  sortAlphabetically?: boolean;
  
  // Theme preset (default: 'light')
  themePreset?: 'light' | 'dark';
  
  // Theme customization (overrides preset)
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    fontFamily?: string;
  };
  
  // Custom container element (default: document.body)
  container?: HTMLElement | null;
}
```

### Storage Modes Explained

**`local` (default)**: Best for development workflows
- ✅ Persists across all browser tabs
- ✅ Survives page reloads and browser restarts
- ✅ Set overrides once, test everywhere
- Use case: Daily feature development and debugging

**`session`**: Useful for isolated testing
- ✅ Persists within current tab only
- ✅ Survives page reloads in the same tab
- ❌ Lost when tab is closed
- Use case: Testing different configurations in multiple tabs simultaneously

**`memory`**: Temporary testing only
- ❌ Lost on every page reload
- ❌ No persistence whatsoever
- Use case: Quick one-off tests or strict security requirements

## API Reference

### Toolbar Instance

```typescript
const toolbar = window.unleashToolbar;

// Show/hide the toolbar
toolbar.show();
toolbar.hide();

// Get current state
const state = toolbar.getState();

// Set flag overrides
toolbar.setFlagOverride('my-feature', { type: 'flag', value: true });
toolbar.setFlagOverride('my-variant', { type: 'variant', variantKey: 'variant-b' });
toolbar.setFlagOverride('my-feature', null); // Clear override

// Set context overrides
toolbar.setContextOverride({
  userId: 'test-user-123',
  properties: { tier: 'premium' }
});

// Reset overrides
toolbar.resetOverrides();
toolbar.resetContextOverrides();

// Cleanup
toolbar.destroy();
```

### Listening to Changes

The toolbar automatically triggers the Unleash SDK's `'update'` event when overrides change. Use the standard SDK pattern to listen for changes:

```typescript
// Listen to flag/context changes from the toolbar
client.on('update', () => {
  console.log('Flags updated - re-evaluate your flags');
  // Re-render your UI, re-check flags, etc.
});
```

This works for both toolbar changes (flag overrides, context overrides) and SDK changes (new config from server).

### React Hooks

Use hooks from the official `@unleash/proxy-client-react` SDK - they automatically work with toolbar overrides!

```typescript
import {
  useFlag,
  useVariant,
  useUnleashClient,
  useUnleashContext,
  useFlagsStatus
} from '@unleash/proxy-client-react';

// Check flag status - updates automatically when toolbar overrides change
const isEnabled = useFlag('my-feature');

// Get variant - updates automatically when toolbar overrides change
const variant = useVariant('my-experiment');

// Access client (the wrapped client from the toolbar)
const client = useUnleashClient();

// Update context dynamically
const updateContext = useUnleashContext();
await updateContext({ userId: 'new-user-id' });

// Check loading/ready state
const { flagsReady, flagsError } = useFlagsStatus();
```

## UI Features

### Flag List Tab

- **Override Controls**: Dropdown to set boolean or variant overrides
- **Flag Info**: See default vs. effective values for each flag
- **Quick Actions**: Reset individual flag overrides

### Context Tab

- **Standard Fields**: userId, sessionId, remoteAddress, environment, appName
- **Custom Properties**: Edit or reset property values
- **Live Updates**: Changes apply immediately to all evaluations

### Header Actions

- **Reset Flags**: Clear all flag overrides
- **Reset Context**: Clear all context overrides
- **Close**: Hide the toolbar

## Theme Customization

Override CSS variables or use the theme option:

```javascript
const toolbar = initUnleashSessionToolbar({
  theme: {
    primaryColor: '#ff6b6b',
    backgroundColor: '#ffffff',
    textColor: '#2d3436',
    borderColor: '#dfe6e9',
    fontFamily: 'Inter, sans-serif'
  }
});
```

Or override CSS variables globally:

```css
:root {
  --unleash-toolbar-primary: #your-color;
  --unleash-toolbar-bg: #your-bg;
  --unleash-toolbar-text: #your-text;
  --unleash-toolbar-border: #your-border;
  --unleash-toolbar-font: your-font;
}
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run type checking
npm run type-check
```

### Example Applications

The repository includes example applications demonstrating integration with different frameworks:

- **Vanilla JS** - Basic HTML/JavaScript integration
  ```bash
  npm run serve:example
  ```

- **React** - Hooks and provider pattern
  ```bash
  npm run serve:example:react
  ```

- **Next.js** - Server-side rendering with client components
  ```bash
  npm run serve:example:nextjs
  ```

- **Angular** - Service-based integration
  ```bash
  npm run serve:example:angular
  ```

- **Vue 3** - Composition API with composables
  ```bash
  npm run serve:example:vue
  ```

All examples include:
- Environment configuration setup
- Multiple feature flags for testing
- Variant flag demonstrations
- Toolbar integration best practices

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Apache-2.0

## Links

- [Unleash Documentation](https://docs.getunleash.io/)
- [GitHub Repository](https://github.com/unleash/toolbar)
- [Report Issues](https://github.com/unleash/toolbar/issues)
