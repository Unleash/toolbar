import {
  UnleashClient,
  WrappedUnleashClient,
  UnleashContext,
  UnleashVariant,
  FlagOverride,
} from './types';
import { ToolbarStateManager } from './state';

/**
 * Wrap an Unleash client to intercept evaluations and apply overrides
 */
export function wrapUnleashClient(
  baseClient: UnleashClient,
  stateManager: ToolbarStateManager
): WrappedUnleashClient {
  // If already wrapped, return as-is
  if (isWrappedClient(baseClient)) {
    return baseClient as WrappedUnleashClient;
  }

    // Capture original base context before any updates
    const originalBaseContext = baseClient.getContext ? baseClient.getContext() : {};

    const wrappedClient: WrappedUnleashClient = {
        __original: baseClient,
        isEnabled,
        getVariant,
        on: undefined as any, // Will be set below
        start: undefined as any, // Will be set below
    };

    function isEnabled(
        toggleName: string
    ): boolean {
        // Get merged context (toolbar overrides are applied via updateContext)
        const currentContext = baseClient.getContext ? baseClient.getContext() : {};
        const mergedContext = stateManager.getMergedContext(currentContext);

        // Get default evaluation from base client (uses client's global context)
        const defaultValue = baseClient.isEnabled(toggleName);

        // Apply override if exists
        const override = stateManager.getFlagOverride(toggleName);
        const effectiveValue = applyFlagOverride(defaultValue, override);
        
        // Record evaluation with explicit flag type
        stateManager.recordEvaluation(toggleName, 'flag', defaultValue, effectiveValue, mergedContext);

        return effectiveValue as boolean;
    }

    function getVariant(
        toggleName: string
    ): UnleashVariant {
        // Get merged context (toolbar overrides are applied via updateContext)
        const currentContext = baseClient.getContext ? baseClient.getContext() : {};
        const mergedContext = stateManager.getMergedContext(currentContext);

        // Get default evaluation from base client (uses client's global context)
        const defaultValue = baseClient.getVariant(toggleName);

        // Apply override if exists
        const override = stateManager.getFlagOverride(toggleName);
        const effectiveValue = applyFlagOverride(defaultValue, override);
        
        // Record evaluation with explicit flag type
        stateManager.recordEvaluation(toggleName, 'variant', defaultValue, effectiveValue, mergedContext);

        return effectiveValue as UnleashVariant;
    }

    // Wrap getContext if it exists
    if (baseClient.getContext) {
        wrappedClient.getContext = function (): UnleashContext {
        const baseContext = baseClient.getContext!();
        return stateManager.getMergedContext(baseContext);
        };
    }

    // Wrap updateContext if it exists
    if (baseClient.updateContext) {
        wrappedClient.updateContext = async function (context: UnleashContext): Promise<void> {
        await baseClient.updateContext!(context);
        // Note: context overrides are separate and remain in effect
        };
    }

    // Track user-registered 'update' listeners so we can trigger them on toolbar changes
    const updateListeners = new Set<() => void>();

    // Intercept on() method to capture 'update' listeners
    wrappedClient.on = function (event: string, callback: () => void): void {
        if (event === 'update') {
            updateListeners.add(callback);
        }
        // Forward to base client
        baseClient.on(event, callback);
    };

    // Forward start() to base client
    wrappedClient.start = function (): Promise<void> {
        return baseClient.start();
    };

    // Helper to trigger all registered 'update' listeners
    const triggerUpdateListeners = () => {
        updateListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('[Unleash Toolbar] Error in update listener:', error);
            }
        });
    };

    // Listen to SDK 'update' event to re-evaluate flags when config changes
    baseClient.on('update', () => {
        // Re-evaluate all known flags with the new SDK configuration
        stateManager.reEvaluateAllFlags((flagName) => {
            // Get flag metadata to determine type
            const metadata = stateManager.getFlagMetadata(flagName);
            const isVariant = metadata?.flagType === 'variant';
            
            // Get new default value from SDK using correct method
            const defaultValue = isVariant 
                ? baseClient.getVariant(flagName)
                : baseClient.isEnabled(flagName);
            
            // Apply override if exists
            const override = stateManager.getFlagOverride(flagName);
            const effectiveValue = applyFlagOverride(defaultValue, override);
            
            return { defaultValue, effectiveValue };
        });
        // Trigger user's 'update' listeners (already called by SDK, but for consistency)
    });

    // Listen to toolbar state changes to update client context and trigger re-renders
    stateManager.subscribe((event) => {
        if (event.type === 'context_override_changed') {
            // Update the base client's context with merged context
            // Use original base context (not current client context which includes previous overrides)
            const mergedContext = stateManager.getMergedContext(originalBaseContext);
            
            if (baseClient.updateContext) {
                // Remove appName and environment - they are static and can't be updated
                const { appName, environment, ...updatableContext } = mergedContext;
                
                // Update context on the client (this triggers SDK re-evaluation)
                baseClient.updateContext(updatableContext).then(() => {
                    // Re-evaluate all known flags after context update
                    stateManager.reEvaluateAllFlags((flagName) => {
                        // Get flag metadata to determine type
                        const metadata = stateManager.getFlagMetadata(flagName);
                        const isVariant = metadata?.flagType === 'variant';
                        
                        // Get new default value from SDK with updated context using correct method
                        const defaultValue = isVariant 
                            ? baseClient.getVariant(flagName)
                            : baseClient.isEnabled(flagName);
                        
                        // Apply override if exists
                        const override = stateManager.getFlagOverride(flagName);
                        const effectiveValue = applyFlagOverride(defaultValue, override);
                        
                        return { defaultValue, effectiveValue };
                    });
                    // Trigger user's 'update' listeners after context change
                    triggerUpdateListeners();
                }).catch(err => {
                    console.error('[Unleash Toolbar] Failed to update context:', err);
                });
            }
        }

        // Trigger user's 'update' listeners for flag override changes
        // (flag_override_changed is emitted when override is set or removed, including bulk resets)
        if (event.type === 'flag_override_changed') {
            triggerUpdateListeners();
        }
    });

    // Proxy all other methods and properties to the base client
    return new Proxy(wrappedClient, {
        get(target, prop) {
            if (prop in target) {
                return Reflect.get(target, prop);
            }
            const value = Reflect.get(baseClient, prop);
            return typeof value === 'function' ? value.bind(baseClient) : value;
        },
        set(target, prop, value) {
            if (prop in target) {
                Reflect.set(target, prop, value);
                return true;
            }
            Reflect.set(baseClient, prop, value);
            return true;
        },
    }) as WrappedUnleashClient;
}


/**
 * Apply flag override to evaluation result
 */
function applyFlagOverride(
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
 * Unwrap a client to get the original
 */
export function unwrapUnleashClient(client: UnleashClient): UnleashClient {
  if (isWrappedClient(client)) {
    return (client as WrappedUnleashClient).__original;
  }
  return client;
}

/**
 * Check if a client is wrapped
 */
export function isWrappedClient(client: UnleashClient): client is WrappedUnleashClient {
  return '__original' in client;
}
