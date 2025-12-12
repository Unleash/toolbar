import {
  ToolbarState,
  FlagOverride,
  UnleashContext,
  UnleashVariant,
  StorageMode,
  ToolbarEvent,
  ToolbarEventListener,
  FlagMetadata,
} from './types';

/**
 * Event emitter for toolbar state changes
 */
class EventEmitter {
  private listeners: Set<ToolbarEventListener> = new Set();

  subscribe(listener: ToolbarEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ToolbarEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Unleash Toolbar] Error in event listener:', error);
      }
    });
  }
}

/**
 * Storage abstraction for different persistence modes
 */
class StorageAdapter {
  constructor(
    private mode: StorageMode,
    private key: string
  ) {}

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    
    switch (this.mode) {
      case 'local':
        return window.localStorage;
      case 'session':
        return window.sessionStorage;
      default:
        return null;
    }
  }

  load(): ToolbarState | null {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const data = storage.getItem(this.key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Unleash Toolbar] Failed to load state from storage:', error);
      return null;
    }
  }

  save(state: ToolbarState): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(this.key, JSON.stringify(state));
    } catch (error) {
      console.error('[Unleash Toolbar] Failed to save state to storage:', error);
    }
  }

  clear(): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.removeItem(this.key);
    } catch (error) {
      console.error('[Unleash Toolbar] Failed to clear storage:', error);
    }
  }
}

/**
 * Core state manager for the toolbar
 */
export class ToolbarStateManager {
  private state: ToolbarState;
  private eventEmitter: EventEmitter;
  private storage: StorageAdapter;
  private sortAlphabetically: boolean;

  constructor(storageMode: StorageMode = 'local', storageKey: string = 'unleash-toolbar-state', sortAlphabetically: boolean = false) {
    this.eventEmitter = new EventEmitter();
    this.storage = new StorageAdapter(storageMode, storageKey);
    this.sortAlphabetically = sortAlphabetically;

    // Try to load persisted state
    const persistedState = this.storage.load();
    this.state = persistedState || this.getInitialState();
  }

  private getInitialState(): ToolbarState {
    return {
      flags: {},
      contextOverrides: {},
    };
  }

  private persist(): void {
    this.storage.save(this.state);
  }

  /**
   * Apply override to a default value (same logic as wrapper)
   */
  private applyOverride(
    defaultValue: boolean | UnleashVariant | null,
    override: FlagOverride | null
  ): boolean | UnleashVariant | null {
    if (!override) return defaultValue;

    if (override.type === 'flag') {
      return override.value;
    }

    if (override.type === 'variant') {
      // For variant overrides, create a variant object
      if (typeof defaultValue === 'object' && defaultValue !== null && 'name' in defaultValue) {
        return {
          ...defaultValue,
          name: override.variantKey,
          enabled: true,
        };
      }
      // If default was not a variant, create a new one
      return {
        name: override.variantKey,
        enabled: true,
      };
    }

    return defaultValue;
  }

  /**
   * Re-evaluate all known flags (used when SDK configuration updates)
   */
  reEvaluateAllFlags(evaluator: (flagName: string) => { defaultValue: any; effectiveValue: any }): void {
    const flagNames = Object.keys(this.state.flags);
    
    flagNames.forEach(flagName => {
      const existing = this.state.flags[flagName];
      if (!existing) return;
      
      try {
        const { defaultValue, effectiveValue } = evaluator(flagName);
        
        // Update flag metadata with new default value
        this.state.flags[flagName] = {
          ...existing,
          lastDefaultValue: defaultValue,
          lastEffectiveValue: effectiveValue,
        };
      } catch (error) {
        // If evaluation fails, keep existing data
        console.error(`[Unleash Toolbar] Failed to re-evaluate flag ${flagName}:`, error);
      }
    });
    
    this.persist();
    
    this.eventEmitter.emit({
      type: 'sdk_updated',
      timestamp: Date.now(),
    });
  }

  /**
   * Get the current state (immutable copy)
   */
  getState(): ToolbarState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Subscribe to state change events
   */
  subscribe(listener: ToolbarEventListener): () => void {
    return this.eventEmitter.subscribe(listener);
  }

