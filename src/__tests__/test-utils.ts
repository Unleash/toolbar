import type { UnleashClient } from 'unleash-proxy-client';
import { vi } from 'vitest';

/**
 * Let the deferred event dispatch run. Awaiting a resolved promise is enough:
 * the dispatch is scheduled the same way, and it was queued first — no timers
 * involved, so this holds under fake timers too.
 */
export const flushMicrotasks = () => Promise.resolve();

/**
 * A stand-in Unleash client. Every flag is off and every variant is `control`
 * unless a test overrides the method it cares about.
 */
export function createMockClient(overrides: Partial<UnleashClient> = {}): UnleashClient {
  return {
    isEnabled: vi.fn(() => false),
    getVariant: vi.fn(() => ({ name: 'control', enabled: false })),
    getContext: vi.fn(() => ({ appName: 'test' })),
    updateContext: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    off: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    getAllToggles: vi.fn(() => []),
    setContextField: vi.fn(),
    ...overrides,
  } as unknown as UnleashClient;
}
