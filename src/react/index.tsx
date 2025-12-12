import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  UnleashClient,
  WrappedUnleashClient,
  InitToolbarOptions,
  UnleashVariant,
} from '../types';
import { initUnleashToolbar } from '../index';

interface UnleashToolbarContextValue {
  client: WrappedUnleashClient;
  refreshKey: number;
}

const UnleashToolbarContext = createContext<UnleashToolbarContextValue | null>(null);

interface UnleashToolbarProviderProps {
  client: UnleashClient;
  toolbarOptions?: InitToolbarOptions;
  children: React.ReactNode;
}

/**
 * Provider component that wraps the Unleash client and initializes the toolbar
 */
export function UnleashToolbarProvider({
  client,
  toolbarOptions = {},
  children,
}: UnleashToolbarProviderProps) {
  const wrappedClientRef = useRef<WrappedUnleashClient | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Only initialize on client side (not during SSR)
    if (typeof window === 'undefined') return;
    
    // Initialize toolbar with client (only once)
    if (!wrappedClientRef.current) {
      // Skip toolbar initialization if toolbarOptions is explicitly undefined (production mode)
      if (toolbarOptions === undefined) {
        wrappedClientRef.current = client as any;
      } else {
        wrappedClientRef.current = initUnleashToolbar(client, toolbarOptions);
        
        // Listen to SDK 'update' events (triggered by SDK and toolbar changes)
        wrappedClientRef.current.on('update', () => {
          setRefreshKey((prev: number) => prev + 1);
        });
      }
      
      // Start the client
      client.start();
    }

    // Note: We don't cleanup/destroy the toolbar in the effect cleanup
    // because in React StrictMode, effects run twice in development.
    // The toolbar should persist for the lifetime of the app.
  }, []);

  // Fallback to a dummy wrapped client during SSR
  const contextValue = useMemo(
    () => ({
      client: wrappedClientRef.current || (client as any as WrappedUnleashClient),
      refreshKey,
    }),
    [refreshKey]
  );

  return (
    <UnleashToolbarContext.Provider value={contextValue}>
      {children}
    </UnleashToolbarContext.Provider>
  );
}

/**
 * Hook to access the wrapped Unleash client
 */
export function useUnleashClient(): UnleashClient {
  const context = useContext(UnleashToolbarContext);
  if (!context) {
    throw new Error('useUnleashClient must be used within UnleashToolbarProvider');
  }
  return context.client;
}

/**
 * Hook to check if a feature flag is enabled (with override support)
 */
export function useFlag(
  flagName: string
): boolean {
  const contextValue = useContext(UnleashToolbarContext);
  if (!contextValue) {
    throw new Error('useFlag must be used within UnleashToolbarProvider');
  }

  const { client, refreshKey } = contextValue;

  // Force re-evaluation when overrides change
  const [value, setValue] = useState(() => client.isEnabled(flagName));

  useEffect(() => {
    setValue(client.isEnabled(flagName));
  }, [client, flagName, refreshKey]);

  return value;
}

/**
 * Hook to get a feature flag variant (with override support)
 */
export function useVariant(
  flagName: string
): UnleashVariant {
  const contextValue = useContext(UnleashToolbarContext);
  if (!contextValue) {
    throw new Error('useVariant must be used within UnleashToolbarProvider');
  }

  const { client, refreshKey } = contextValue;

  // Force re-evaluation when overrides change
  const [variant, setVariant] = useState(() => client.getVariant(flagName));

  useEffect(() => {
    setVariant(client.getVariant(flagName));
  }, [client, flagName, refreshKey]);

  return variant;
}
