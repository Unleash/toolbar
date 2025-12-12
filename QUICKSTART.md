# Quick Start Guide

## Installation

```bash
npm install @unleash/toolbar
```

## 5-Minute Setup

### 1. Vanilla JavaScript/TypeScript

```typescript
import { initUnleashToolbar } from '@unleash/toolbar';
import '@unleash/toolbar/toolbar.css';
import { UnleashClient } from 'unleash-proxy-client';

// Initialize toolbar with new client - get wrapped client back immediately
const client = initUnleashToolbar(new UnleashClient({
  url: 'https://your-unleash.com/api/frontend',
  clientKey: 'your-key',
  appName: 'my-app'
}));

// Start the client
await client.start();

// Use the wrapped client for all flag checks
if (client.isEnabled('my-feature')) {
  // Feature is enabled
}

// Listen for changes (from toolbar or SDK updates)
client.on('update', () => {
  // Re-evaluate flags when overrides change
  const newValue = client.isEnabled('my-feature');
  updateUI(newValue);
});
```

### 2. React

```tsx
// In your root component (App.tsx or layout)
import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import '@unleash/toolbar/toolbar.css';

function App() {
  return (
    <UnleashToolbarProvider client={unleashClient}>
      {/* Your app */}
    </UnleashToolbarProvider>
  );
}

// In your components
import { useFlag } from '@unleash/toolbar/react';

function MyComponent() {
  const isEnabled = useFlag('my-feature');
  
  return isEnabled ? <NewFeature /> : <OldFeature />;
}
```

### 3. Next.js App Router

```tsx
// app/providers.tsx
'use client';

import { UnleashToolbarProvider } from '@unleash/toolbar/react';
import { unleashClient } from '@/lib/unleash';

export function Providers({ children }) {
  return (
    <UnleashToolbarProvider client={unleashClient}>
      {children}
    </UnleashToolbarProvider>
  );
}

// app/layout.tsx
import { Providers } from './providers';
import '@unleash/toolbar/toolbar.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// In any client component
'use client';
import { useFlag } from '@unleash/toolbar/react';

export function MyComponent() {
  const isEnabled = useFlag('my-feature');
  // ...
}
```

## How to Use

### Step 1: Evaluate Flags
Click around your app to trigger feature flag evaluations. The toolbar automatically detects and displays all evaluated flags.

### Step 2: Open the Toolbar
Look for the toolbar in the bottom-right corner (or wherever you positioned it). It shows:
- All evaluated flags
- Their current values (default vs. effective)

### Step 3: Override Values

**For Boolean Flags:**
- Select "Force ON" to enable the flag
- Select "Force OFF" to disable the flag
- Select "Default" to remove the override

**For Variant Flags:**
- Select "Override Variant"
- Enter the variant name you want to test

### Step 4: Override Context
Switch to the "Context" tab to modify:
- User ID
- Session ID
- Custom properties

All changes apply immediately!

## Configuration

```typescript
const client = initUnleashToolbar(new UnleashClient({...}), {
  // Where to persist overrides (default: 'local')
  storageMode: 'local',  // 'memory' | 'session' | 'local'
  
  // Storage key (default: 'unleash-toolbar-state')
  storageKey: 'my-custom-key',
  
  // UI position (default: 'bottom')
  position: 'bottom',  // 'top' | 'bottom' | 'left' | 'right'
  
  // Start visible or hidden (default: true, respects persisted state)
  initiallyVisible: false,
  
  // Sort flags alphabetically (default: false)
  sortAlphabetically: true,
  
  // Theme preset (default: 'light')
  themePreset: 'dark',  // 'light' | 'dark'
  
  // Custom theme colors (overrides themePreset)
  theme: {
    primaryColor: '#your-color',
    backgroundColor: '#your-bg',
    textColor: '#your-text',
    borderColor: '#your-border',
    fontFamily: 'Your Font'
  },
  
  // Custom container element (default: document.body)
  container: document.getElementById('my-container')
});
```

## Common Use Cases

### Testing a Feature Toggle
1. Evaluate the flag in your app
2. Open toolbar → find the flag
3. Force it ON or OFF
4. See the change immediately

### Testing Different User Contexts
1. Go to Context tab
2. Change userId to a test user
3. All flags re-evaluate with new context
4. Test user-specific rollouts

### Testing Variants
1. Evaluate a variant flag
2. Override with different variant names
3. Test all experiment variations

### Persistent Testing
1. Use `storageMode: 'local'`
2. Set overrides once
3. Refresh page - overrides persist
4. Great for ongoing development

## Troubleshooting

### Toolbar Not Showing
- Check that you imported the CSS: `import '@unleash/toolbar/toolbar.css'`
- Try calling `window.unleashToolbar.show()`
- Check browser console for errors

### Overrides Not Working
- Make sure you're using the wrapped client
- Check that flags are being evaluated (they should appear in the toolbar)
- Verify overrides are set (they show up in the toolbar UI)

### React Hooks Not Re-rendering
- Ensure you're using hooks from `@unleash/toolbar/react`
- Verify you wrapped your app with `<UnleashToolbarProvider>`
- Check that the client is properly passed to the provider
- The provider automatically listens to `client.on('update')` events

## Next Steps

- Read the [full README](./README.md) for complete API documentation
- Check the [examples](./examples/) folder for working demos
- Explore the TypeScript types for full API details

## Support

- [GitHub Issues](https://github.com/unleash/toolbar/issues)
- [Unleash Docs](https://docs.getunleash.io/)
