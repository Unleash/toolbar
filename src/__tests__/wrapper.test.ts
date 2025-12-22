import type { UnleashClient } from 'unleash-proxy-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolbarStateManager } from '../state';
import type { UnleashVariant } from '../types';
import { isWrappedClient, unwrapUnleashClient, wrapUnleashClient } from '../wrapper';

describe('wrapUnleashClient', () => {
  let mockClient: UnleashClient;
  let stateManager: ToolbarStateManager;

  beforeEach(() => {
    localStorage.clear();

    // Create a comprehensive mock Unleash client
    mockClient = {
      isEnabled: vi.fn((name: string) => name === 'enabledFlag'),
      getVariant: vi.fn((name: string) => ({
        name: name === 'variantFlag' ? 'blue' : 'control',
        enabled: name === 'variantFlag',
        payload: undefined,
      })),
      getContext: vi.fn(() => ({ sessionId: 'base-session' })),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(() => Promise.resolve()),
      getAllToggles: vi.fn(() => []),
      setContextField: vi.fn(),
      stop: vi.fn(),
      off: vi.fn(),
    } as unknown as UnleashClient;

    stateManager = new ToolbarStateManager('local', 'test-wrapper-state', false);
  });

  describe('basic wrapping', () => {
    it('should wrap client and expose wrapped methods', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      expect(wrapped.isEnabled).toBeDefined();
      expect(wrapped.getVariant).toBeDefined();
      expect(wrapped.on).toBeDefined();
      expect(wrapped.start).toBeDefined();
      expect(wrapped.__original).toBe(mockClient);
    });

    it('should return same instance if already wrapped', () => {
      const wrapped1 = wrapUnleashClient(mockClient, stateManager);
      const wrapped2 = wrapUnleashClient(wrapped1, stateManager);

      expect(wrapped1).toBe(wrapped2);
    });

    it('should forward start() calls to base client', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      await wrapped.start();

      expect(mockClient.start).toHaveBeenCalled();
    });

    it('should proxy non-overridden methods to base client', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      wrapped.getAllToggles();
      expect(mockClient.getAllToggles).toHaveBeenCalled();

      wrapped.stop();
      expect(mockClient.stop).toHaveBeenCalled();
    });

    it('should proxy property access to base client', () => {
      // biome-ignore lint/suspicious/noExplicitAny: creating a custom property on mock client
      (mockClient as any).customProperty = 'test-value';
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      // biome-ignore lint/suspicious/noExplicitAny: accessing custom property on wrapped client
      expect((wrapped as any).customProperty).toBe('test-value');
    });
  });

  describe('isEnabled interception', () => {
    it('should call base client and record evaluation', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      const result = wrapped.isEnabled('enabledFlag');

      expect(mockClient.isEnabled).toHaveBeenCalledWith('enabledFlag');
      expect(result).toBe(true);

      const metadata = stateManager.getFlagMetadata('enabledFlag');
      expect(metadata).toBeDefined();
      expect(metadata?.flagType).toBe('flag');
      expect(metadata?.lastDefaultValue).toBe(true);
      expect(metadata?.lastEffectiveValue).toBe(true);
    });

    it('should apply flag override when set', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      stateManager.setFlagOverride('enabledFlag', { type: 'flag', value: false });
      const result = wrapped.isEnabled('enabledFlag');

      expect(mockClient.isEnabled).toHaveBeenCalledWith('enabledFlag');
      expect(result).toBe(false); // Overridden
    });

    it('should override disabled flag to enabled', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      stateManager.setFlagOverride('disabledFlag', { type: 'flag', value: true });
      const result = wrapped.isEnabled('disabledFlag');

      expect(result).toBe(true);
    });

    it('should record evaluation with merged context', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      stateManager.setContextOverride({ userId: 'override-user' });

      wrapped.isEnabled('testFlag');

      const metadata = stateManager.getFlagMetadata('testFlag');
      expect(metadata?.lastContext).toMatchObject({
        sessionId: 'base-session',
        userId: 'override-user',
      });
    });
  });

  describe('getVariant interception', () => {
    it('should call base client and record evaluation', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      const result = wrapped.getVariant('variantFlag');

      expect(mockClient.getVariant).toHaveBeenCalledWith('variantFlag');
      expect(result.name).toBe('blue');
      expect(result.enabled).toBe(true);

      const metadata = stateManager.getFlagMetadata('variantFlag');
      expect(metadata).toBeDefined();
      expect(metadata?.flagType).toBe('variant');
    });

    it('should apply variant override', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      stateManager.setFlagOverride('variantFlag', { type: 'variant', variantKey: 'red' });
      const result = wrapped.getVariant('variantFlag');

      expect(result.name).toBe('red');
      expect(result.enabled).toBe(true);
    });

    it('should apply flag override to variant (disable)', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      stateManager.setFlagOverride('variantFlag', { type: 'flag', value: false });
      const result = wrapped.getVariant('variantFlag');

      expect(result).toBe(false);
    });

    it('should record evaluation with merged context', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      stateManager.setContextOverride({ userId: 'test-user' });

      wrapped.getVariant('testVariant');

      const metadata = stateManager.getFlagMetadata('testVariant');
      expect(metadata?.lastContext?.userId).toBe('test-user');
    });
  });

  describe('getContext wrapping', () => {
    it('should return merged context', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      stateManager.setContextOverride({ userId: 'override-user' });

      const context = wrapped.getContext();

      expect(context).toMatchObject({
        sessionId: 'base-session',
        userId: 'override-user',
      });
    });
  });

  describe('updateContext wrapping', () => {
    it('should forward updateContext to base client', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      await wrapped.updateContext({ userId: 'new-user' });

      expect(mockClient.updateContext).toHaveBeenCalledWith({ userId: 'new-user' });
    });
  });

  describe('event listener interception', () => {
    it('should track user update listeners', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const userListener = vi.fn();

      wrapped.on('update', userListener);

      expect(mockClient.on).toHaveBeenCalledWith('update', userListener);
    });

    it('should forward non-update events to base client', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const errorListener = vi.fn();

      wrapped.on('error', errorListener);

      expect(mockClient.on).toHaveBeenCalledWith('error', errorListener);
    });

    it('should trigger user listeners when flag override changes', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const userListener = vi.fn();

      wrapped.on('update', userListener);
      stateManager.setFlagOverride('flag1', { type: 'flag', value: true });

      expect(userListener).toHaveBeenCalled();
    });

    it('should trigger user listeners when context override changes', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const userListener = vi.fn();

      wrapped.on('update', userListener);

      // Wait for async context update to complete
      stateManager.setContextOverride({ userId: 'test-user' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(userListener).toHaveBeenCalled();
    });

    it('should handle errors in user listeners gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      wrapped.on('update', badListener);
      wrapped.on('update', goodListener);

      stateManager.setFlagOverride('flag1', { type: 'flag', value: true });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled(); // Should still be called

      consoleErrorSpy.mockRestore();
    });

    it('should trigger multiple user listeners', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      wrapped.on('update', listener1);
      wrapped.on('update', listener2);

      stateManager.setFlagOverride('flag1', { type: 'flag', value: true });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('SDK update event handling', () => {
    it('should re-evaluate flags when SDK emits update', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      // Record some flags
      wrapped.isEnabled('flag1');
      wrapped.isEnabled('flag2');

      // Get the SDK update callback
      const sdkUpdateCallback = (mockClient.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === 'update',
      )?.[1];

      // Change mock return values to simulate SDK config change
      (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);

      // Trigger SDK update
      sdkUpdateCallback?.();

      // Check that flags were re-evaluated
      const flag1Metadata = stateManager.getFlagMetadata('flag1');
      const flag2Metadata = stateManager.getFlagMetadata('flag2');

      expect(flag1Metadata?.lastDefaultValue).toBe(false);
      expect(flag2Metadata?.lastDefaultValue).toBe(false);
    });

    it('should handle variant flags in re-evaluation', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      wrapped.getVariant('variantFlag');

      const sdkUpdateCallback = (mockClient.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === 'update',
      )?.[1];

      // Change variant
      (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'green',
        enabled: true,
      });

      sdkUpdateCallback?.();

      const metadata = stateManager.getFlagMetadata('variantFlag');
      expect(metadata?.lastDefaultValue).toMatchObject({ name: 'green', enabled: true });
    });
  });

  describe('context override handling', () => {
    it('should update SDK context when toolbar context changes', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      void wrapped; // Used for side effects (subscription setup)

      stateManager.setContextOverride({ userId: 'override-user' });

      // Wait for async context update
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClient.updateContext).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'override-user',
        }),
      );
    });

    it('should strip appName and environment from context updates', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);
      void wrapped; // Used for side effects (subscription setup)

      stateManager.setContextOverride({
        userId: 'user123',
        appName: 'myApp',
        environment: 'production',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateCall = (mockClient.updateContext as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(updateCall).toMatchObject({ userId: 'user123' });
      expect(updateCall.appName).toBeUndefined();
      expect(updateCall.environment).toBeUndefined();
    });

    it('should re-evaluate flags after context update', async () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      wrapped.isEnabled('contextSensitiveFlag');

      // Change mock to simulate different result with new context
      (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

      stateManager.setContextOverride({ userId: 'different-user' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const metadata = stateManager.getFlagMetadata('contextSensitiveFlag');
      expect(metadata?.lastDefaultValue).toBe(true);
    });

    it('should handle updateContext failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (mockClient.updateContext as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Update failed'),
      );

      const wrapped = wrapUnleashClient(mockClient, stateManager);
      void wrapped; // Used for side effects (subscription setup)

      stateManager.setContextOverride({ userId: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update context'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('override application', () => {
    it('should preserve overrides after SDK updates', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      wrapped.isEnabled('flag1');
      stateManager.setFlagOverride('flag1', { type: 'flag', value: true });

      // Simulate SDK update
      const sdkUpdateCallback = (mockClient.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === 'update',
      )?.[1];
      (mockClient.isEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
      sdkUpdateCallback?.();

      // Override should still be applied
      const result = wrapped.isEnabled('flag1');
      expect(result).toBe(true);

      const metadata = stateManager.getFlagMetadata('flag1');
      expect(metadata?.lastDefaultValue).toBe(false); // SDK says false
      expect(metadata?.lastEffectiveValue).toBe(true); // But override makes it true
    });

    it('should handle variant override with non-variant default', () => {
      // Mock returns boolean instead of variant
      (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'disabled',
        enabled: false,
      });

      const wrapped = wrapUnleashClient(mockClient, stateManager);
      stateManager.setFlagOverride('flag', { type: 'variant', variantKey: 'custom' });

      const result = wrapped.getVariant('flag');

      expect(result).toMatchObject({
        name: 'custom',
        enabled: true,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent flag evaluations', () => {
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      wrapped.isEnabled('flag1');
      wrapped.isEnabled('flag2');
      wrapped.isEnabled('flag1'); // Duplicate

      const flagNames = stateManager.getFlagNames();
      expect(flagNames).toHaveLength(2); // Should not duplicate
    });

    it('should handle getContext returning empty object', () => {
      (mockClient.getContext as ReturnType<typeof vi.fn>).mockReturnValue({});
      const wrapped = wrapUnleashClient(mockClient, stateManager);

      const result = wrapped.isEnabled('flag');

      expect(result).toBeDefined();
      expect(mockClient.isEnabled).toHaveBeenCalledWith('flag');
    });

    it('should handle variant with payload', () => {
      const variantWithPayload: UnleashVariant = {
        name: 'blue',
        enabled: true,
        payload: { type: 'json', value: '{"key":"value"}' },
      };
      (mockClient.getVariant as ReturnType<typeof vi.fn>).mockReturnValue(variantWithPayload);

      const wrapped = wrapUnleashClient(mockClient, stateManager);
      const result = wrapped.getVariant('flag');

      expect(result.payload).toEqual({ type: 'json', value: '{"key":"value"}' });
    });
  });
});

describe('unwrapUnleashClient', () => {
  let mockClient: UnleashClient;
  let stateManager: ToolbarStateManager;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'control', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(() => Promise.resolve()),
    } as unknown as UnleashClient;
    stateManager = new ToolbarStateManager('memory', 'test', false);
  });

  it('should return original client from wrapped client', () => {
    const wrapped = wrapUnleashClient(mockClient, stateManager);
    const unwrapped = unwrapUnleashClient(wrapped);

    expect(unwrapped).toBe(mockClient);
  });

  it('should return same client if not wrapped', () => {
    const unwrapped = unwrapUnleashClient(mockClient);

    expect(unwrapped).toBe(mockClient);
  });
});

describe('isWrappedClient', () => {
  let mockClient: UnleashClient;
  let stateManager: ToolbarStateManager;

  beforeEach(() => {
    localStorage.clear();
    mockClient = {
      isEnabled: vi.fn(() => false),
      getVariant: vi.fn(() => ({ name: 'control', enabled: false })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(() => Promise.resolve()),
    } as unknown as UnleashClient;
    stateManager = new ToolbarStateManager('memory', 'test', false);
  });

  it('should return true for wrapped client', () => {
    const wrapped = wrapUnleashClient(mockClient, stateManager);

    expect(isWrappedClient(wrapped)).toBe(true);
  });

  it('should return false for unwrapped client', () => {
    expect(isWrappedClient(mockClient)).toBe(false);
  });
});
