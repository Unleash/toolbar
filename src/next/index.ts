/**
 * Next.js integration for Unleash Toolbar
 *
 * This package provides both client-side and server-side integration for Next.js:
 *
 * - Client-side: `@unleash/toolbar/next` (same as React integration)
 * - Server-side: `@unleash/toolbar/next/server` (for App Router server components)
 *
 * @example Client Component
 * ```tsx
 * 'use client';
 * import { UnleashToolbarProvider, useFlag } from '@unleash/toolbar/next';
 *
 * export function MyComponent() {
 *   return (
 *     <UnleashToolbarProvider config={{ ... }}>
 *       <App />
 *     </UnleashToolbarProvider>
 *   );
 * }
 * ```
 *
 * @example Server Component
 * ```tsx
 * import { cookies } from 'next/headers';
 * import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
 * import { applyToolbarOverrides } from '@unleash/toolbar/next/server';
 *
 * export default async function Page() {
 *   const definitions = await getDefinitions();
 *   const modified = applyToolbarOverrides(definitions, await cookies());
 *   const { toggles } = evaluateFlags(modified, { sessionId: '123' });
 *   const flags = flagsClient(toggles);
 *
 *   return <div>{flags.isEnabled('my-flag') ? 'ON' : 'OFF'}</div>;
 * }
 * ```
 */

export * from '../react/hooks';
// Client-side exports (for 'use client' components)
export { UnleashToolbarProvider } from './client';

// Note: Server-side utilities are in './server' and must be imported separately
// This keeps the client bundle clean and avoids including server-only code
