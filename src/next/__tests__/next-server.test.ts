import { describe, expect, it } from 'vitest';
import type { ToolbarState } from '../../types';
import {
  applyToolbarOverrides,
  applyToolbarOverridesToToggles,
  getToolbarStateFromCookies,
  parseToolbarState,
  UNLEASH_TOOLBAR_COOKIE,
} from '../server';

describe('Next.js Server Integration', () => {
  describe('parseToolbarState', () => {
    it('should parse valid JSON cookie value', () => {
      const state: ToolbarState = {
        flags: {
          'test-flag': {
            flagType: 'flag',
            lastDefaultValue: false,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag', value: true },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));
      const result = parseToolbarState(encoded);

      expect(result).toEqual(state);
    });

    it('should return null for undefined cookie', () => {
      expect(parseToolbarState(undefined)).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(parseToolbarState('invalid-json')).toBeNull();
    });
  });

  describe('getToolbarStateFromCookies', () => {
    it('should read toolbar state from cookie store', () => {
      const state: ToolbarState = {
        flags: {
          'test-flag': {
            flagType: 'flag',
            lastDefaultValue: false,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag', value: true },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const result = getToolbarStateFromCookies(cookieStore);
      expect(result).toEqual(state);
    });

    it('should return null when cookie is not present', () => {
      const cookieStore = {
        get: () => undefined,
      };

      const result = getToolbarStateFromCookies(cookieStore);
      expect(result).toBeNull();
    });
  });

  describe('applyToolbarOverrides', () => {
    it('should return original definitions when no cookie present', () => {
      const definitions = {
        version: 1,
        features: [{ name: 'test-flag', enabled: false, strategies: [] }],
      };

      const cookieStore = {
        get: () => undefined,
      };

      const result = applyToolbarOverrides(definitions, cookieStore);
      expect(result).toEqual(definitions);
    });

    it('should apply flag override to enabled state', () => {
      const state: ToolbarState = {
        flags: {
          'test-flag': {
            flagType: 'flag',
            lastDefaultValue: false,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag', value: true },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const definitions = {
        version: 1,
        features: [{ name: 'test-flag', enabled: false, strategies: [] }],
      };

      const result = applyToolbarOverrides(definitions, cookieStore);

      expect(result.features?.[0].enabled).toBe(true);
      expect(result.features?.[0].strategies).toEqual([
        { name: 'default', parameters: {}, constraints: [] },
      ]);
    });

    it('should apply flag override to disabled state', () => {
      const state: ToolbarState = {
        flags: {
          'test-flag': {
            flagType: 'flag',
            lastDefaultValue: true,
            lastEffectiveValue: false,
            lastContext: null,
            override: { type: 'flag', value: false },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const definitions = {
        version: 1,
        features: [
          {
            name: 'test-flag',
            enabled: true,
            strategies: [{ name: 'default', parameters: {}, constraints: [] }],
          },
        ],
      };

      const result = applyToolbarOverrides(definitions, cookieStore);

      expect(result.features?.[0].enabled).toBe(false);
      expect(result.features?.[0].strategies).toEqual([]);
    });

    it('should apply variant override', () => {
      const state: ToolbarState = {
        flags: {
          'test-variant': {
            flagType: 'variant',
            lastDefaultValue: { name: 'control', enabled: true },
            lastEffectiveValue: { name: 'variant-a', enabled: true },
            lastContext: null,
            override: { type: 'variant', variantKey: 'variant-a' },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const definitions = {
        version: 1,
        features: [
          {
            name: 'test-variant',
            enabled: true,
            strategies: [],
            variants: [
              { name: 'control', weight: 500, weightType: 'variable' },
              { name: 'variant-a', weight: 500, weightType: 'variable' },
            ],
          },
        ],
      };

      const result = applyToolbarOverrides(definitions, cookieStore);

      expect(result.features?.[0].enabled).toBe(true);
      expect(result.features?.[0].variants).toEqual([
        {
          name: 'control',
          weight: 0,
          weightType: 'variable',
          stickiness: undefined,
          payload: undefined,
          overrides: undefined,
        },
        {
          name: 'variant-a',
          weight: 1000,
          weightType: 'variable',
          stickiness: undefined,
          payload: undefined,
          overrides: undefined,
        },
      ]);
    });

    it('should not modify features without overrides', () => {
      const state: ToolbarState = {
        flags: {
          'flag-with-override': {
            flagType: 'flag',
            lastDefaultValue: false,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag', value: true },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const definitions = {
        version: 1,
        features: [
          { name: 'flag-with-override', enabled: false },
          { name: 'flag-without-override', enabled: false },
        ],
      };

      const result = applyToolbarOverrides(definitions, cookieStore);

      expect(result.features?.[0].enabled).toBe(true);
      expect(result.features?.[1].enabled).toBe(false);
    });
  });

  describe('applyToolbarOverridesToToggles', () => {
    it('should return original toggles when no cookie present', () => {
      const toggles = [
        {
          name: 'test-flag',
          enabled: false,
          variant: { name: 'disabled', enabled: false },
          impressionData: false,
        },
      ];

      const cookieStore = {
        get: () => undefined,
      };

      const result = applyToolbarOverridesToToggles(toggles, cookieStore);
      expect(result).toEqual(toggles);
    });

    it('should apply flag override to toggle', () => {
      const state: ToolbarState = {
        flags: {
          'test-flag': {
            flagType: 'flag',
            lastDefaultValue: false,
            lastEffectiveValue: true,
            lastContext: null,
            override: { type: 'flag', value: true },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const toggles = [
        {
          name: 'test-flag',
          enabled: false,
          variant: { name: 'disabled', enabled: false },
          impressionData: false,
        },
      ];

      const result = applyToolbarOverridesToToggles(toggles, cookieStore);

      expect(result[0].enabled).toBe(true);
    });

    it('should apply variant override to toggle', () => {
      const state: ToolbarState = {
        flags: {
          'test-variant': {
            flagType: 'variant',
            lastDefaultValue: { name: 'control', enabled: true },
            lastEffectiveValue: { name: 'variant-a', enabled: true },
            lastContext: null,
            override: { type: 'variant', variantKey: 'variant-a' },
          },
        },
        contextOverrides: {},
      };
      const encoded = encodeURIComponent(JSON.stringify(state));

      const cookieStore = {
        get: (name: string) => (name === UNLEASH_TOOLBAR_COOKIE ? { value: encoded } : undefined),
      };

      const toggles = [
        {
          name: 'test-variant',
          enabled: true,
          variant: { name: 'control', enabled: true, payload: { type: 'string', value: 'test' } },
          impressionData: false,
        },
      ];

      const result = applyToolbarOverridesToToggles(toggles, cookieStore);

      expect(result[0].enabled).toBe(true);
      expect(result[0].variant?.name).toBe('variant-a');
      expect(result[0].variant?.enabled).toBe(true);
    });
  });
});
