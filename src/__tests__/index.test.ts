import type { UnleashClient } from 'unleash-proxy-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initUnleashToolbar, type UnleashToolbar } from '../index';

describe('initUnleashToolbar', () => {
  let mockClient: UnleashClient;

  function getToolbar(): UnleashToolbar {
    // biome-ignore lint/suspicious/noExplicitAny: no type for window
    return (window as any).unleashToolbar;
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({
        name: 'control',
        enabled: false,
        payload: undefined,
      })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(() => Promise.resolve()),
      getAllToggles: vi.fn(() => []),
      setContextField: vi.fn(),
      stop: vi.fn(),
      off: vi.fn(),
    } as unknown as UnleashClient;

    // Clear window.unleashToolbar
    // biome-ignore lint/suspicious/noExplicitAny: no type for window
    delete (window as any).unleashToolbar;
  });

  describe('initialization', () => {
    it('should return a wrapped client', () => {
      const wrapped = initUnleashToolbar(mockClient);

      expect(wrapped).toBeDefined();
      expect(wrapped.isEnabled).toBeDefined();
      expect(wrapped.getVariant).toBeDefined();
      expect(wrapped.on).toBeDefined();
      expect(wrapped.start).toBeDefined();
      expect(wrapped.__original).toBe(mockClient);
    });

    it('should expose toolbar instance on window', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      expect(toolbar).toBeDefined();
      expect(toolbar.show).toBeDefined();
      expect(toolbar.hide).toBeDefined();
      expect(toolbar.client).toBeDefined();
    });

    it('should use default options when none provided', () => {
      const wrapped = initUnleashToolbar(mockClient);

      wrapped.isEnabled('test');

      // Default is localStorage
      expect(localStorage.getItem('unleash-toolbar-state')).toBeTruthy();
    });

    it('should accept custom storage mode', () => {
      initUnleashToolbar(mockClient, { storageMode: 'session' });

      const toolbar = getToolbar();
      toolbar.setFlagOverride('test', { type: 'flag', value: true });

      expect(sessionStorage.getItem('unleash-toolbar-state')).toBeTruthy();
      expect(localStorage.getItem('unleash-toolbar-state')).toBeNull();
    });

    it('should accept custom storage key', () => {
      initUnleashToolbar(mockClient, { storageKey: 'custom-key' });

      const toolbar = getToolbar();
      toolbar.setFlagOverride('test', { type: 'flag', value: true });

      expect(localStorage.getItem('custom-key')).toBeTruthy();
      expect(localStorage.getItem('unleash-toolbar-state')).toBeNull();
    });

    it('should accept sortAlphabetically option', () => {
      const wrapped = initUnleashToolbar(mockClient, { sortAlphabetically: true });

      wrapped.isEnabled('zebra');
      wrapped.isEnabled('apple');
      wrapped.isEnabled('banana');

      const toolbar = getToolbar();
      const flagNames = toolbar.getFlagNames();

      // Should be alphabetically sorted
      expect(flagNames[0]).toBe('apple');
      expect(flagNames[1]).toBe('banana');
      expect(flagNames[2]).toBe('zebra');
    });

    it('should handle all options together', () => {
      initUnleashToolbar(mockClient, {
        storageMode: 'session',
        storageKey: 'test-key',
        sortAlphabetically: true,
      });

      const toolbar = getToolbar();
      toolbar.setFlagOverride('flag', { type: 'flag', value: true });

      expect(sessionStorage.getItem('test-key')).toBeTruthy();
    });
  });

  describe('toolbar instance methods', () => {
    it('should provide getState method', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      const state = toolbar.getState();

      expect(state).toBeDefined();
      expect(state.flags).toBeDefined();
      expect(state.contextOverrides).toBeDefined();
    });

    it('should provide setFlagOverride method', () => {
      const wrapped = initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      toolbar.setFlagOverride('testFlag', { type: 'flag', value: true });

      expect(wrapped.isEnabled('testFlag')).toBe(true);
    });

    it('should provide setContextOverride method', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      toolbar.setContextOverride({ userId: 'user123' });

      const state = toolbar.getState();
      expect(state.contextOverrides.userId).toBe('user123');
    });

    it('should provide removeContextOverride method', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      toolbar.setContextOverride({ userId: 'user123', sessionId: 'session' });
      toolbar.removeContextOverride('userId');

      const state = toolbar.getState();
      expect(state.contextOverrides.userId).toBeUndefined();
      expect(state.contextOverrides.sessionId).toBe('session');
    });

    it('should provide resetOverrides method', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      toolbar.setFlagOverride('flag1', { type: 'flag', value: true });
      toolbar.setContextOverride({ userId: 'user123' });
      toolbar.resetOverrides();

      const state = toolbar.getState();
      expect(state.flags.flag1?.override).toBeNull();
      // Context overrides should remain
      expect(state.contextOverrides.userId).toBe('user123');
    });

    it('should provide resetContextOverrides method', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();
      toolbar.setContextOverride({ userId: 'user123' });
      toolbar.resetContextOverrides();

      const state = toolbar.getState();
      expect(state.contextOverrides).toEqual({});
    });

    it('should provide destroy method', () => {
      initUnleashToolbar(mockClient, { storageKey: 'test-destroy' });

      const toolbar = getToolbar();
      toolbar.setFlagOverride('test', { type: 'flag', value: true });
      expect(localStorage.getItem('test-destroy')).toBeTruthy();

      toolbar.destroy();
      expect(localStorage.getItem('test-destroy')).toBeNull();
    });

    it('should provide show and hide methods', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      // These methods exist and don't throw (UI not loaded in tests)
      expect(() => toolbar.show()).not.toThrow();
      expect(() => toolbar.hide()).not.toThrow();
    });

    it('should expose wrapped client on toolbar instance', () => {
      const wrapped = initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      expect(toolbar.client).toBe(wrapped);
    });
  });

  describe('integration with wrapped client', () => {
    it('should apply overrides set through toolbar to client evaluations', () => {
      const wrapped = initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      // Set override through toolbar instance
      toolbar.setFlagOverride('feature', { type: 'flag', value: true });
      // Check through wrapped client
      expect(wrapped.isEnabled('feature')).toBe(true);
    });

    it('should trigger client update listeners when overrides change', () => {
      const wrapped = initUnleashToolbar(mockClient);
      const listener = vi.fn();

      wrapped.on('update', listener);

      const toolbar = getToolbar();

      toolbar.setFlagOverride('feature', { type: 'flag', value: true });

      expect(listener).toHaveBeenCalled();
    });

    it('should share state between toolbar and client', () => {
      const wrapped = initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      // Set through toolbar
      toolbar.setFlagOverride('flag1', { type: 'flag', value: true });
      // Evaluate through client (records evaluation)
      wrapped.isEnabled('flag1');

      // Check state through toolbar
      const state = toolbar.getState();
      expect(state.flags.flag1).toBeDefined();
      expect(state.flags.flag1.override).toEqual({ type: 'flag', value: true });
    });

    it('should persist state across multiple initializations', () => {
      const storageKey = 'test-persistence';

      // First initialization
      let wrapped = initUnleashToolbar(mockClient, { storageKey });

      const toolbar = getToolbar();

      toolbar.setFlagOverride('persistentFlag', { type: 'flag', value: true });

      // Second initialization (simulating page reload)
      wrapped = initUnleashToolbar(mockClient, { storageKey });

      expect(wrapped.isEnabled('persistentFlag')).toBe(true);
    });

    it('should work with different clients', () => {
      const client1 = { ...mockClient } as UnleashClient;
      const client2 = { ...mockClient } as UnleashClient;

      const wrapped1 = initUnleashToolbar(client1, { storageKey: 'client1' });
      const wrapped2 = initUnleashToolbar(client2, { storageKey: 'client2' });

      expect(wrapped1.__original).toBe(client1);
      expect(wrapped2.__original).toBe(client2);
    });
  });

  describe('UMD global export', () => {
    it('should expose UnleashToolbar.init on window', () => {
      // biome-ignore lint/suspicious/noExplicitAny: no type for window
      const umdExport = (window as any).UnleashToolbar;

      expect(umdExport).toBeDefined();
      expect(umdExport.init).toBe(initUnleashToolbar);
    });

    it('should allow initialization via global', () => {
      // biome-ignore lint/suspicious/noExplicitAny: no type for window
      const umdExport = (window as any).UnleashToolbar;

      const wrapped = umdExport.init(mockClient);

      expect(wrapped).toBeDefined();
      expect(wrapped.isEnabled).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle initialization without options', () => {
      expect(() => initUnleashToolbar(mockClient)).not.toThrow();
    });

    it('should handle empty options object', () => {
      expect(() => initUnleashToolbar(mockClient, {})).not.toThrow();
    });

    it('should handle partial options', () => {
      expect(() => initUnleashToolbar(mockClient, { storageMode: 'session' })).not.toThrow();
    });

    it('should handle multiple toolbar instances with different storage keys', () => {
      initUnleashToolbar(mockClient, { storageKey: 'toolbar1' });

      // Create another instance (overwrites window.unleashToolbar)
      initUnleashToolbar(mockClient, { storageKey: 'toolbar2' });

      const toolbar = getToolbar();

      toolbar.setFlagOverride('flag', { type: 'flag', value: true });

      // Should use toolbar2's storage
      expect(localStorage.getItem('toolbar2')).toBeTruthy();
    });

    it('should handle client that is already wrapped', () => {
      const wrapped1 = initUnleashToolbar(mockClient);
      const wrapped2 = initUnleashToolbar(wrapped1, { storageKey: 'wrapped-again' });

      // Should return the same wrapped instance
      expect(wrapped2).toBe(wrapped1);
    });

    it('should work with minimal client implementation', () => {
      const minimalClient = {
        isEnabled: vi.fn(() => false),
        getVariant: vi.fn(() => ({ name: 'control', enabled: false })),
        getContext: vi.fn(() => ({})),
        updateContext: vi.fn(() => Promise.resolve()),
        on: vi.fn(),
        start: vi.fn(() => Promise.resolve()),
      } as unknown as UnleashClient;

      const wrapped = initUnleashToolbar(minimalClient);

      expect(() => wrapped.isEnabled('flag')).not.toThrow();
      expect(() => wrapped.getVariant('flag')).not.toThrow();
    });
  });

  describe('state persistence', () => {
    it('should persist flag overrides with localStorage', () => {
      initUnleashToolbar(mockClient, { storageKey: 'persist-test' });

      const toolbar = getToolbar();

      toolbar.setFlagOverride('flag', { type: 'flag', value: true });

      const stored = JSON.parse(localStorage.getItem('persist-test') || '{}');
      expect(stored.flags.flag.override).toEqual({ type: 'flag', value: true });
    });

    it('should persist context overrides with localStorage', () => {
      initUnleashToolbar(mockClient, { storageKey: 'persist-test' });

      const toolbar = getToolbar();

      toolbar.setContextOverride({ userId: 'test-user' });

      const stored = JSON.parse(localStorage.getItem('persist-test') || '{}');
      expect(stored.contextOverrides.userId).toBe('test-user');
    });

    it('should not persist with storageMode memory', () => {
      initUnleashToolbar(mockClient, { storageMode: 'memory', storageKey: 'no-persist' });

      const toolbar = getToolbar();
      toolbar.setFlagOverride('flag', { type: 'flag', value: true });

      expect(localStorage.getItem('no-persist')).toBeNull();
      expect(sessionStorage.getItem('no-persist')).toBeNull();
    });

    it('should clear persistence on destroy', () => {
      initUnleashToolbar(mockClient, { storageKey: 'clear-test' });

      const toolbar = getToolbar();

      toolbar.setFlagOverride('flag', { type: 'flag', value: true });
      expect(localStorage.getItem('clear-test')).toBeTruthy();

      toolbar.destroy();
      expect(localStorage.getItem('clear-test')).toBeNull();
    });
  });

  describe('toolbar UI initialization', () => {
    it('should not throw when UI methods are called before UI loads', () => {
      initUnleashToolbar(mockClient);

      const toolbar = getToolbar();

      // UI loads async, these should be safe to call
      expect(() => toolbar.show()).not.toThrow();
      expect(() => toolbar.hide()).not.toThrow();
      expect(() => toolbar.destroy()).not.toThrow();
    });
  });
});
