/**
 * Core type definitions for Unleash Session Override Toolbar
 */

// Import actual SDK types for maximum compatibility
import type { UnleashClient } from 'unleash-proxy-client';

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
  lastDefaultValue: FlagValue;
  lastEffectiveValue: FlagValue;
  lastContext: UnleashContext | null;
  override: FlagOverride | null;
}

export type FlagValue = boolean | UnleashVariant | null;

/**
 * Complete toolbar state
 */
export interface ToolbarState {
  flags: {
    [featureName: string]: FlagMetadata;
  };
  contextOverrides: Partial<UnleashContext>;
  isVisible?: boolean;
  /** Persisted position set by dragging the toolbar (overrides the init `position` option) */
  dragPosition?: DragPosition;
}

/**
 * A toolbar position set by dragging.
 *
 * The toolbar is constrained to one of the four window edges; `offset` is a
 * fraction (0..1) describing where along that edge it sits, so the position
 * stays proportional when the window is resized.
 */
export interface DragPosition {
  edge: 'top' | 'right' | 'bottom' | 'left';
  offset: number;
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
  /**
   * Keyboard focus ring colour for controls on the panel background.
   *
   * Defaults to the ring that ships with the active `themePreset` — a mid purple
   * on light, a lighter purple on dark, both above the 3:1 contrast WCAG asks of
   * non-text indicators. Set this when a custom `backgroundColor` would leave
   * that default hard to see.
   *
   * Controls on the header keep a white ring, since `primaryColor` already has to
   * be dark enough to carry the header's white text.
   */
  focusColor?: string;
}

/**
 * Built-in theme presets
 */
export type ThemePreset = 'light' | 'dark';

/**
 * Where to place keyboard focus when the panel opens.
 *
 * - **panel**: the panel container itself. Screen readers announce the region,
 *   and the first Tab moves to the first control. (DEFAULT)
 * - **search**: the flag search input (switches to the Feature Flags tab)
 * - **context**: the first Context field (switches to the Context tab)
 */
export type ToolbarFocusTarget = 'panel' | 'search' | 'context';

/**
 * Options accepted by `show()`
 */
export interface ShowToolbarOptions {
  /** Where to place focus once the panel is open (default: the `focusOnOpen` option) */
  focus?: ToolbarFocusTarget;
}

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
  /** Toolbar position (default: 'bottom-right') */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right';
  /** Whether toolbar is visible on initialization (default: true, but respects persisted state if available) */
  initiallyVisible?: boolean;
  /**
   * Allow the user to drag the floating toggle icon to reposition the toolbar
   * along any window edge. The chosen position is persisted. (default: true)
   */
  draggable?: boolean;
  /**
   * Optional informational message shown as a banner below the toolbar header.
   * Useful for clarifying the toolbar's scope/limitations to your team
   * (e.g. "Only client-side flags are overridable here"). Empty by default.
   */
  banner?: string;
  /**
   * Optional URL shown as a link next to the banner message. Only rendered when
   * `banner` is also set. Opens in a new tab.
   */
  bannerLink?: string;
  /**
   * Text for the `bannerLink` (default: "Read more"). Only used when
   * `bannerLink` is set.
   */
  bannerLinkText?: string;
  /** Sort flags alphabetically instead of by evaluation order (default: false) */
  sortAlphabetically?: boolean;
  /** Enable cookie synchronization for server-side rendering (Next.js) (default: false) */
  enableCookieSync?: boolean;
  /**
   * Render the floating toggle icon when the panel is collapsed (default: true).
   *
   * Set to `false` for a shortcut-driven setup where the toolbar renders nothing
   * until it is opened. Note that with `showToggleButton: false` and
   * `shortcut: false` the only way back in is the programmatic API, so keep at
   * least one of them enabled.
   */
  showToggleButton?: boolean;
  /**
   * Keyboard shortcut that toggles the panel open/closed, e.g. `'mod+shift+f'`
   * (the default). `mod` is Cmd on macOS and Ctrl elsewhere. Set to `false` to
   * register no global key listener at all.
   *
   * Accepted modifiers: `mod`, `ctrl`, `meta`/`cmd`, `alt`/`option`, `shift`.
   */
  shortcut?: string | false;
  /**
   * Minimize the panel when a pointer press lands outside of it (default: false).
   *
   * Off by default because the common workflow is to flip a flag and then click
   * around the page to see the effect — which this would interrupt.
   */
  closeOnOutsideClick?: boolean;
  /**
   * Where to place focus when the panel is opened by the keyboard shortcut or by
   * `show()` without an explicit target (default: 'panel').
   */
  focusOnOpen?: ToolbarFocusTarget;
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
  show(options?: ShowToolbarOptions): void;
  hide(): void;
  toggle(options?: ShowToolbarOptions): void;
  destroy(): void;
}

/**
 * Main toolbar instance API
 */
export interface UnleashToolbarInstance {
  // Wrapped client is exposed for direct use
  readonly client: WrappedUnleashClient;

  /**
   * Open the panel. Pass `{ focus }` to place focus on a specific control, e.g.
   * `show({ focus: 'search' })`.
   */
  show(options?: ShowToolbarOptions): void;
  hide(): void;
  /** Open the panel if it is collapsed, minimize it if it is open */
  toggle(options?: ShowToolbarOptions): void;
  destroy(): void;

  getState(): ToolbarState;
  getFlagNames(): string[];

  setFlagOverride(name: string, override: FlagOverride | null): void;
  setContextOverride(context: Partial<UnleashContext>): void;
  removeContextOverride(fieldName: keyof UnleashContext): void;

  resetOverrides(): void;
  resetContextOverrides(): void;
}

/**
 * Wrapped Unleash client with override support.
 * Extends the SDK client type and adds the __original property.
 */
export interface WrappedUnleashClient extends UnleashClient {
  __original: UnleashClient;
  __toolbar?: UnleashToolbarInstance;
}
