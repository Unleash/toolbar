import { UnleashClient, type IConfig } from 'unleash-proxy-client';
import { FlagProvider as DefaultFlagProvider } from '@unleash/proxy-client-react';
import { wrapUnleashClient, ToolbarStateManager, UnleashToolbar } from '../index';
import type { InitToolbarOptions } from '../types';
import React, { useRef, useEffect } from 'react';

/**
 * Base props shared by both config and client variants
 */
interface BaseToolbarProviderProps {
  /**
   * The official FlagProvider component from @unleash/proxy-client-react
   * Optional - defaults to the standard FlagProvider
   */
  FlagProvider?: React.ComponentType<any>;
  
  /**
   * Optional toolbar configuration
   * Set to undefined to disable toolbar in production
   */
  toolbarOptions?: InitToolbarOptions;
  
  /**
   * Whether to automatically start the client
   * Defaults to true
   */
  startClient?: boolean;
  
  /**
   * Children components
   */
  children: React.ReactNode;
  
  /**
   * Any additional props to pass to the official FlagProvider
   */
  [key: string]: any;
}

/**
 * Props when using config-based initialization
 */
interface ConfigBasedProps extends BaseToolbarProviderProps {
  /**
   * Unleash SDK configuration object (same as official React SDK)
   */
  config: IConfig;
  client?: never;
}

/**
 * Props when using pre-instantiated client
 */
interface ClientBasedProps extends BaseToolbarProviderProps {
  /**
   * Pre-instantiated Unleash client (will be wrapped with toolbar)
   */
  client: UnleashClient;
  config?: never;
}

/**
 * Props for the UnleashToolbarProvider - either config OR client must be provided
 */
type UnleashToolbarProviderProps = ConfigBasedProps | ClientBasedProps;

/**
 * Higher-order provider that wraps the official Unleash React SDK's FlagProvider
 * and initializes the toolbar with a wrapped client.
 * 
 * Simple usage (no imports needed):
 * ```tsx
 * import { UnleashToolbarProvider } from '@unleash/toolbar/react';
 * 
 * function App() {
 *   return (
 *     <UnleashToolbarProvider
 *       config={{
 *         url: 'https://your-unleash-instance.com/api/frontend',
 *         clientKey: 'your-client-key',
 *         appName: 'my-app'
 *       }}
 *       toolbarOptions={{ themePreset: 'dark' }}
 *     >
 *       <YourApp />
 *     </UnleashToolbarProvider>
 *   );
 * }
 * ```
 * 
 * Advanced usage with custom FlagProvider:
 * ```tsx
 * import { FlagProvider } from '@unleash/proxy-client-react';
 * 
 * <UnleashToolbarProvider
 *   FlagProvider={FlagProvider}
 *   config={{ ... }}
 * >
 *   <YourApp />
 * </UnleashToolbarProvider>
 * ```
 */
export function UnleashToolbarProvider({
  FlagProvider = DefaultFlagProvider,
  config,
  client,
  toolbarOptions = {},
  startClient = true,
  children,
  ...flagProviderProps
}: UnleashToolbarProviderProps) {
  // Validate that either config or client is provided, not both
  if (!config && !client) {
    throw new Error(
      'UnleashToolbarProvider: Either "config" or "client" prop must be provided'
    );
  }
  if (config && client) {
    throw new Error(
      'UnleashToolbarProvider: Provide either "config" or "client" prop, not both'
    );
  }

  const toolbarRef = useRef<any>(null);
  const stateManagerRef = useRef<any>(null);
  
  // Wrap client synchronously (idempotent, captures flag evaluations)
  // This ensures the wrapper intercepts all flag evaluations from the first render
  const wrappedClientRef = useRef<UnleashClient | null>(null);
  
  if (wrappedClientRef.current === null) {
    const unleashClient = client || new UnleashClient(config!);
    
    if (toolbarOptions !== undefined) {
      // Create state manager that will be shared between wrapper and toolbar
      const storageMode = toolbarOptions.storageMode || 'local';
      const storageKey = toolbarOptions.storageKey || 'unleash-toolbar-state';
      const sortAlphabetically = toolbarOptions.sortAlphabetically || false;
      const stateManager = new ToolbarStateManager(storageMode, storageKey, sortAlphabetically);
      stateManagerRef.current = stateManager;

      if (toolbarOptions.enableCookieSync) {
        stateManager.enableCookieSync();
      }
      
      // Wrap client synchronously with shared state manager
      wrappedClientRef.current = wrapUnleashClient(unleashClient, stateManager);
    } else {
      // no toolbar - just use original client
      wrappedClientRef.current = unleashClient;
    }
  }
  
  // Create toolbar UI in useEffect (StrictMode-safe)
  useEffect(() => {
    // Only create toolbar if:
    // 1. toolbarOptions is defined
    // 2. No toolbar ref yet
    // 3. State manager exists
    // 4. Wrapped client doesn't already have a toolbar (prevents StrictMode duplicates)
    if (toolbarOptions !== undefined && 
        !toolbarRef.current && 
        stateManagerRef.current &&
        !(wrappedClientRef.current as any)?.__toolbar) {
      // Create toolbar with the same state manager used for wrapping
      const toolbar = new UnleashToolbar(stateManagerRef.current, wrappedClientRef.current as any, toolbarOptions);
      (wrappedClientRef.current as any).__toolbar = toolbar;
      toolbarRef.current = toolbar;
      
      // Expose globally
      if (typeof window !== 'undefined') {
        (window as any).unleashToolbar = toolbar;
      }
    }
    
    // Cleanup toolbar on unmount
    return () => {
      if (toolbarRef.current && typeof toolbarRef.current.destroy === 'function') {
        toolbarRef.current.destroy();
        toolbarRef.current = null;
      }
    };
  }, []);

  return (
    <FlagProvider
      unleashClient={wrappedClientRef.current}
      startClient={startClient}
      {...flagProviderProps}
    >
      {children}
    </FlagProvider>
  );
}
