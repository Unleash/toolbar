import { render, act } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolbarStateManager } from '../state';
import { wrapUnleashClient } from '../wrapper';
import { createMockClient } from "./test-utils";

/**
 * Reproduces the "Cannot update a component while rendering a different
 * component" warning: a subscriber that setStates, plus a component that
 * evaluates a not-yet-seen flag during its render.
 */

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
    let notifications = 0;

    function Subscriber({ children }: { children: React.ReactNode }) {
      const [, setTick] = useState(0);

      useEffect(() => {
        return stateManager.subscribe(() => {
          notifications += 1;
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
    // Absence of a React dev-mode warning is only meaningful if the subscriber
    // was actually reached — otherwise a reworded warning would pass silently
    expect(notifications).toBeGreaterThan(0);
  });
});
