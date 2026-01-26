import type { UnleashClient } from 'unleash-proxy-client';
import { ToolbarStateManager } from './state';
import type {
  FlagOverride,
  InitToolbarOptions,
  IToolbarUI,
  ToolbarState,
  UnleashContext,
  UnleashToolbarInstance,
  WrappedUnleashClient,
} from './types';
import { wrapUnleashClient } from './wrapper';

/**
 * Main toolbar instance implementation
 */
export class UnleashToolbar implements UnleashToolbarInstance {
  private stateManager: ToolbarStateManager;
  private ui: IToolbarUI | null;
  public readonly client: WrappedUnleashClient;

  constructor(
    stateManager: ToolbarStateManager,
    wrappedClient: WrappedUnleashClient,
    options: InitToolbarOptions,
  ) {
    this.stateManager = stateManager;
    this.client = wrappedClient;
    this.ui = null;

    // Initialize UI asynchronously to avoid SSR issues
    this.initUI(stateManager, wrappedClient, options);
  }

  private async initUI(
    stateManager: ToolbarStateManager,
    wrappedClient: WrappedUnleashClient,
    options: InitToolbarOptions,
  ) {
    const { ToolbarUI } = await import('./ui');
    this.ui = new ToolbarUI(stateManager, wrappedClient, options);
  }

  show(): void {
    if (this.ui) this.ui.show();
  }

  hide(): void {
    if (this.ui) this.ui.hide();
  }

  destroy(): void {
    if (this.ui) this.ui.destroy();
    this.stateManager.clearPersistence();
  }

  getState(): ToolbarState {
    return this.stateManager.getState();
  }

  getFlagNames(): string[] {
    return this.stateManager.getFlagNames();
  }

  setFlagOverride(name: string, override: FlagOverride | null): void {
    this.stateManager.setFlagOverride(name, override);
  }

  setContextOverride(context: Partial<UnleashContext>): void {
    this.stateManager.setContextOverride(context);
  }

  removeContextOverride(fieldName: keyof UnleashContext): void {
    this.stateManager.removeContextOverride(fieldName);
  }

  resetOverrides(): void {
    this.stateManager.resetOverrides();
  }

  resetContextOverrides(): void {
    this.stateManager.resetContextOverrides();
  }
}

/**
 * Initialize the Unleash Toolbar with a client
 * This is the main entry point - handles both toolbar creation and client wrapping
 * Returns the wrapped client directly for immediate use
 *
 * @param client - The Unleash client to wrap
 * @param options - Toolbar configuration options
 */
export function initUnleashToolbar(
  client: UnleashClient,
  options: InitToolbarOptions = {},
): WrappedUnleashClient {
  const storageMode = options.storageMode || 'local';
  const storageKey = options.storageKey || 'unleash-toolbar-state';
  const sortAlphabetically = options.sortAlphabetically || false;
  const enableCookieSync = options.enableCookieSync || false;

  const stateManager = new ToolbarStateManager(storageMode, storageKey, sortAlphabetically);

  // Enable cookie sync if requested (for Next.js SSR)
  if (enableCookieSync) {
    stateManager.enableCookieSync();
  }

  const wrappedClient = wrapUnleashClient(client, stateManager);
  const toolbar = new UnleashToolbar(stateManager, wrappedClient, options);

  // Expose toolbar instance globally for debugging/advanced use
  if (typeof window !== 'undefined') {
    // biome-ignore lint/suspicious/noExplicitAny: no type for window
    (window as any).unleashToolbar = toolbar;
  }

  return wrappedClient;
}

// UMD global export
if (typeof window !== 'undefined') {
  // biome-ignore lint/suspicious/noExplicitAny: no type for window
  (window as any).UnleashToolbar = {
    init: initUnleashToolbar,
  };
}

export { ToolbarStateManager } from './state';
// Export types
export * from './types';
export { wrapUnleashClient } from './wrapper';
