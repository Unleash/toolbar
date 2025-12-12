# Unleash Toolbar - Vue 3 Example

This example demonstrates how to integrate the Unleash Toolbar with a Vue 3 application using the Composition API.

## Setup

**IMPORTANT:** You must configure your Unleash credentials before running this example.

1. **Copy the environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` and fill in your Unleash credentials:**
   ```env
   VITE_UNLEASH_URL=https://your-unleash-instance.com/api/frontend
   VITE_UNLEASH_CLIENT_KEY=your-client-key-here
   VITE_UNLEASH_APP_NAME=unleash-toolbar-vue-demo
   ```
   
   Without these values, the app will show an error message.

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Features

- **Composition API**: Uses Vue 3's Composition API with reactive refs
- **Automatic Updates**: Subscribes to toolbar events for reactive flag updates
- **Lifecycle Management**: Clean setup/teardown with `onMounted`/`onUnmounted`
- **TypeScript**: Full TypeScript support
- **15+ Feature Flags**: Demonstrates toolbar behavior with many flags

## Integration Overview

The toolbar is initialized in `App.vue`:

```typescript
import { initUnleashToolbar } from '@unleash/toolbar'
import '@unleash/toolbar/toolbar.css'

const unleashClient = new UnleashClient({
  url: import.meta.env.VITE_UNLEASH_URL,
  clientKey: import.meta.env.VITE_UNLEASH_CLIENT_KEY,
  // ...
})

const wrappedClient = initUnleashToolbar(unleashClient, {
  themePreset: 'dark',
  initiallyVisible: false,
})
```

Flag states are managed with reactive refs and updated via toolbar event subscriptions:

```typescript
const newCheckout = ref(false)

const evaluateFlags = () => {
  newCheckout.value = wrappedClient.isEnabled('new-checkout-flow')
}

onMounted(async () => {
  await wrappedClient.start()
  evaluateFlags()
  
  // Subscribe to toolbar changes
  unsubscribe = window.unleashToolbar.subscribe((event) => {
    if (event.type === 'flag_override_changed') {
      evaluateFlags()
    }
  })
})
```

## Usage

1. Open the toolbar by clicking the purple button in the bottom-right corner
2. Toggle feature flags or change variants
3. Watch the UI update automatically in response to your changes
4. Test the search functionality with 15+ flags
5. Switch between the "Feature Flags" and "Context" tabs

## Learn More

- [Unleash Documentation](https://docs.getunleash.io/)
- [Vue 3 Documentation](https://vuejs.org/)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
