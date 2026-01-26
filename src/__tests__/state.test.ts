import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolbarStateManager } from '../state';
import type { FlagOverride, UnleashContext } from '../types';

describe('ToolbarStateManager', () => {
  let stateManager: ToolbarStateManager;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    stateManager = new ToolbarStateManager('local', 'test-toolbar-state', false);
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const state = stateManager.getState();
      expect(state.flags).toEqual({});
      expect(state.contextOverrides).toEqual({});
    });

    it('should load persisted state from localStorage', () => {
      const persistedState = {
        flags: {
          testFlag: {
            flagType: 'flag' as const,
            lastDefaultValue: true,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag' as const, value: false },
          },
        },
        contextOverrides: { userId: '123' },
      };
      localStorage.setItem('test-toolbar-state', JSON.stringify(persistedState));

      const manager = new ToolbarStateManager('local', 'test-toolbar-state', false);
      const state = manager.getState();

      expect(state.flags).toEqual(persistedState.flags);
      expect(state.contextOverrides).toEqual(persistedState.contextOverrides);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('test-toolbar-state', 'invalid-json');

      const manager = new ToolbarStateManager('local', 'test-toolbar-state', false);
      const state = manager.getState();

      expect(state.flags).toEqual({});
      expect(state.contextOverrides).toEqual({});
    });
  });

  describe('recordEvaluation', () => {
    it('should record a flag evaluation', () => {
      stateManager.recordEvaluation('feature1', 'flag', true, true, {});

      const metadata = stateManager.getFlagMetadata('feature1');
      expect(metadata).toBeDefined();
      expect(metadata?.flagType).toBe('flag');
      expect(metadata?.lastDefaultValue).toBe(true);
      expect(metadata?.lastEffectiveValue).toBe(true);
      expect(metadata?.override).toBeNull();
    });

    it('should record a variant evaluation', () => {
      const variant = { name: 'blue', enabled: true };
      stateManager.recordEvaluation('feature2', 'variant', variant, variant, {});

      const metadata = stateManager.getFlagMetadata('feature2');
      expect(metadata?.flagType).toBe('variant');
      expect(metadata?.lastDefaultValue).toEqual(variant);
    });

    it('should emit sdk_updated event for new flags', () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.recordEvaluation('newFlag', 'flag', false, false, {});

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sdk_updated',
        }),
      );
    });

    it('should NOT emit events for existing flags', () => {
      stateManager.recordEvaluation('existingFlag', 'flag', true, true, {});

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.recordEvaluation('existingFlag', 'flag', false, false, {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should preserve existing override when recording', () => {
      stateManager.recordEvaluation('feature', 'flag', true, true, {});
      stateManager.setFlagOverride('feature', { type: 'flag', value: false });

      stateManager.recordEvaluation('feature', 'flag', true, false, {});

      const metadata = stateManager.getFlagMetadata('feature');
      expect(metadata?.override).toEqual({ type: 'flag', value: false });
    });

    it('should persist evaluation to storage', () => {
      stateManager.recordEvaluation('testFlag', 'flag', true, true, {});

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.flags.testFlag).toBeDefined();
    });
  });

  describe('setFlagOverride', () => {
    it('should set a boolean flag override', () => {
      stateManager.recordEvaluation('feature1', 'flag', true, true, {});

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.setFlagOverride('feature1', { type: 'flag', value: false });

      const metadata = stateManager.getFlagMetadata('feature1');
      expect(metadata?.override).toEqual({ type: 'flag', value: false });
      expect(metadata?.lastEffectiveValue).toBe(false);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flag_override_changed',
          name: 'feature1',
          override: { type: 'flag', value: false },
        }),
      );
    });

    it('should set a variant override', () => {
      stateManager.recordEvaluation(
        'feature2',
        'variant',
        { name: 'control', enabled: false },
        { name: 'control', enabled: false },
        {},
      );

      const override: FlagOverride = { type: 'variant', variantKey: 'blue' };
      stateManager.setFlagOverride('feature2', override);

      const metadata = stateManager.getFlagMetadata('feature2');
      expect(metadata?.override).toEqual(override);
      expect(metadata?.lastEffectiveValue).toMatchObject({ name: 'blue', enabled: true });
    });

    it('should remove override when set to null', () => {
      stateManager.recordEvaluation('feature', 'flag', true, true, {});
      stateManager.setFlagOverride('feature', { type: 'flag', value: false });

      stateManager.setFlagOverride('feature', null);

      const metadata = stateManager.getFlagMetadata('feature');
      expect(metadata?.override).toBeNull();
      expect(metadata?.lastEffectiveValue).toBe(true); // Back to default
    });

    it('should create flag metadata if not exists (edge case)', () => {
      stateManager.setFlagOverride('unknownFlag', { type: 'flag', value: true });

      const metadata = stateManager.getFlagMetadata('unknownFlag');
      expect(metadata).toBeDefined();
      expect(metadata?.override).toEqual({ type: 'flag', value: true });
    });

    it('should persist override to storage', () => {
      stateManager.recordEvaluation('feature', 'flag', false, false, {});
      stateManager.setFlagOverride('feature', { type: 'flag', value: true });

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.flags.feature.override).toEqual({ type: 'flag', value: true });
    });

    it('should create variant from scratch when applying variant override to flag without default value', () => {
      // Record a flag evaluation with null as the default value
      stateManager.recordEvaluation('newVariantFlag', 'variant', null, null, {});

      // Apply a variant override
      const override: FlagOverride = { type: 'variant', variantKey: 'experimental' };
      stateManager.setFlagOverride('newVariantFlag', override);

      const metadata = stateManager.getFlagMetadata('newVariantFlag');
      expect(metadata?.override).toEqual(override);
      // Should create a new variant object from scratch
      expect(metadata?.lastEffectiveValue).toEqual({
        name: 'experimental',
        enabled: true,
      });
    });

    it('should create variant from scratch when applying variant override before any evaluation', () => {
      // This tests the edge case where we set a variant override on a flag that was never evaluated
      // (so lastDefaultValue doesn't exist or is null)
      const override: FlagOverride = { type: 'variant', variantKey: 'beta' };
      stateManager.setFlagOverride('unevaluatedFlag', override);

      const metadata = stateManager.getFlagMetadata('unevaluatedFlag');
      expect(metadata?.override).toEqual(override);
      // Even without a default value, should create a variant
      expect(metadata?.lastEffectiveValue).toEqual({
        name: 'beta',
        enabled: true,
      });
    });
  });

  describe('getFlagOverride', () => {
    it('should return the flag override', () => {
      stateManager.recordEvaluation('feature', 'flag', true, true, {});
      const override = { type: 'flag' as const, value: false };
      stateManager.setFlagOverride('feature', override);

      expect(stateManager.getFlagOverride('feature')).toEqual(override);
    });

    it('should return null for non-existent flags', () => {
      expect(stateManager.getFlagOverride('nonExistent')).toBeNull();
    });

    it('should return null when no override is set', () => {
      stateManager.recordEvaluation('feature', 'flag', true, true, {});
      expect(stateManager.getFlagOverride('feature')).toBeNull();
    });
  });

  describe('context overrides', () => {
    it('should set context overrides', () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      const context: Partial<UnleashContext> = { userId: 'user123', sessionId: 'session456' };
      stateManager.setContextOverride(context);

      const state = stateManager.getState();
      expect(state.contextOverrides).toEqual(context);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'context_override_changed',
          contextOverrides: context,
        }),
      );
    });

    it('should merge context overrides', () => {
      stateManager.setContextOverride({ userId: 'user123' });
      stateManager.setContextOverride({ sessionId: 'session456' });

      const state = stateManager.getState();
      expect(state.contextOverrides).toEqual({
        userId: 'user123',
        sessionId: 'session456',
      });
    });

    it('should overwrite existing fields', () => {
      stateManager.setContextOverride({ userId: 'user123' });
      stateManager.setContextOverride({ userId: 'user456' });

      const state = stateManager.getState();
      expect(state.contextOverrides.userId).toBe('user456');
    });

    it('should persist context overrides to storage', () => {
      stateManager.setContextOverride({ userId: 'user123' });

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.contextOverrides).toEqual({ userId: 'user123' });
    });
  });

  describe('removeContextOverride', () => {
    it('should remove a specific context override field', () => {
      stateManager.setContextOverride({ userId: 'user123', sessionId: 'session456' });
      stateManager.removeContextOverride('userId');

      const state = stateManager.getState();
      expect(state.contextOverrides).toEqual({ sessionId: 'session456' });
    });

    it('should emit context_override_changed event', () => {
      stateManager.setContextOverride({ userId: 'user123' });

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.removeContextOverride('userId');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'context_override_changed',
          contextOverrides: {},
        }),
      );
    });
  });

  describe('getMergedContext', () => {
    it('should merge base context with overrides', () => {
      stateManager.setContextOverride({ userId: 'override-user' });

      const merged = stateManager.getMergedContext({ sessionId: 'session123' });

      expect(merged).toEqual({
        userId: 'override-user',
        sessionId: 'session123',
        properties: {},
      });
    });

    it('should prioritize overrides over base context', () => {
      stateManager.setContextOverride({ userId: 'override-user' });

      const merged = stateManager.getMergedContext({
        userId: 'base-user',
        sessionId: 'session123',
      });

      expect(merged.userId).toBe('override-user');
      expect(merged.sessionId).toBe('session123');
    });

    it('should merge properties correctly', () => {
      stateManager.setContextOverride({
        properties: { overrideKey: 'overrideValue' },
      });

      const merged = stateManager.getMergedContext({
        userId: 'user123',
        properties: { baseKey: 'baseValue' },
      });

      expect(merged.properties).toEqual({
        baseKey: 'baseValue',
        overrideKey: 'overrideValue',
      });
    });

    it('should work with empty base context', () => {
      stateManager.setContextOverride({ userId: 'user123' });

      const merged = stateManager.getMergedContext();

      expect(merged).toEqual({ userId: 'user123', properties: {} });
    });
  });

  describe('resetOverrides', () => {
    it('should reset all flag overrides', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});
      stateManager.setFlagOverride('flag1', { type: 'flag', value: false });
      stateManager.setFlagOverride('flag2', { type: 'flag', value: true });

      stateManager.resetOverrides();

      expect(stateManager.getFlagOverride('flag1')).toBeNull();
      expect(stateManager.getFlagOverride('flag2')).toBeNull();
    });

    it('should restore effective values to defaults', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});
      stateManager.setFlagOverride('flag', { type: 'flag', value: false });

      stateManager.resetOverrides();

      const metadata = stateManager.getFlagMetadata('flag');
      expect(metadata?.lastEffectiveValue).toBe(true); // Back to default
    });

    it('should emit flag_override_changed event for each flag', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});
      stateManager.setFlagOverride('flag1', { type: 'flag', value: false });
      stateManager.setFlagOverride('flag2', { type: 'flag', value: true });

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.resetOverrides();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flag_override_changed',
          name: 'flag1',
          override: null,
        }),
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flag_override_changed',
          name: 'flag2',
          override: null,
        }),
      );
    });

    it('should persist changes to storage', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});
      stateManager.setFlagOverride('flag', { type: 'flag', value: false });

      stateManager.resetOverrides();

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.flags.flag.override).toBeNull();
    });
  });

  describe('resetContextOverrides', () => {
    it('should reset all context overrides', () => {
      stateManager.setContextOverride({ userId: 'user123', sessionId: 'session456' });

      stateManager.resetContextOverrides();

      const state = stateManager.getState();
      expect(state.contextOverrides).toEqual({});
    });

    it('should emit context_override_changed event', () => {
      stateManager.setContextOverride({ userId: 'user123' });

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.resetContextOverrides();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'context_override_changed',
          contextOverrides: {},
        }),
      );
    });

    it('should persist changes to storage', () => {
      stateManager.setContextOverride({ userId: 'user123' });

      stateManager.resetContextOverrides();

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.contextOverrides).toEqual({});
    });
  });

  describe('reEvaluateAllFlags', () => {
    it('should re-evaluate all known flags', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});

      const evaluator = vi.fn((flagName: string) => ({
        defaultValue: flagName !== 'flag1',
        effectiveValue: flagName !== 'flag1',
      }));

      stateManager.reEvaluateAllFlags(evaluator);

      expect(evaluator).toHaveBeenCalledTimes(2);
      expect(stateManager.getFlagMetadata('flag1')?.lastDefaultValue).toBe(false);
      expect(stateManager.getFlagMetadata('flag2')?.lastDefaultValue).toBe(true);
    });

    it('should emit sdk_updated event', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.reEvaluateAllFlags(() => ({ defaultValue: false, effectiveValue: false }));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sdk_updated',
        }),
      );
    });

    it('should handle evaluation errors gracefully', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});

      const evaluator = vi.fn((flagName: string) => {
        if (flagName === 'flag1') throw new Error('Evaluation error');
        return { defaultValue: true, effectiveValue: true };
      });

      // Should not throw
      expect(() => stateManager.reEvaluateAllFlags(evaluator)).not.toThrow();

      // flag1 should keep old value, flag2 should update
      expect(stateManager.getFlagMetadata('flag1')?.lastDefaultValue).toBe(true);
      expect(stateManager.getFlagMetadata('flag2')?.lastDefaultValue).toBe(true);
    });
  });

  describe('getFlagNames', () => {
    it('should return flag names in insertion order by default', () => {
      stateManager.recordEvaluation('zebra', 'flag', true, true, {});
      stateManager.recordEvaluation('apple', 'flag', false, false, {});
      stateManager.recordEvaluation('banana', 'flag', true, true, {});

      const names = stateManager.getFlagNames();
      expect(names).toEqual(['zebra', 'apple', 'banana']);
    });

    it('should return flag names alphabetically when configured', () => {
      const sortedManager = new ToolbarStateManager('local', 'test-sorted', true);

      sortedManager.recordEvaluation('zebra', 'flag', true, true, {});
      sortedManager.recordEvaluation('apple', 'flag', false, false, {});
      sortedManager.recordEvaluation('banana', 'flag', true, true, {});

      const names = sortedManager.getFlagNames();
      expect(names).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('visibility state', () => {
    it('should set and get visibility state', () => {
      stateManager.setVisibility(true);
      expect(stateManager.getVisibility()).toBe(true);

      stateManager.setVisibility(false);
      expect(stateManager.getVisibility()).toBe(false);
    });

    it('should persist visibility state', () => {
      stateManager.setVisibility(true);

      const persisted = JSON.parse(localStorage.getItem('test-toolbar-state') || '{}');
      expect(persisted.isVisible).toBe(true);
    });

    it('should return undefined when not set', () => {
      expect(stateManager.getVisibility()).toBeUndefined();
    });
  });

  describe('storage modes', () => {
    it('should use sessionStorage when storageMode is session', () => {
      const sessionManager = new ToolbarStateManager('session', 'test-session-state', false);

      sessionManager.recordEvaluation('flag', 'flag', true, true, {});

      expect(sessionStorage.getItem('test-session-state')).toBeTruthy();
      expect(localStorage.getItem('test-session-state')).toBeNull();
    });

    it('should not persist when storageMode is memory', () => {
      const noneManager = new ToolbarStateManager('memory', 'test-none-state', false);

      noneManager.recordEvaluation('flag', 'flag', true, true, {});

      expect(localStorage.getItem('test-none-state')).toBeNull();
      expect(sessionStorage.getItem('test-none-state')).toBeNull();
    });
  });

  describe('clearPersistence', () => {
    it('should clear persisted state from storage', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});
      expect(localStorage.getItem('test-toolbar-state')).toBeTruthy();

      stateManager.clearPersistence();

      expect(localStorage.getItem('test-toolbar-state')).toBeNull();
    });
  });

  describe('event subscription', () => {
    it('should allow subscribing to events', () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      expect(listener).toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      stateManager.recordEvaluation('flag2', 'flag', false, false, {});
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should catch and log errors in listeners', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      stateManager.subscribe(badListener);
      stateManager.subscribe(goodListener);

      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled(); // Should still be called

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getState immutability', () => {
    it('should return immutable copy of state', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      const state1 = stateManager.getState();
      const state2 = stateManager.getState();

      expect(state1).not.toBe(state2); // Different objects
      expect(state1).toEqual(state2); // Same content
    });

    it('should not allow external mutations to affect internal state', () => {
      stateManager.recordEvaluation('flag', 'flag', true, true, {});

      const state = stateManager.getState();
      state.contextOverrides.userId = 'hacked';

      const freshState = stateManager.getState();
      expect(freshState.contextOverrides.userId).toBeUndefined();
    });
  });

  describe('cookie sync', () => {
    beforeEach(() => {
      // Clear any existing cookies
      document.cookie = 'unleash-toolbar-state=; path=/; max-age=0';
    });

    it('should not sync to cookies by default', () => {
      const manager = new ToolbarStateManager('local', 'test-toolbar-state', false);
      manager.recordEvaluation('flag', 'flag', true, true, {});
      manager.setFlagOverride('flag', { type: 'flag', value: false });

      // Cookie should not be set
      expect(document.cookie).not.toContain('unleash-toolbar-state');
    });

    it('should sync to cookies when enabled', () => {
      const manager = new ToolbarStateManager('local', 'test-toolbar-state', false);
      manager.enableCookieSync();
      
      manager.recordEvaluation('flag', 'flag', true, true, {});
      manager.setFlagOverride('flag', { type: 'flag', value: false });

      // Cookie should be set
      expect(document.cookie).toContain('unleash-toolbar-state');
    });

    it('should clear cookie when clearing storage with sync enabled', () => {
      const manager = new ToolbarStateManager('local', 'test-toolbar-state', false);
      manager.enableCookieSync();
      
      manager.recordEvaluation('flag', 'flag', true, true, {});
      expect(document.cookie).toContain('unleash-toolbar-state');

      manager.clearPersistence();
      
      // Cookie should be cleared
      const cookies = document.cookie.split(';').map(c => c.trim());
      const toolbarCookie = cookies.find(c => c.startsWith('unleash-toolbar-state='));
      expect(toolbarCookie).toBeUndefined();
    });
  });
});
