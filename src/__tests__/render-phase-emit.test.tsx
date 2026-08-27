import { render, act } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolbarStateManager } from '../state';
import { wrapUnleashClient } from '../wrapper';
import type { UnleashClient } from 'unleash-proxy-client';

/**
 * Reproduces the "Cannot update a component while rendering a different
 * component" warning: a subscriber that setStates, plus a component that
 * evaluates a not-yet-seen flag during its render.
 */

function createMockClient(): UnleashClient {
  return {
    isEnabled: () => true,
    getVariant: () => ({ name: 'disabled', enabled: false }),
    getContext: () => ({ appName: 'test' }),
    updateContext: () => Promise.resolve(),
    on: () => undefined,
    off: () => undefined,
    start: () => Promise.resolve(),
    stop: () => undefined,
  } as unknown as UnleashClient;
}

describe('render-phase emit', () => {
  let errors: string[];
  let stateManager: ToolbarStateManager;
  let client: ReturnType<typeof wrapUnleashClient>;

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(String(args[0]));
    });
    localStorage.clear();
    stateManager = new ToolbarStateManager('memory', 'test-key', false);
    client = wrapUnleashClient(createMockClient(), stateManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not warn when a new flag is evaluated during another component render', async () => {
    // Stands in for the app's own toolbar-event subscriber (LogRocketProvider /
    // FlightRecorderProvider in the reported case)
    function Subscriber({ children }: { children: React.ReactNode }) {
      const [, setTick] = useState(0);

      useEffect(() => {
        return stateManager.subscribe(() => {
          setTick((t) => t + 1);
        });
      }, []);

      return <>{children}</>;
    }

    // Evaluates a flag whose name changes, so the second render records a
    // brand-new flag *during* the render phase
    function FlagConsumer({ flagName }: { flagName: string }) {
      const enabled = client.isEnabled(flagName);
      return <span>{String(enabled)}</span>;
    }

    const { rerender } = render(
      <Subscriber>
        <FlagConsumer flagName="flag-one" />
      </Subscriber>,
    );

    await act(async () => {
      rerender(
        <Subscriber>
          <FlagConsumer flagName="flag-two" />
        </Subscriber>,
      );
    });

    const renderPhaseWarnings = errors.filter((e) => e.includes('while rendering a different'));
    expect(renderPhaseWarnings).toEqual([]);
  });
});
