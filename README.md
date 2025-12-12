# Unleash Toolbar

A client-side debugging toolbar for [Unleash](https://www.getunleash.io/) feature flags. Override flag values and context in real-time without server changes.

## Features

- **Flag Overrides**: Force boolean flags ON/OFF or override variant values
- **Context Overrides**: Modify userId, sessionId, environment, and custom properties
- **Persistence**: Save overrides in memory, sessionStorage, or localStorage
- **Customizable UI**: Theming support and positioning options
- **React Support**: Built-in hooks and provider component
- **SDK Compatible**: Works with the Unleash JS SDK

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
import '@unleash/toolbar/style.css';

// Initialize toolbar with new Unleash client - returns wrapped client
const client = initUnleashToolbar(new UnleashClient({
  url: 'https://your-unleash-instance.com/api/frontend',
  clientKey: 'your-client-key',
  appName: 'my-app'
}), {
  storageMode: 'local',
  position: 'bottom',
  initiallyVisible: true
});

// Start the client
await client.start();

// Use the client for all flag evaluations
const isEnabled = client.isEnabled('my-feature');
const variant = client.getVariant('my-experiment');
```

### React

```tsx
import { UnleashToolbarProvider, useFlag, useVariant } from '@unleash/toolbar/react';
import '@unleash/toolbar/style.css';

// Wrap your app with the provider
function App() {
  return (
    <UnleashToolbarProvider 
      client={unleashClient}
      toolbarOptions={{
        storageMode: 'local',
        position: 'bottom'
      }}
    >
      <MyComponent />
    </UnleashToolbarProvider>
  );
}

// Use hooks in your components
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

### Next.js (Client Components)

```tsx
'use client';

import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import { unleashClient } from '@/lib/unleash';
import '@unleash/toolbar/style.css';

export function Providers({ children }) {
  return (
    <UnleashToolbarProvider client={unleashClient}>
      {children}
    </UnleashToolbarProvider>
  );
}
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
  
  // UI position (default: 'bottom')
  position?: 'top' | 'bottom' | 'left' | 'right';
  
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
toolbar.setFlagOverride('my-feature', { type: 'boolean', value: true });
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

// Subscribe to events
const unsubscribe = toolbar.subscribe((event) => {
  console.log(event.type, event);
});

// Cleanup
toolbar.destroy();
```

### React Hooks

```typescript
import {
  useFlag,
  useVariant,
  useUnleashClient,
  useUnleashToolbar,
  useFlagOverride,
  useContextOverride
} from '@unleash/toolbar/react';

// Check flag status
const isEnabled = useFlag('my-feature');

// Get variant
const variant = useVariant('my-experiment');

// Access wrapped client
const client = useUnleashClient();

// Access toolbar instance
const toolbar = useUnleashToolbar();

// Control specific flag
const { setOverride, clearOverride } = useFlagOverride('my-feature');
setOverride(true);  // Force ON
setOverride(false); // Force OFF
clearOverride();    // Reset to default

// Control context
const { setContext, resetContext, getState } = useContextOverride();
setContext({ userId: 'test-123' });
resetContext();
```

## Events

The toolbar emits events for state changes:

```typescript
toolbar.subscribe((event) => {
  switch (event.type) {
    case 'flag_override_changed':
      // Override was set or cleared for a specific flag
      console.log(event.name, event.override, event.timestamp);
      break;
      
    case 'context_override_changed':
      // Context was updated
      console.log(event.contextOverrides);
      break;
      
    case 'sdk_updated':
      // Flags were re-evaluated (after context change or new flag detected)
      console.log('SDK updated at', event.timestamp);
      break;
  }
});
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
