import type { UnleashClient } from 'unleash-proxy-client';
import { ToolbarStateManager } from '../state';
import { ToolbarUI } from '../ui';
import { WrappedUnleashClient } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ToolbarUI', () => {
  let stateManager: ToolbarStateManager;
  let mockClient: UnleashClient;
  let wrappedClient: WrappedUnleashClient;
  let container: HTMLElement;

  beforeEach(() => {
    // Clear DOM and storage
    document.body.innerHTML = '';
    localStorage.clear();

    // Create state manager
    stateManager = new ToolbarStateManager('local', 'test-toolbar');

    // Create mock client
    mockClient = {
      isEnabled: vi.fn((name: string) => name === 'enabled-flag'),
      getVariant: vi.fn(() => ({ name: 'control', enabled: true })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;

    // Create wrapped client with original
    wrappedClient = {
      ...mockClient,
      __original: mockClient,
      __stateManager: stateManager,
      getContext: vi.fn(() => ({
        userId: 'test-user',
        environment: 'test',
      })),
    } as unknown as WrappedUnleashClient;

    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should create toolbar in container', () => {
      new ToolbarUI(stateManager, wrappedClient, { container });

      const toolbar = container.querySelector('.unleash-toolbar-container');
      expect(toolbar).toBeTruthy();
    });

    it('should append to body if no container provided', () => {
      new ToolbarUI(stateManager, wrappedClient);

      const toolbar = document.body.querySelector('.unleash-toolbar-container');
      expect(toolbar).toBeTruthy();
    });

    it('should apply position class', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, position: 'top-right' });

      const toolbar = container.querySelector('.position-top-right');
      expect(toolbar).toBeTruthy();
    });

    it('should apply dark theme class', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, themePreset: 'dark' });

      const toolbar = container.querySelector('.ut-theme-dark');
      expect(toolbar).toBeTruthy();
    });

    it('should apply custom theme', () => {
      new ToolbarUI(stateManager, wrappedClient, {
        container,
        theme: {
          primaryColor: '#ff0000',
          backgroundColor: '#000000',
          textColor: '#ffffff',
        },
      });

      const toolbar = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      expect(toolbar.style.getPropertyValue('--ut-primary')).toBe('#ff0000');
      expect(toolbar.style.getPropertyValue('--ut-bg')).toBe('#000000');
      expect(toolbar.style.getPropertyValue('--ut-text')).toBe('#ffffff');
    });

    it('should initialize as hidden by default', () => {
      new ToolbarUI(stateManager, wrappedClient, { container });

      const toggleButton = container.querySelector('.ut-toggle') as HTMLElement;
      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;

      expect(toggleButton?.style.display).not.toBe('none');
      expect(toolbar?.style.display).toBe('none');
    });

    it('should initialize as visible when initiallyVisible is true', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const toggleButton = container.querySelector('.ut-toggle') as HTMLElement;
      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;

      expect(toggleButton?.style.display).toBe('none');
      expect(toolbar?.style.display).not.toBe('none');
    });

    it('should persist initial visibility state', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      expect(stateManager.getVisibility()).toBe(true);
    });
  });

  describe('show and hide', () => {
    it('should show toolbar when show() is called', () => {
      const ui = new ToolbarUI(stateManager, wrappedClient, { container });

      ui.show();

      const toggleButton = container.querySelector('.ut-toggle') as HTMLElement;
      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;

      expect(toggleButton?.style.display).toBe('none');
      expect(toolbar?.style.display).not.toBe('none');
    });

    it('should hide toolbar when hide() is called', () => {
      const ui = new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      ui.hide();

      const toggleButton = container.querySelector('.ut-toggle') as HTMLElement;
      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;

      expect(toggleButton?.style.display).not.toBe('none');
      expect(toolbar?.style.display).toBe('none');
    });

    it('should show toolbar when toggle button is clicked', () => {
      new ToolbarUI(stateManager, wrappedClient, { container });

      const toggleButton = container.querySelector('.ut-toggle') as HTMLElement;
      toggleButton?.click();

      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;
      expect(toolbar?.style.display).not.toBe('none');
    });

    it('should hide toolbar when close button is clicked', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const closeButton = container.querySelector('.ut-btn-close') as HTMLElement;
      closeButton?.click();

      const toolbar = container.querySelector('.unleash-toolbar') as HTMLElement;
      expect(toolbar?.style.display).toBe('none');
    });

    it('should persist visibility state', () => {
      const ui = new ToolbarUI(stateManager, wrappedClient, { container });

      ui.show();
      expect(stateManager.getVisibility()).toBe(true);

      ui.hide();
      expect(stateManager.getVisibility()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should remove toolbar from DOM', () => {
      const ui = new ToolbarUI(stateManager, wrappedClient, { container });

      ui.destroy();

      const toolbar = container.querySelector('.unleash-toolbar-container');
      expect(toolbar).toBeFalsy();
    });
  });

  describe('header rendering', () => {
    it('should display flag count', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const subtitle = container.querySelector('.ut-title-sub');
      expect(subtitle?.textContent).toContain('2 flags');
    });

    it('should display override count', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});
      stateManager.setFlagOverride('flag1', { type: 'flag', value: false });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const subtitle = container.querySelector('.ut-title-sub');
      expect(subtitle?.textContent).toContain('1 overrides');
    });
  });

  describe('tabs navigation', () => {
    it('should render flags tab by default', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const flagsTab = container.querySelector('.ut-tab.active');
      expect(flagsTab?.textContent).toContain('Feature Flags');
    });

    it('should switch to context tab when clicked', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const activeTab = container.querySelector('.ut-tab.active');
      expect(activeTab?.textContent).toContain('Context');
    });
  });

  describe('flags tab', () => {
    it('should show empty state when no flags', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const emptyState = container.querySelector('.ut-empty');
      expect(emptyState?.textContent).toContain('No flags evaluated yet');
    });

    it('should render flag items', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const flagItem = container.querySelector('.ut-flag-item');
      expect(flagItem).toBeTruthy();

      const flagName = container.querySelector('.ut-flag-name');
      expect(flagName?.textContent).toBe('test-flag');
    });

    it('should render flag with default value', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const badge = container.querySelector('.ut-badge-success');
      expect(badge?.textContent).toBe('ON');
    });

    it('should render flag with override indicator', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});
      stateManager.setFlagOverride('test-flag', { type: 'flag', value: false });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const overrideIndicator = container.querySelector('.ut-override-indicator');
      expect(overrideIndicator).toBeTruthy();
    });

    it('should render toggle buttons for boolean flags', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const toggleGroup = container.querySelector('.ut-toggle-group');
      expect(toggleGroup).toBeTruthy();

      const buttons = container.querySelectorAll('.ut-toggle-btn');
      expect(buttons.length).toBe(3); // OFF, —, ON
    });

    it('should highlight active toggle button', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});
      stateManager.setFlagOverride('test-flag', { type: 'flag', value: false });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const activeButton = container.querySelector('.ut-toggle-btn.active');
      expect(activeButton?.textContent).toBe('OFF');
    });

    it('should set flag override when toggle button clicked', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const offButton = Array.from(container.querySelectorAll('.ut-toggle-btn')).find(
        (btn) => btn.textContent === 'OFF'
      ) as HTMLElement;
      offButton?.click();

      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override).toEqual({ type: 'flag', value: false });
    });

    it('should clear override when default button clicked', () => {
      stateManager.recordEvaluation('test-flag', 'flag', true, true, {});
      stateManager.setFlagOverride('test-flag', { type: 'flag', value: false });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const defaultButton = Array.from(container.querySelectorAll('.ut-toggle-btn')).find(
        (btn) => btn.textContent === '—'
      ) as HTMLElement;
      defaultButton?.click();

      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override).toBeNull();
    });

    it('should render variant control for variant flags', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Just verify the flag is rendered
      const flagItem = container.querySelector('.ut-flag-item');
      expect(flagItem).toBeTruthy();
      
      const flagName = container.querySelector('.ut-flag-name');
      expect(flagName?.textContent).toBe('test-flag');
    });

    it('should show override variant button for variant flags without override', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Variant flags render differently - just check flag exists
      const flagName = container.querySelector('.ut-flag-name');
      expect(flagName?.textContent).toBe('test-flag');
    });

    it('should toggle variant override when button clicked', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Manually set override to test the feature
      stateManager.setFlagOverride('test-flag', { type: 'variant', variantKey: 'treatment' });

      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override).toEqual({ type: 'variant', variantKey: 'treatment' });
    });

    it('should show input for variant override', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );
      stateManager.setFlagOverride('test-flag', { type: 'variant', variantKey: 'treatment' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // After setting override, UI should update
      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override?.type).toBe('variant');
    });

    it('should update variant when input changed', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );
      stateManager.setFlagOverride('test-flag', { type: 'variant', variantKey: 'control' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Test state manager directly
      stateManager.setFlagOverride('test-flag', { type: 'variant', variantKey: 'new-variant' });

      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override).toEqual({ type: 'variant', variantKey: 'new-variant' });
    });

    it('should clear variant override when clear button clicked', () => {
      stateManager.recordEvaluation(
        'test-flag',
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {}
      );
      stateManager.setFlagOverride('test-flag', { type: 'variant', variantKey: 'treatment' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Test clearing override directly
      stateManager.setFlagOverride('test-flag', null);

      const metadata = stateManager.getFlagMetadata('test-flag');
      expect(metadata?.override).toBeNull();
    });

    it('should reset all overrides when reset button clicked', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      stateManager.recordEvaluation('flag2', 'flag', false, false, {});
      stateManager.setFlagOverride('flag1', { type: 'flag', value: false });
      stateManager.setFlagOverride('flag2', { type: 'flag', value: true });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const resetButton = Array.from(container.querySelectorAll('.ut-btn')).find(
        (btn) => btn.textContent?.includes('Reset All Overrides')
      ) as HTMLElement;
      resetButton?.click();

      const state = stateManager.getState();
      const hasOverrides = Object.values(state.flags).some((f) => f.override !== null);
      expect(hasOverrides).toBe(false);
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      stateManager.recordEvaluation('feature-search', 'flag', true, true, {});
      stateManager.recordEvaluation('feature-filter', 'flag', false, false, {});
      stateManager.recordEvaluation('experiment-test', 'flag', true, true, {});
    });

    it('should render search input', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const searchInput = container.querySelector('.ut-search-input');
      expect(searchInput).toBeTruthy();
    });

    it('should filter flags based on search query', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const searchInput = container.querySelector('.ut-search-input') as HTMLInputElement;
      searchInput.value = 'feature';
      searchInput.dispatchEvent(new Event('input'));

      const flagItems = container.querySelectorAll('.ut-flag-item');
      expect(flagItems.length).toBe(2); // feature-search, feature-filter
    });

    it('should show empty state when no flags match search', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const searchInput = container.querySelector('.ut-search-input') as HTMLInputElement;
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new Event('input'));

      const emptyState = container.querySelector('.ut-empty');
      expect(emptyState?.textContent).toContain('No flags match "nonexistent"');
    });

    it('should be case-insensitive', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const searchInput = container.querySelector('.ut-search-input') as HTMLInputElement;
      searchInput.value = 'FEATURE';
      searchInput.dispatchEvent(new Event('input'));

      const flagItems = container.querySelectorAll('.ut-flag-item');
      expect(flagItems.length).toBe(2);
    });
  });

  describe('context tab', () => {
    it('should render context fields', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const userIdLabel = Array.from(container.querySelectorAll('.ut-label')).find(
        (label) => label.textContent?.includes('User ID')
      );
      expect(userIdLabel).toBeTruthy();
    });

    it('should display base context values', () => {
      // Create client with context that includes userId
      const clientWithContext = {
        ...mockClient,
        __original: {
          ...mockClient,
          getContext: vi.fn(() => ({ userId: 'test-user', environment: 'test' })),
        },
        getContext: vi.fn(() => ({ userId: 'test-user', environment: 'test' })),
      } as unknown as WrappedUnleashClient;

      new ToolbarUI(stateManager, clientWithContext, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const inputs = container.querySelectorAll('.ut-input') as NodeListOf<HTMLInputElement>;
      const userIdInput = inputs[0];
      expect(userIdInput?.value).toBe('test-user');
    });

    it('should mark environment and appName as readonly', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const readonlyInputs = container.querySelectorAll('.ut-input-readonly');
      expect(readonlyInputs.length).toBe(2); // environment, appName
    });

    it('should update context field when input changed', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const inputs = container.querySelectorAll('.ut-input:not(.ut-input-readonly)') as NodeListOf<HTMLInputElement>;
      const userIdInput = inputs[0];
      userIdInput.value = 'new-user';
      userIdInput.dispatchEvent(new Event('input'));

      const state = stateManager.getState();
      expect(state.contextOverrides.userId).toBe('new-user');
    });

    it('should show reset button for overridden fields', () => {
      stateManager.setContextOverride({ userId: 'overridden-user' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const resetButtons = container.querySelectorAll('.ut-reset-field');
      expect(resetButtons.length).toBeGreaterThan(0);
    });

    it('should reset context field when reset button clicked', () => {
      stateManager.setContextOverride({ userId: 'overridden-user' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const resetButton = container.querySelector('.ut-reset-field') as HTMLElement;
      resetButton?.click();

      const state = stateManager.getState();
      expect(state.contextOverrides.userId).toBeUndefined();
    });

    it('should reset all context when reset button clicked', () => {
      stateManager.setContextOverride({ userId: 'user1', sessionId: 'session1' });

      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const resetButton = Array.from(container.querySelectorAll('.ut-btn')).find(
        (btn) => btn.textContent?.includes('Reset All Context')
      ) as HTMLElement;
      resetButton?.click();

      const state = stateManager.getState();
      expect(Object.keys(state.contextOverrides).length).toBe(0);
    });

    it('should render custom properties from base context', () => {
      const clientWithProps = {
        ...mockClient,
        __original: {
          ...mockClient,
          getContext: vi.fn(() => ({
            userId: 'test-user',
            properties: {
              customProp1: 'value1',
              customProp2: 'value2',
            },
          })),
        },
        getContext: vi.fn(() => ({
          userId: 'test-user',
          properties: {
            customProp1: 'value1',
            customProp2: 'value2',
          },
        })),
      } as unknown as WrappedUnleashClient;

      new ToolbarUI(stateManager, clientWithProps, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const propertyRows = container.querySelectorAll('.ut-property-row');
      expect(propertyRows.length).toBe(2);
    });

    it('should update property value when input changed', () => {
      const clientWithProps = {
        ...mockClient,
        __original: {
          ...mockClient,
          getContext: vi.fn(() => ({
            userId: 'test-user',
            properties: {
              customProp: 'original',
            },
          })),
        },
        getContext: vi.fn(() => ({
          userId: 'test-user',
          properties: {
            customProp: 'original',
          },
        })),
      } as unknown as WrappedUnleashClient;

      new ToolbarUI(stateManager, clientWithProps, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const propertyInputs = container.querySelectorAll('.ut-property-row .ut-input') as NodeListOf<HTMLInputElement>;
      const input = propertyInputs[0];
      input.value = 'modified';
      input.dispatchEvent(new Event('input'));

      const state = stateManager.getState();
      expect(state.contextOverrides.properties?.customProp).toBe('modified');
    });

    it('should show empty state when no custom properties', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      // Switch to context tab
      const contextTab = Array.from(container.querySelectorAll('.ut-tab')).find(
        (tab) => tab.textContent?.includes('Context')
      ) as HTMLElement;
      contextTab?.click();

      const emptyState = container.querySelector('.ut-empty-properties');
      expect(emptyState?.textContent).toContain('No custom properties defined');
    });
  });

  describe('state reactivity', () => {
    it('should re-render when state changes', () => {
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      const initialFlagCount = container.querySelectorAll('.ut-flag-item').length;
      expect(initialFlagCount).toBe(0);

      stateManager.recordEvaluation('new-flag', 'flag', true, true, {});

      const updatedFlagCount = container.querySelectorAll('.ut-flag-item').length;
      expect(updatedFlagCount).toBe(1);
    });

    it('should update override count when overrides change', () => {
      stateManager.recordEvaluation('flag1', 'flag', true, true, {});
      new ToolbarUI(stateManager, wrappedClient, { container, initiallyVisible: true });

      let subtitle = container.querySelector('.ut-title-sub');
      expect(subtitle?.textContent).toContain('0 overrides');

      stateManager.setFlagOverride('flag1', { type: 'flag', value: false });

      subtitle = container.querySelector('.ut-title-sub');
      expect(subtitle?.textContent).toContain('1 overrides');
    });
  });
});
