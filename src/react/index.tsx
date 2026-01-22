import { UnleashClient, type IConfig } from 'unleash-proxy-client';
import { FlagProvider as DefaultFlagProvider } from '@unleash/proxy-client-react';
import { initUnleashToolbar } from '../index';
import type { InitToolbarOptions } from '../types';
import React, { useRef } from 'react';

/**
 * Props for the UnleashToolbarProvider that wraps the official FlagProvider
 */
interface UnleashToolbarProviderProps {
  /**
   * The official FlagProvider component from @unleash/proxy-client-react
   * Optional - defaults to the standard FlagProvider
   */
  FlagProvider?: React.ComponentType<any>;
  
  /**
   * Unleash SDK configuration object (same as official React SDK)
   * Either provide `config` OR `client`, not both
   */
  config?: IConfig;
  
  /**
   * Pre-instantiated Unleash client (will be wrapped with toolbar)
   * Either provide `config` OR `client`, not both
   */
  client?: UnleashClient;
  
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

  // Wrap client immediately on first render (not in useEffect)
  // Use a lazy initializer to ensure it only runs once
  const wrappedClientRef = useRef<UnleashClient | null>(null);
  
  if (wrappedClientRef.current === null) {
    // Only initialize on client side (not during SSR)
    if (typeof window !== 'undefined') {
      // Create client from config if provided
      const unleashClient = client || new UnleashClient(config!);
      
      // Skip toolbar initialization if toolbarOptions is explicitly undefined (production mode)
      if (toolbarOptions === undefined) {
        wrappedClientRef.current = unleashClient;
      } else {
        wrappedClientRef.current = initUnleashToolbar(unleashClient, toolbarOptions);
      }
    } else {
      // SSR: create unwrapped client
      wrappedClientRef.current = client || new UnleashClient(config!);
    }
  }

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