  /**
   * Record a flag evaluation (updates state without emitting events)
   */
  recordEvaluation(
    name: string,
    flagType: 'flag' | 'variant',
    defaultValue: boolean | UnleashVariant | null,
    effectiveValue: boolean | UnleashVariant | null,
    context: UnleashContext
  ): void {
    const existing = this.state.flags[name];
    const isNewFlag = !existing;
    
    this.state.flags[name] = {
      flagType,
      lastDefaultValue: defaultValue,
      lastEffectiveValue: effectiveValue,
      lastContext: context,
      override: existing?.override || null,
    };

    this.persist();
    
    // Emit event only for new flags to trigger UI update
    if (isNewFlag) {
      this.eventEmitter.emit({
        type: 'sdk_updated',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Set or clear a flag override
   */
  setFlagOverride(name: string, override: FlagOverride | null): void {
    if (!this.state.flags[name]) {
      // Infer flag type from override type (shouldn't happen in normal flow)
      const flagType = override?.type === 'variant' ? 'variant' : 'flag';
      this.state.flags[name] = {
        flagType,
        lastDefaultValue: null,
        lastEffectiveValue: null,
        lastContext: null,
        override,
      };
    } else {
      this.state.flags[name].override = override;
      
      // Recalculate effective value based on new override
      const defaultValue = this.state.flags[name].lastDefaultValue;
      this.state.flags[name].lastEffectiveValue = this.applyOverride(defaultValue, override);
    }

    this.persist();

    this.eventEmitter.emit({
      type: 'flag_override_changed',
      name,
      override,
      timestamp: Date.now(),
    });
  }

  /**
   * Get flag override
   */
  getFlagOverride(name: string): FlagOverride | null {
    return this.state.flags[name]?.override || null;
  }

  /**
   * Set context overrides
   */
  setContextOverride(context: Partial<UnleashContext>): void {
    this.state.contextOverrides = {
      ...this.state.contextOverrides,
      ...context,
    };

    this.persist();

    this.eventEmitter.emit({
      type: 'context_override_changed',
      contextOverrides: this.state.contextOverrides,
    });
  }

  /**
   * Remove a specific context override field
   */
  removeContextOverride(fieldName: keyof UnleashContext): void {
    const newOverrides = { ...this.state.contextOverrides };
    delete newOverrides[fieldName];
    
    // Replace entire context overrides object
    this.state.contextOverrides = newOverrides;
    this.persist();

    this.eventEmitter.emit({
      type: 'context_override_changed',
      contextOverrides: this.state.contextOverrides,
    });
  }

  /**
   * Get merged context (original + overrides)
   */
  getMergedContext(baseContext: UnleashContext = {}): UnleashContext {
    return {
      ...baseContext,
      ...this.state.contextOverrides,
      properties: {
        ...(baseContext.properties || {}),
        ...(this.state.contextOverrides.properties || {}),
      },
    };
  }

  /**
   * Reset all flag overrides
   */
  resetOverrides(): void {
    Object.keys(this.state.flags).forEach((name) => {
      this.state.flags[name].override = null;
      
      // Recalculate effective value (will match default)
      const defaultValue = this.state.flags[name].lastDefaultValue;
      this.state.flags[name].lastEffectiveValue = defaultValue;
    });

    this.persist();

    this.eventEmitter.emit({
      type: 'sdk_updated',
      timestamp: Date.now(),
    });
  }

  /**
   * Reset context overrides
   */
  resetContextOverrides(): void {
    this.state.contextOverrides = {};

    this.persist();

    this.eventEmitter.emit({
      type: 'context_override_changed',
      contextOverrides: {},
    });
  }

  /**
   * Set toolbar visibility state
   */
  setVisibility(isVisible: boolean): void {
    this.state.isVisible = isVisible;
    this.persist();
  }

  /**
   * Get toolbar visibility state
   */
  getVisibility(): boolean | undefined {
    return this.state.isVisible;
  }

  /**
   * Clear all persisted data
   */
  clearPersistence(): void {
    this.storage.clear();
  }

  /**
   * Get all flag names in evaluation order (insertion order) or alphabetically
   */
  getFlagNames(): string[] {
    const names = Object.keys(this.state.flags);
    return this.sortAlphabetically ? names.sort() : names;
  }

  /**
   * Get metadata for a specific flag
   */
  getFlagMetadata(name: string): FlagMetadata | null {
    return this.state.flags[name] || null;
  }
}
