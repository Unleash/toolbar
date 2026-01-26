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
 * const cookieStore = await cookies();
 * const definitions = await getDefinitions();
 * const modified = applyToolbarOverrides(definitions, cookieStore);
 * const { toggles } = evaluateFlags(modified, context);
 * ```
 */
export function applyToolbarOverrides(definitions: any, cookieStore: CookieStore): any {
  const state = getToolbarStateFromCookies(cookieStore);

  if (!state || !definitions) return definitions;

  // Clone definitions to avoid mutation
  const modified = JSON.parse(JSON.stringify(definitions));

  // Apply flag overrides
  if (modified.features && Array.isArray(modified.features)) {
    modified.features = modified.features.map((feature: any) => {
      const override = state.flags[feature.name]?.override;

      if (!override) return feature;

      if (override.type === 'flag') {
        // Force flag to enabled/disabled
        return {
          ...feature,
          enabled: override.value,
          // Override strategies to force the value
          strategies: override.value ? [{ name: 'default', parameters: {}, constraints: [] }] : [],
        };
      }

      if (override.type === 'variant' && feature.variants) {
        // Force specific variant
        return {
          ...feature,
          enabled: true,
          variants: feature.variants.map((v: any) => ({
            ...v,
            weight: v.name === override.variantKey ? 1000 : 0,
            weightType: 'fix' as const,
          })),
        };
      }

      return feature;
    });
  }

  return modified;
}

/**
 * Applies toolbar overrides to evaluated toggles.
 *
 * Alternative to applyToolbarOverrides() - use this if you already have
 * evaluated toggles and want to apply overrides post-evaluation.
 *
 * @param toggles - Evaluated toggles array
 * @param cookieStore - Next.js cookie store from cookies()
 * @returns Modified toggles with overrides applied
 *
 * @example
 * ```tsx
 * const { toggles } = evaluateFlags(definitions, context);
 * const modified = applyToolbarOverridesToToggles(toggles, await cookies());
 * const flags = flagsClient(modified);
 * ```
 */
export function applyToolbarOverridesToToggles(toggles: any[], cookieStore: CookieStore): any[] {
  const state = getToolbarStateFromCookies(cookieStore);

  if (!state || !toggles) return toggles;

  return toggles.map((toggle: any) => {
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
