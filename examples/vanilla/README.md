# Unleash Toolbar - Vanilla JavaScript Example

This example demonstrates how to use the Unleash Toolbar with plain JavaScript (no framework).

## Features

- Pure JavaScript (no build step required)
- Unleash SDK integration via CDN
- Real-time flag updates with toolbar
- Simple configuration

## Running the Example

**From the root of the toolbar repository:**

1. **Configure Unleash credentials**:
   ```bash
   cd examples/vanilla
   cp config.example.js config.js
   ```
   Then edit `config.js` and add your Unleash instance URL and client key.

2. Run the example:
   ```bash
   npm run serve:example
   ```

3. Open http://localhost:3000/examples/vanilla in your browser

## How It Works

1. Configuration is loaded from `config.js` which sets `window.UNLEASH_CONFIG`
2. The Unleash client is created with the configuration from the window object
3. The toolbar is initialized inline using `initUnleashToolbar()`
4. Flag values are evaluated and displayed in the UI
5. Use the toolbar to override flags and see real-time updates

## Using the Toolbar

1. The toolbar appears at the bottom-right of the page
2. Click the "Flags" tab to override feature flags
3. Click the "Context" tab to override context fields
4. Changes are persisted in localStorage
5. Refresh the page to see that overrides persist

## Feature Flags in Demo

- **new-checkout-flow**: Boolean flag to enable new checkout
- **dark-mode**: Boolean flag to toggle dark theme
- **payment-provider**: Variant flag with different payment options
- **premium-features**: Boolean flag for premium content
