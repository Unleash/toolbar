/**
 * Core type definitions for Unleash Session Override Toolbar
 */

/**
 * Unleash context used for feature flag evaluation
 */
export interface UnleashContext {
  userId?: string;
  sessionId?: string;
  remoteAddress?: string;
  environment?: string;
  appName?: string;
  properties?: Record<string, string>;
  [key: string]: any;
}

/**
 * Unleash variant structure
 */
export interface UnleashVariant {
  name: string;
  enabled: boolean;
  payload?: {
    type: string;
    value: string;
  };
}

/**
 * Flag override types
 */
export type FlagOverride =
  | { type: 'flag'; value: boolean }
  | { type: 'variant'; variantKey: string };

/**
 * Metadata for a single flag evaluation
 */
export interface FlagMetadata {
  flagType: 'flag' | 'variant';
  lastDefaultValue: boolean | UnleashVariant | null;
  lastEffectiveValue: boolean | UnleashVariant | null;
  lastContext: UnleashContext | null;
  override: FlagOverride | null;
}

/**
 * Complete toolbar state
 */
export interface ToolbarState {
  flags: {
    [featureName: string]: FlagMetadata;
  };
  contextOverrides: Partial<UnleashContext>;
  isVisible?: boolean;
}

/**
 * Storage mode options
 * 
 * - **local**: Persists across browser tabs and page reloads. Best for development
 *   as overrides remain active across the entire browser session and even after
 *   closing/reopening the browser. (DEFAULT)
 * 
 * - **session**: Persists only within the current browser tab. Overrides survive
 *   page reloads but are lost when the tab is closed. Useful when testing different
 *   configurations in different tabs without interference.
 * 
 * - **memory**: No persistence - overrides lost on page reload. Useful for
 *   quick temporary testing or when you need complete isolation between page loads.
 *   Also appropriate for strict security/privacy requirements where no data should
 *   be written to disk.
 */
export type StorageMode = 'memory' | 'session' | 'local';

/**
 * Theme customization options
 */
export interface ToolbarThemeOptions {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  fontFamily?: string;
}

/**
 * Built-in theme presets
 */
export type ThemePreset = 'light' | 'dark';

/**
 * Initialization options for the toolbar
 */
export interface InitToolbarOptions {
  /** Storage persistence mode (default: 'local') */
  storageMode?: StorageMode;
  /** Storage key for persisted state (default: 'unleash-toolbar-state') */
  storageKey?: string;
  /** Built-in theme preset (default: 'light') */
  themePreset?: ThemePreset;
  /** Custom theme colors (overrides themePreset if provided) */
  theme?: ToolbarThemeOptions;
  /** Container element (default: document.body) */
  container?: HTMLElement | null;
  /** Toolbar position (default: 'bottom') */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Whether toolbar is visible on initialization (default: true, but respects persisted state if available) */
  initiallyVisible?: boolean;
  /** Sort flags alphabetically instead of by evaluation order (default: false) */
  sortAlphabetically?: boolean;
}

/**
 * Toolbar event types (internal use only - not part of public API)
 * @internal
 */
export type ToolbarEvent =
  | {
      type: 'flag_override_changed';
      name: string;
      override: FlagOverride | null;
      timestamp: number;
    }
  | {
      type: 'context_override_changed';
      contextOverrides: Partial<UnleashContext>;
    }
  | {
      type: 'sdk_updated';
      timestamp: number;
    };

/**
 * Event listener function (internal use only - not part of public API)
 * @internal
 */
export type ToolbarEventListener = (event: ToolbarEvent) => void;

/**
 * Toolbar UI interface (implemented by UI modules)
 */
export interface IToolbarUI {
  show(): void;
  hide(): void;
  destroy(): void;
}

/**
 * Main toolbar instance API
 */
export interface UnleashToolbarInstance {
  // Wrapped client is exposed for direct use
  readonly client: WrappedUnleashClient;
  
  show(): void;
  hide(): void;
  destroy(): void;
  
  getState(): ToolbarState;
  
  setFlagOverride(name: string, override: FlagOverride | null): void;
  setContextOverride(context: Partial<UnleashContext>): void;
  removeContextOverride(fieldName: keyof UnleashContext): void;
  
  resetOverrides(): void;
  resetContextOverrides(): void;
}

/**
 * Base Unleash client interface (simplified)
 */
export interface UnleashClient {
  isEnabled(toggleName: string): boolean;
  getVariant(toggleName: string): UnleashVariant;
  getContext?(): UnleashContext;
  updateContext?(context: UnleashContext): Promise<void>;
  on(event: string, callback: (...args: any[]) => void): void;
  start(): Promise<void>;
  [key: string]: any;
}

/**
 * Wrapped Unleash client with override support
 */
export interface WrappedUnleashClient extends UnleashClient {
  __original: UnleashClient;
}
