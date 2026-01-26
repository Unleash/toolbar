/**
 * Server-side Next.js integration for Unleash Toolbar
 *
 * This module provides utilities for applying toolbar overrides in server components,
 * SSR, SSG, and App Router scenarios. It reads overrides from cookies to ensure
 * server-side flag evaluations respect client-side toolbar changes.
 *
 * @example App Router Server Component
 * ```tsx
 * import { cookies } from 'next/headers';
 * import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
 * import { applyToolbarOverrides } from '@unleash/toolbar/next/server';
 *
 * export default async function ServerPage() {
 *   const cookieStore = await cookies();
 *   const definitions = await getDefinitions();
 *   const modifiedDefinitions = applyToolbarOverrides(definitions, cookieStore);
 *
 *   const { toggles } = evaluateFlags(modifiedDefinitions, {
 *     sessionId: 'session-123'
 *   });
 *
 *   const flags = flagsClient(toggles);
 *   const isEnabled = flags.isEnabled('my-flag');
 *
 *   return <div>{isEnabled ? 'ON' : 'OFF'}</div>;
 * }
 * ```
 */

import type { IToggle } from '@unleash/nextjs';
import type { ClientFeaturesResponse } from 'unleash-client';
import type { VariantDefinition } from 'unleash-client/lib/variant';
import type { ToolbarState } from '../types';

export const UNLEASH_TOOLBAR_COOKIE = 'unleash-toolbar-state';

/**
 * Cookie store interface compatible with Next.js cookies()
 */
interface CookieStore {
  get(name: string): { value: string } | undefined;
}

/**
 * Parses toolbar state from cookie value
 */
export function parseToolbarState(cookieValue: string | undefined): ToolbarState | null {
  if (!cookieValue) return null;

  try {
    return JSON.parse(decodeURIComponent(cookieValue));
  } catch {
    return null;
  }
}

/**
 * Reads toolbar state from Next.js cookie store
 */
export function getToolbarStateFromCookies(cookieStore: CookieStore): ToolbarState | null {
  const cookie = cookieStore.get(UNLEASH_TOOLBAR_COOKIE);
  return parseToolbarState(cookie?.value);
}

/**
 * Applies toolbar overrides to Unleash feature flag definitions.
 *
 * Use this with getDefinitions() from @unleash/nextjs before evaluating flags
 * to ensure server-side evaluations respect toolbar overrides.
 *
 * @param definitions - Feature flag definitions from getDefinitions()
 * @param cookieStore - Next.js cookie store from cookies()
 * @returns Modified definitions with overrides applied
 *
 * @example
 * ```tsx
 * import { getDefinitions, evaluateFlags } from '@unleash/nextjs';
 * import { cookies } from 'next/headers';
 * import { applyToolbarOverrides } from '@unleash/toolbar/next/server';
 *
 * const cookieStore = await cookies();
 * const definitions = await getDefinitions();
 * const modified = applyToolbarOverrides(definitions, cookieStore);
 * const { toggles } = evaluateFlags(modified, context);
 * ```
 */
export function applyToolbarOverrides(
  definitions: ClientFeaturesResponse,
  cookieStore: CookieStore,
): ClientFeaturesResponse {
  const state = getToolbarStateFromCookies(cookieStore);

  if (!state || !definitions) return definitions;

  // Clone definitions to avoid mutation
  const modified = JSON.parse(JSON.stringify(definitions)) as ClientFeaturesResponse;

  if (!modified.features) {
    modified.features = [];
  }

  // Track which features we've seen
  const existingFeatureNames = new Set(modified.features.map((f) => f.name));

  // Apply overrides to existing features
  modified.features = modified.features.map((feature) => {
    const override = state.flags[feature.name]?.override;

    if (!override) return feature;

    if (override.type === 'flag') {
      // Force flag to enabled/disabled
      return {
        ...feature,
        enabled: override.value,
        // Override strategies to force the value
        // When enabling, ensure we have at least a default strategy
        strategies: override.value
          ? feature.strategies && feature.strategies.length > 0
            ? feature.strategies
            : [{ name: 'default', parameters: {}, constraints: [] }]
          : [],
      };
    }

    if (override.type === 'variant' && feature.variants) {
      // Force specific variant
      return {
        ...feature,
        enabled: true,
        strategies:
          feature.strategies && feature.strategies.length > 0
            ? feature.strategies
            : [{ name: 'default', parameters: {}, constraints: [] }],
        variants: feature.variants.map((v: VariantDefinition) => ({
          ...v,
          weight: v.name === override.variantKey ? 1000 : 0,
        })),
      };
    }

    return feature;
  });

  // Add features that don't exist in the API but have overrides
  for (const [flagName, metadata] of Object.entries(state.flags)) {
    if (!existingFeatureNames.has(flagName) && metadata.override) {
      const override = metadata.override;

      if (override.type === 'flag') {
        // Add a new feature for the override
        modified.features.push({
          name: flagName,
          enabled: override.value,
          strategies: override.value ? [{ name: 'default', parameters: {}, constraints: [] }] : [],
        });
      } else if (override.type === 'variant') {
        // Add a new feature with a variant
        modified.features.push({
          name: flagName,
          enabled: true,
          strategies: [{ name: 'default', parameters: {}, constraints: [] }],
          variants: [
            {
              name: override.variantKey,
              weight: 1000,
            },
          ],
        });
      }
    }
  }

  return modified;
}

/**
 * Applies toolbar overrides to evaluated toggles.
 *
 * Alternative to applyToolbarOverrides() - use this if you already have
 * evaluated toggles and want to apply overrides post-evaluation.
 *
 * @param toggles - Evaluated toggles array from evaluateFlags()
 * @param cookieStore - Next.js cookie store from cookies()
 * @returns Modified toggles with overrides applied
 *
 * @example
 * ```tsx
 * import { getDefinitions, evaluateFlags, flagsClient } from '@unleash/nextjs';
 * import { cookies } from 'next/headers';
 * import { applyToolbarOverridesToToggles } from '@unleash/toolbar/next/server';
 *
 * const definitions = await getDefinitions();
 * const { toggles } = evaluateFlags(definitions, context);
 * const modified = applyToolbarOverridesToToggles(toggles, await cookies());
 * const flags = flagsClient(modified);
 * ```
 */
export function applyToolbarOverridesToToggles(
  toggles: IToggle[],
  cookieStore: CookieStore,
): IToggle[] {
  const state = getToolbarStateFromCookies(cookieStore);

  if (!state || !toggles) return toggles;

  return toggles.map((toggle) => {
    const override = state.flags[toggle.name]?.override;

    if (!override) return toggle;

    if (override.type === 'flag') {
      return {
        ...toggle,
        enabled: override.value,
        variant: override.value ? toggle.variant : { name: 'disabled', enabled: false },
      };
    }

    if (override.type === 'variant') {
      return {
        ...toggle,
        enabled: true,
        variant: {
          name: override.variantKey,
          enabled: true,
          payload: toggle.variant?.payload,
        },
      };
    }

    return toggle;
  });
}
