import type { UnleashClient } from 'unleash-proxy-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTabbableElements, rovingIndexForKey } from '../keyboard-controller';
import { ToolbarStateManager } from '../state';
import type { InitToolbarOptions, WrappedUnleashClient } from '../types';
import { ToolbarUI } from '../ui';

describe('rovingIndexForKey', () => {
  it('should step forward and wrap at the end', () => {
    expect(rovingIndexForKey('ArrowRight', 0, 3)).toBe(1);
    expect(rovingIndexForKey('ArrowRight', 2, 3)).toBe(0);
  });

  it('should step backward and wrap at the start', () => {
    expect(rovingIndexForKey('ArrowLeft', 2, 3)).toBe(1);
    expect(rovingIndexForKey('ArrowLeft', 0, 3)).toBe(2);
  });

  it('should treat the vertical arrows as equivalent', () => {
    expect(rovingIndexForKey('ArrowDown', 0, 3)).toBe(rovingIndexForKey('ArrowRight', 0, 3));
    expect(rovingIndexForKey('ArrowUp', 0, 3)).toBe(rovingIndexForKey('ArrowLeft', 0, 3));
  });

  it('should ignore Home and End unless they are opted into', () => {
    expect(rovingIndexForKey('Home', 1, 3)).toBeNull();
    expect(rovingIndexForKey('End', 1, 3)).toBeNull();
    expect(rovingIndexForKey('Home', 1, 3, { homeEnd: true })).toBe(0);
    expect(rovingIndexForKey('End', 1, 3, { homeEnd: true })).toBe(2);
  });

  it('should return null for keys that do not navigate', () => {
    expect(rovingIndexForKey('a', 0, 3)).toBeNull();
    expect(rovingIndexForKey('Enter', 0, 3)).toBeNull();
    expect(rovingIndexForKey('Tab', 0, 3)).toBeNull();
    expect(rovingIndexForKey('Escape', 0, 3)).toBeNull();
  });

  it('should stay in range when nothing is selected yet', () => {
    // indexOf() returns -1 for an unknown current value
    expect(rovingIndexForKey('ArrowLeft', -1, 3)).toBe(1);
    expect(rovingIndexForKey('ArrowRight', -1, 3)).toBe(0);
  });

  it('should handle a single-item group by staying put', () => {
    expect(rovingIndexForKey('ArrowRight', 0, 1)).toBe(0);
    expect(rovingIndexForKey('ArrowLeft', 0, 1)).toBe(0);
  });

  it('should return null for an empty group rather than a bad index', () => {
    expect(rovingIndexForKey('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('keyboard and accessibility', () => {
  let stateManager: ToolbarStateManager;
  let wrappedClient: WrappedUnleashClient;
  let container: HTMLElement;
  let toolbar: ToolbarUI | null;

  const build = (options: InitToolbarOptions = {}) => {
    toolbar = new ToolbarUI(stateManager, wrappedClient, { container, ...options });
    return toolbar;
  };

  const panel = () => container.querySelector('.unleash-toolbar') as HTMLElement;
  const toggle = () => container.querySelector('.ut-toggle') as HTMLElement;
  const isOpen = () => panel().style.display !== 'none';

  /** Dispatch a key on `target`, bubbling so the root/document listeners see it */
  const press = (
    target: HTMLElement | Document,
    key: string,
    modifiers: Partial<KeyboardEventInit> = {},
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    target.dispatchEvent(event);
    return event;
  };

  /** Fire the default shortcut the way the platform under test would */
  const pressShortcut = (target: HTMLElement | Document = document) =>
    press(target, 'f', { ctrlKey: true, shiftKey: true });

  /** A control on the host page, standing in for the app's own UI */
  const pageInput = () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    return input;
  };

  /** Open the panel the way a keyboard user does: from a control on the page */
  const summonFrom = (origin: HTMLElement) => {
    origin.focus();
    pressShortcut();
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    toolbar = null;

    stateManager = new ToolbarStateManager('local', 'test-toolbar');

    const mockClient = {
      isEnabled: vi.fn(() => true),
      getVariant: vi.fn(() => ({ name: 'control', enabled: true })),
      getContext: vi.fn(() => ({})),
      updateContext: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      start: vi.fn(),
    } as unknown as UnleashClient;

    wrappedClient = {
      ...mockClient,
      __original: mockClient,
      getContext: vi.fn(() => ({ userId: 'test-user', environment: 'test' })),
    } as unknown as WrappedUnleashClient;

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // destroy() detaches the document-level shortcut listener; without it the
    // next test's document keydowns would reach a stale toolbar.
    toolbar?.destroy();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('open button accessibility', () => {
    it('should expose text as the accessible name rather than only a title', () => {
      build();

      const label = toggle().querySelector('.ut-sr-only');
      expect(label?.textContent).toBe('Open Unleash Toolbar');
    });

    it('should not let the logo contribute to the accessible name', () => {
      build();

      expect(toggle().querySelector('img')?.getAttribute('alt')).toBe('');
    });

    it('should name the shortcut in the tooltip', () => {
      build();

      expect(toggle().getAttribute('title')).toContain('Shift');
    });

    it('should omit the shortcut from the tooltip when disabled', () => {
      build({ shortcut: false });

      expect(toggle().getAttribute('title')).toBe('Open Unleash Toolbar — drag to move');
    });
  });

  describe('escape to minimize', () => {
    it('should minimize when Escape is pressed inside the panel', () => {
      build({ initiallyVisible: true });
      expect(isOpen()).toBe(true);

      press(panel(), 'Escape');

      expect(isOpen()).toBe(false);
      expect(stateManager.getVisibility()).toBe(false);
    });

    it('should collapse to the floating icon, not hide entirely', () => {
      build({ initiallyVisible: true });

      press(panel(), 'Escape');

      expect(toggle().style.display).toBe('flex');
    });

    it('should return focus to the floating icon', () => {
      build({ initiallyVisible: true });
      // Escape only reaches the handler when focus is inside the toolbar, and
      // focus is only handed back when the toolbar was holding it
      panel().focus();

      press(panel(), 'Escape');

      expect(document.activeElement).toBe(toggle());
    });

    it('should return focus to the summoning element rather than the icon', () => {
      build();
      const input = pageInput();
      summonFrom(input);

      press(panel(), 'Escape');

      // The icon is only the right target when the icon was what opened it
      expect(document.activeElement).toBe(input);
    });

    it('should return focus to wherever the user re-entered from', () => {
      build();
      const first = pageInput();
      const second = pageInput();
      summonFrom(first);
      // Tabs back out to the page, moves on, then summons the panel again
      second.focus();
      pressShortcut();

      press(panel(), 'Escape');

      expect(document.activeElement).toBe(second);
    });

    it('should fall back to the icon when the summoning element refuses focus', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      input.disabled = true;

      press(panel(), 'Escape');

      // Better the toolbar's own trigger than focus stranded on <body>
      expect(document.activeElement).toBe(toggle());
    });

    it('should ignore Escape pressed outside the toolbar', () => {
      build({ initiallyVisible: true });

      press(document.body, 'Escape');

      expect(isOpen()).toBe(true);
    });

    it('should do nothing when the panel is already collapsed', () => {
      build();
      const event = press(toggle(), 'Escape');

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('hide() focus ownership', () => {
    it('should not steal focus from the page when the app calls hide()', () => {
      build({ initiallyVisible: true });
      const input = pageInput();
      input.focus();

      // An open panel is not the same as an open panel that holds focus
      toolbar?.hide();

      expect(document.activeElement).toBe(input);
    });

    it('should not steal focus when hiding an already-collapsed toolbar', () => {
      build();
      const input = pageInput();
      input.focus();

      toolbar?.hide();

      expect(document.activeElement).toBe(input);
    });

    it('should hand focus back when the toolbar was holding it', () => {
      build({ initiallyVisible: true });
      const input = pageInput();
      input.focus();
      // User tabs into the panel, then the app hides it
      panel().focus();

      toolbar?.hide();

      expect(document.activeElement).toBe(toggle());
    });

    it('should return focus to the page when the icon is not rendered', () => {
      build({ showToggleButton: false, initiallyVisible: true });
      const input = pageInput();
      input.focus();
      toolbar?.show(); // records where focus was, then takes it

      toolbar?.hide();

      expect(document.activeElement).toBe(input);
    });
  });

  describe('focus tether', () => {
    it('should list only visible controls as tabbable', () => {
      build();
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;

      // Collapsed: the panel is display:none, so only the floating icon counts
      expect(getTabbableElements(root)).toEqual([toggle()]);
    });

    it('should exclude controls on the inactive tab', () => {
      build({ initiallyVisible: true });
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;

      const tabbable = getTabbableElements(root);
      const contextField = container.querySelector(
        '.ut-context-form .ut-input',
      ) as HTMLElement | null;

      expect(contextField).toBeTruthy();
      expect(tabbable).not.toContain(contextField);
    });

    it('should exclude elements with a negative tabindex', () => {
      build({ initiallyVisible: true });
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;

      // The panel itself is focusable programmatically but never by Tab
      expect(getTabbableElements(root)).not.toContain(panel());
    });

    it('should hand Tab off the last control back to the summoning element', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);
      const last = tabbable[tabbable.length - 1];

      last.focus();
      const event = press(last, 'Tab');

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
    });

    it('should hand Shift+Tab off the first control back to the summoning element', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const first = getTabbableElements(root)[0];

      first.focus();
      const event = press(first, 'Tab', { shiftKey: true });

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
    });

    it('should hand Shift+Tab off the panel container back to the summoning element', () => {
      build();
      const input = pageInput();
      summonFrom(input);

      // Where focusOnOpen: 'panel' leaves you, so it is the first Shift+Tab a
      // keyboard user presses. Forward from here the browser enters the panel.
      expect(document.activeElement).toBe(panel());
      const event = press(panel(), 'Tab', { shiftKey: true });

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
    });

    it('should let Tab enter the panel from its container', () => {
      build();
      summonFrom(pageInput());

      const event = press(panel(), 'Tab');

      expect(event.defaultPrevented).toBe(false);
    });

    it('should leave the panel open when Tab leaves it', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);

      press(tabbable[tabbable.length - 1], 'Tab');

      // The whole point of not trapping: keep watching the page with the panel up
      expect(isOpen()).toBe(true);
    });

    it('should let Tab move normally between interior controls', () => {
      build();
      summonFrom(pageInput());
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);

      tabbable[0].focus();
      const event = press(tabbable[0], 'Tab');

      // Not prevented: the browser's own sequencing handles the middle of the list
      expect(event.defaultPrevented).toBe(false);
    });

    it('should leave Tab alone when there is no summoning element to return to', () => {
      // Opened by clicking the floating icon, so the origin is the toolbar itself
      build({ initiallyVisible: true });
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);
      const last = tabbable[tabbable.length - 1];

      last.focus();
      const event = press(last, 'Tab');

      expect(event.defaultPrevented).toBe(false);
    });

    it('should leave Tab alone when the summoning element refuses focus', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      // Still in the document, but no longer able to take focus. Claiming the
      // keypress here would leave Tab doing nothing at all — a hard trap.
      input.disabled = true;
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);
      const last = tabbable[tabbable.length - 1];

      last.focus();
      const event = press(last, 'Tab');

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(last);
    });

    it('should leave Tab alone once the summoning element has been unmounted', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      input.remove();
      const root = container.querySelector('.unleash-toolbar-container') as HTMLElement;
      const tabbable = getTabbableElements(root);
      const last = tabbable[tabbable.length - 1];

      last.focus();
      const event = press(last, 'Tab');

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('keyboard shortcut', () => {
    it('should open the panel', () => {
      build();
      expect(isOpen()).toBe(false);

      pressShortcut();

      expect(isOpen()).toBe(true);
    });

    it('should close the panel when it is already open and holds focus', () => {
      build({ initiallyVisible: true });
      panel().focus();

      pressShortcut();

      expect(isOpen()).toBe(false);
    });

    it('should pull focus back into an open panel instead of closing it', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      // User has tabbed back out to the page, panel still up
      input.focus();

      pressShortcut();

      // Closing here would throw away a panel the user is still reading, and
      // with the tether in place the shortcut is the only way back in
      expect(isOpen()).toBe(true);
      expect(panel().contains(document.activeElement)).toBe(true);
    });

    it('should prevent the default browser action when it fires', () => {
      build();

      expect(pressShortcut().defaultPrevented).toBe(true);
    });

    it('should ignore auto-repeat while the chord is held', () => {
      build();

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        shiftKey: true,
        repeat: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(isOpen()).toBe(false);
    });

    it('should honour a custom chord', () => {
      build({ shortcut: 'ctrl+alt+u' });

      pressShortcut();
      expect(isOpen()).toBe(false);

      press(document, 'u', { ctrlKey: true, altKey: true });
      expect(isOpen()).toBe(true);
    });

    it('should register no listener when set to false', () => {
      build({ shortcut: false });

      const event = pressShortcut();

      expect(isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });

    it('should hand focus back when hidden until refresh, with no icon to land on', () => {
      build();
      const input = pageInput();
      summonFrom(input);
      const hideButton = container.querySelectorAll('.ut-btn-close')[1] as HTMLElement;

      hideButton.focus();
      hideButton.click();

      // Nothing of the toolbar is left to hold focus, so without the hand-off
      // it would sit on <body> and the next Tab would restart from the top
      expect(document.activeElement).toBe(input);
    });

    it('should reopen a toolbar that was hidden until refresh', () => {
      build({ initiallyVisible: true });
      const hideButton = container.querySelectorAll('.ut-btn-close')[1] as HTMLElement;

      hideButton.click();
      expect(toggle().style.display).toBe('none');

      pressShortcut();

      expect(isOpen()).toBe(true);
    });

    it('should stop responding after destroy', () => {
      const instance = build();
      instance.destroy();
      toolbar = null;

      const event = pressShortcut();

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('focus on open', () => {
    it('should focus the panel by default', () => {
      build();

      toolbar?.show();

      expect(document.activeElement).toBe(panel());
    });

    it('should focus the search input when asked', () => {
      stateManager.recordEvaluation('my-flag', 'flag', true, true, {});
      build();

      toolbar?.show({ focus: 'search' });

      expect(document.activeElement).toBe(container.querySelector('.ut-search-input'));
    });

    it('should fall back to the panel when the requested target is not rendered', () => {
      // With no flags evaluated the flags tab shows an empty state and renders
      // no search box, so there is nothing to focus.
      build();

      toolbar?.show({ focus: 'search' });

      expect(container.querySelector('.ut-search-input')).toBeNull();
      expect(document.activeElement).toBe(panel());
    });

    it('should focus the first editable context field and switch tabs', () => {
      build();

      toolbar?.show({ focus: 'context' });

      const contextField = container.querySelector(
        '.ut-context-form .ut-input:not([readonly])',
      ) as HTMLElement;
      expect(document.activeElement).toBe(contextField);
      expect(container.querySelector('.ut-tab.active')?.textContent?.trim()).toBe('Context');
    });

    it('should apply focusOnOpen to the shortcut', () => {
      stateManager.recordEvaluation('my-flag', 'flag', true, true, {});
      build({ focusOnOpen: 'search' });

      pressShortcut();

      expect(document.activeElement).toBe(container.querySelector('.ut-search-input'));
    });

    it('should let an explicit target override focusOnOpen', () => {
      build({ focusOnOpen: 'search' });

      toolbar?.show({ focus: 'panel' });

      expect(document.activeElement).toBe(panel());
    });

    it('should restore focus to the page when the icon is not rendered', () => {
      const pageButton = document.createElement('button');
      document.body.appendChild(pageButton);
      pageButton.focus();

      build({ showToggleButton: false });
      toolbar?.show();
      expect(document.activeElement).toBe(panel());

      press(panel(), 'Escape');

      expect(document.activeElement).toBe(pageButton);
    });
  });

  describe('toggle()', () => {
    it('should open when collapsed and close when open', () => {
      build();

      toolbar?.toggle();
      expect(isOpen()).toBe(true);

      toolbar?.toggle();
      expect(isOpen()).toBe(false);
    });

    it('should pass the focus target through when opening', () => {
      stateManager.recordEvaluation('my-flag', 'flag', true, true, {});
      build();

      toolbar?.toggle({ focus: 'search' });

      expect(document.activeElement).toBe(container.querySelector('.ut-search-input'));
    });
  });

  describe('outside click', () => {
    it('should not minimize by default', () => {
      build({ initiallyVisible: true });

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(isOpen()).toBe(true);
    });

    it('should minimize when closeOnOutsideClick is enabled', () => {
      build({ initiallyVisible: true, closeOnOutsideClick: true });

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(isOpen()).toBe(false);
    });

    it('should ignore presses inside the panel', () => {
      build({ initiallyVisible: true, closeOnOutsideClick: true });

      panel().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(isOpen()).toBe(true);
    });
  });

  describe('showToggleButton', () => {
    it('should render nothing when collapsed and the icon is disabled', () => {
      build({ showToggleButton: false });

      expect(toggle().style.display).toBe('none');
      expect(panel().style.display).toBe('none');
    });

    it('should still open via the shortcut', () => {
      build({ showToggleButton: false });

      pressShortcut();

      expect(isOpen()).toBe(true);
    });

    it('should collapse the two header buttons into one', () => {
      build({ showToggleButton: false, initiallyVisible: true });

      const closeButtons = container.querySelectorAll('.ut-btn-close');
      expect(closeButtons).toHaveLength(1);
      expect(closeButtons[0].getAttribute('aria-label')).toContain('reopen');
    });

    it('should keep both header buttons when the icon is enabled', () => {
      build({ initiallyVisible: true });

      expect(container.querySelectorAll('.ut-btn-close')).toHaveLength(2);
    });
  });

  describe('panel semantics', () => {
    it('should mark the panel as a named landmark region', () => {
      build({ initiallyVisible: true });

      // A region, not a dialog: nothing here is modal, and a landmark can be
      // reached from a screen reader's rotor without hunting through Tab order
      expect(panel().getAttribute('role')).toBe('region');

      const labelId = panel().getAttribute('aria-labelledby');
      expect(container.querySelector(`#${labelId}`)?.textContent).toBe('Unleash Toolbar');
    });

    it('should not claim aria-modal, since the page stays interactive', () => {
      build({ initiallyVisible: true });

      expect(panel().hasAttribute('aria-modal')).toBe(false);
    });

    it('should scope ids per instance so two toolbars do not collide', () => {
      build({ initiallyVisible: true });
      const second = new ToolbarUI(stateManager, wrappedClient, {
        container,
        initiallyVisible: true,
      });

      const panels = container.querySelectorAll('.unleash-toolbar');
      expect(panels[0].getAttribute('aria-labelledby')).not.toBe(
        panels[1].getAttribute('aria-labelledby'),
      );

      second.destroy();
    });
  });

  describe('tabs', () => {
    it('should use tablist semantics', () => {
      build({ initiallyVisible: true });

      const tablist = container.querySelector('.ut-tabs') as HTMLElement;
      expect(tablist.getAttribute('role')).toBe('tablist');

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    });

    it('should point each tab at its panel', () => {
      build({ initiallyVisible: true });

      const tab = container.querySelector('[role="tab"]') as HTMLElement;
      const panelId = tab.getAttribute('aria-controls');
      const tabPanel = container.querySelector(`#${panelId}`);

      expect(tabPanel?.getAttribute('role')).toBe('tabpanel');
      expect(tabPanel?.getAttribute('aria-labelledby')).toBe(tab.id);
    });

    it('should keep only the selected tab in the tab order', () => {
      build({ initiallyVisible: true });

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs[0].getAttribute('tabindex')).toBe('0');
      expect(tabs[1].getAttribute('tabindex')).toBe('-1');
    });

    it('should move to the next tab with ArrowRight', () => {
      build({ initiallyVisible: true });
      const tablist = container.querySelector('.ut-tabs') as HTMLElement;

      press(tablist, 'ArrowRight');

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabs[1]);
    });

    it('should wrap around with ArrowLeft', () => {
      build({ initiallyVisible: true });
      const tablist = container.querySelector('.ut-tabs') as HTMLElement;

      press(tablist, 'ArrowLeft');

      expect(container.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe(
        'true',
      );
    });

    it('should jump to the ends with Home and End', () => {
      build({ initiallyVisible: true });
      const tablist = container.querySelector('.ut-tabs') as HTMLElement;

      press(tablist, 'End');
      expect(container.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe(
        'true',
      );

      press(tablist, 'Home');
      expect(container.querySelectorAll('[role="tab"]')[0].getAttribute('aria-selected')).toBe(
        'true',
      );
    });

    it('should ignore unrelated keys', () => {
      build({ initiallyVisible: true });
      const tablist = container.querySelector('.ut-tabs') as HTMLElement;

      const event = press(tablist, 'a');

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('override radio group', () => {
    const withFlag = (name = 'my-flag') => {
      stateManager.recordEvaluation(name, 'flag', true, true, {});
      build({ initiallyVisible: true });
      return name;
    };

    it('should use radiogroup semantics naming the flag', () => {
      withFlag();

      const group = container.querySelector('.ut-toggle-group') as HTMLElement;
      expect(group.getAttribute('role')).toBe('radiogroup');
      expect(group.getAttribute('aria-label')).toBe('Override for my-flag');
    });

    it('should mark the active option as checked', () => {
      withFlag();

      const radios = container.querySelectorAll('[role="radio"]');
      expect(radios).toHaveLength(3);
      // No override yet, so the middle "use the default" option is checked
      expect(radios[1].getAttribute('aria-checked')).toBe('true');
      expect(radios[0].getAttribute('aria-checked')).toBe('false');
      expect(radios[2].getAttribute('aria-checked')).toBe('false');
    });

    it('should name each option with its flag', () => {
      withFlag();

      const radios = container.querySelectorAll('[role="radio"]');
      expect(radios[0].getAttribute('aria-label')).toBe('Force my-flag off');
      expect(radios[2].getAttribute('aria-label')).toBe('Force my-flag on');
    });

    it('should cost one tab stop per flag, not three', () => {
      withFlag();

      const tabbableRadios = Array.from(container.querySelectorAll('[role="radio"]')).filter(
        (radio) => radio.getAttribute('tabindex') === '0',
      );
      expect(tabbableRadios).toHaveLength(1);
    });

    it('should move the selection with ArrowRight', () => {
      const name = withFlag();
      const group = container.querySelector('.ut-toggle-group') as HTMLElement;

      press(group, 'ArrowRight');

      expect(stateManager.getFlagMetadata(name)?.override).toEqual({ type: 'flag', value: true });
      expect(container.querySelectorAll('[role="radio"]')[2].getAttribute('aria-checked')).toBe(
        'true',
      );
    });

    it('should keep focus on the newly selected option', () => {
      withFlag();
      const group = container.querySelector('.ut-toggle-group') as HTMLElement;

      press(group, 'ArrowRight');

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Force my-flag on');
      expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
    });

    it('should wrap with ArrowLeft', () => {
      const name = withFlag();
      const group = container.querySelector('.ut-toggle-group') as HTMLElement;

      press(group, 'ArrowLeft');

      expect(stateManager.getFlagMetadata(name)?.override).toEqual({ type: 'flag', value: false });
    });

    it('should still keep the .active class used for styling', () => {
      withFlag();
      const group = container.querySelector('.ut-toggle-group') as HTMLElement;

      press(group, 'ArrowRight');

      const active = container.querySelector('.ut-toggle-btn.active') as HTMLElement;
      expect(active.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('variant override focus', () => {
    const withVariantFlag = (name = 'payment-provider') => {
      stateManager.recordEvaluation(
        name,
        'variant',
        { name: 'control', enabled: true },
        { name: 'control', enabled: true },
        {},
      );
      build({ initiallyVisible: true });
      return name;
    };

    const variantRow = () => container.querySelector('.ut-variant-control') as HTMLElement;
    const overrideButton = () => variantRow().querySelector('.ut-btn-small') as HTMLElement | null;
    const variantInput = () =>
      variantRow().querySelector('.ut-input-small') as HTMLInputElement | null;

    it('should move focus to the input when an override is added', () => {
      withVariantFlag();

      overrideButton()?.click();

      expect(variantInput()).toBeTruthy();
      expect(document.activeElement).toBe(variantInput());
    });

    it('should select the prefilled value so it can be typed over', () => {
      withVariantFlag();

      overrideButton()?.click();

      const input = variantInput() as HTMLInputElement;
      expect(input.value).toBe('default');
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe('default'.length);
    });

    it('should return focus to the override button when cleared', () => {
      const name = withVariantFlag();
      overrideButton()?.click();

      const clearButton = Array.from(container.querySelectorAll('.ut-btn-small')).find((b) =>
        b.textContent?.includes('Clear Override'),
      ) as HTMLElement;
      clearButton.click();

      expect(stateManager.getFlagMetadata(name)?.override).toBeNull();
      expect(variantInput()).toBeNull();
      expect(document.activeElement).toBe(overrideButton());
    });

    it('should not strand focus on the body across the round trip', () => {
      withVariantFlag();

      overrideButton()?.click();
      expect(document.activeElement).not.toBe(document.body);

      (
        Array.from(container.querySelectorAll('.ut-btn-small')).find((b) =>
          b.textContent?.includes('Clear Override'),
        ) as HTMLElement
      ).click();
      expect(document.activeElement).not.toBe(document.body);
    });

    it('should target the row the click came from, not the first match', () => {
      stateManager.recordEvaluation('first-variant', 'variant', null, null, {});
      stateManager.recordEvaluation('second-variant', 'variant', null, null, {});
      build({ initiallyVisible: true });

      const rows = Array.from(container.querySelectorAll<HTMLElement>('.ut-variant-control'));
      expect(rows).toHaveLength(2);
      rows[1].querySelector<HTMLElement>('.ut-btn-small')?.click();

      // Named via the aria-label the screen reader gets, not a test-only hook
      expect(document.activeElement).toBe(rows[1].querySelector('.ut-input-small'));
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Variant name to override second-variant with',
      );
      expect(rows[0].querySelector('.ut-input-small')).toBeNull();
    });
  });

  describe('focus ring theming', () => {
    const root = () => container.querySelector('.unleash-toolbar-container') as HTMLElement;

    it('should inherit the light preset ring by default', () => {
      build();

      // No inline override: the ring comes from the stylesheet's light preset
      expect(root().style.getPropertyValue('--ut-focus')).toBe('');
      expect(root().classList.contains('ut-theme-dark')).toBe(false);
    });

    it('should switch to the dark preset ring via the theme class', () => {
      build({ themePreset: 'dark' });

      expect(root().classList.contains('ut-theme-dark')).toBe(true);
      expect(root().style.getPropertyValue('--ut-focus')).toBe('');
    });

    it('should let a custom theme override the ring colour', () => {
      build({ theme: { focusColor: '#ff9900' } });

      expect(root().style.getPropertyValue('--ut-focus')).toBe('#ff9900');
    });

    it('should override the ring on top of the dark preset too', () => {
      build({ themePreset: 'dark', theme: { focusColor: '#00ffcc' } });

      expect(root().classList.contains('ut-theme-dark')).toBe(true);
      expect(root().style.getPropertyValue('--ut-focus')).toBe('#00ffcc');
    });

    it('should not touch the ring when other theme colours are customized', () => {
      build({ theme: { primaryColor: '#ff0000', backgroundColor: '#000000' } });

      expect(root().style.getPropertyValue('--ut-primary')).toBe('#ff0000');
      expect(root().style.getPropertyValue('--ut-focus')).toBe('');
    });
  });

  describe('form labels', () => {
    it('should give the search input a real label', () => {
      stateManager.recordEvaluation('my-flag', 'flag', true, true, {});
      build({ initiallyVisible: true });

      const input = container.querySelector('.ut-search-input') as HTMLInputElement;
      const label = container.querySelector(`label[for="${input.id}"]`);

      expect(input.id).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('Search flags');
    });

    it('should associate each context field with its label', () => {
      build({ initiallyVisible: true });

      const input = container.querySelector('.ut-context-form .ut-input') as HTMLInputElement;
      const label = container.querySelector(`label[for="${input.id}"]`);

      expect(label?.textContent?.trim()).toBe('User ID');
    });

    it('should give reset buttons text instead of only a glyph', () => {
      build({ initiallyVisible: true });
      stateManager.setContextOverride({ userId: 'someone-else' });

      const reset = container.querySelector('.ut-reset-field') as HTMLElement;
      expect(reset.querySelector('.ut-sr-only')?.textContent).toBe(
        'Reset User ID to original value',
      );
      expect(reset.querySelector('[aria-hidden="true"]')?.textContent).toBe('↻');
    });
  });
});
