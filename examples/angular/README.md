# Unleash Toolbar - Angular Example

This example demonstrates how to integrate the Unleash Toolbar with an Angular application.

## Features

- Angular 21 with standalone components
- TypeScript
- Unleash SDK integration with feature flags
- Override Toolbar for testing flags locally

## Running the Example

1. **Configure Unleash credentials**:
   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```
   Then edit `src/environments/environment.ts` and add your Unleash instance URL and client key.

2. Start the dev server:
   ```bash
   npm start
   ```

The app will be available at http://localhost:4200

## How It Works

1. **UnleashService** (`src/app/unleash.service.ts`): Initializes the Unleash client and toolbar
   - Creates and starts the Unleash client
   - Wraps client with toolbar on initialization
   - Provides methods to check flags and subscribe to events

2. **App Component** (`src/app/app.ts`): Main component demonstrating feature flag usage
   - Shows boolean flags (new-checkout, dark-mode, premium-features)
   - Shows variant flag (payment-provider)
   - Updates UI when flags change via toolbar subscriptions

3. **Global Styles** (`src/styles.css`): Imports toolbar CSS

## Using the Toolbar

1. The toolbar appears at the bottom of the page
2. Click the "Flags" tab to override feature flags
3. Click the "Context" tab to override context fields
4. Changes are persisted in localStorage
5. Refresh the page to see that overrides persist

## Feature Flags in Demo

- `new-checkout` (boolean): Enable new checkout flow
- `dark-mode` (boolean): Toggle dark mode
- `payment-provider` (variant): Select payment provider (stripe, paypal, square)
- `premium-features` (boolean): Enable premium features
