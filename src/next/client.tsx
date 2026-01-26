/**
 * Client-side Next.js integration for Unleash Toolbar
 * 
 * This module provides the client-side provider for Next.js applications.
 * Use this in client components marked with "use client" directive.
 * Automatically enables cookie synchronization for server-side rendering support.
 */
'use client';

import { UnleashToolbarProvider as BaseUnleashToolbarProvider } from '../react/index';
import type { InitToolbarOptions } from '../types';
import React from 'react';

/**
 * Next.js-specific provider that wraps the official Unleash React SDK's FlagProvider
 * and automatically enables cookie synchronization for server-side rendering support.
 * 
 * This ensures toolbar state is available in server components via getToolbarStateFromCookies().
 */
export function UnleashToolbarProvider(props: React.ComponentProps<typeof BaseUnleashToolbarProvider>) {
  // Automatically enable cookie sync for Next.js SSR support
  const toolbarOptions: InitToolbarOptions = {
    ...props.toolbarOptions,
    enableCookieSync: true,
  };

  return <BaseUnleashToolbarProvider {...props} toolbarOptions={toolbarOptions} />;
}

export * from '../react/hooks';

