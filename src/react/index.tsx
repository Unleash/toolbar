import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  UnleashClient,
  WrappedUnleashClient,
  InitToolbarOptions,
  UnleashContext,
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
        
        // Subscribe to toolbar events (only when toolbar is enabled)
        if ((window as any).unleashToolbar) {
          (window as any).unleashToolbar.subscribe((event: any) => {
            if (
              event.type === 'flag_override_changed' ||
              event.type === 'context_override_changed' ||
              event.type === 'sdk_updated'
            ) {
              setRefreshKey((prev: number) => prev + 1);
            }
          });
        }
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
 * Hook to access the toolbar instance from window.unleashToolbar
 */
export function useUnleashToolbar() {
  if (typeof window === 'undefined' || !(window as any).unleashToolbar) {
    throw new Error('Toolbar not initialized. Make sure UnleashToolbarProvider is mounted.');
  }
  return (window as any).unleashToolbar;
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

/**
 * Hook to manually override a flag value
 */
export function useFlagOverride(flagName: string) {
  const toolbar = useUnleashToolbar();

  return {
    setOverride: (value: boolean | null) => {
      if (value === null) {
        toolbar.setFlagOverride(flagName, null);
      } else {
        toolbar.setFlagOverride(flagName, { type: 'boolean', value });
      }
    },
    clearOverride: () => {
      toolbar.setFlagOverride(flagName, null);
    },
  };
}

/**
 * Hook to manage context overrides
 */
export function useContextOverride() {
  const toolbar = useUnleashToolbar();

  return {
    setContext: (context: Partial<UnleashContext>) => {
      toolbar.setContextOverride(context);
    },
    resetContext: () => {
      toolbar.resetContextOverrides();
    },
    getState: () => {
      return toolbar.getState();
    },
  };
}
