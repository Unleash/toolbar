import { html, render } from 'lit-html';
import { DragController } from './drag-controller';
import { KeyboardController, rovingIndexForKey } from './keyboard-controller';
import { DEFAULT_SHORTCUT } from './shortcut';
import type { ToolbarStateManager } from './state';
import type {
  FlagValue,
  InitToolbarOptions,
  IToolbarUI,
  ShowToolbarOptions,
  ToolbarFocusTarget,
  ToolbarState,
  UnleashContext,
  WrappedUnleashClient,
} from './types';

// Re-exported so existing importers (and tests) can keep using it from here
export { computeDragPosition } from './drag-controller';

// Unleash logo from CDN
const UNLEASH_LOGO = 'https://cdn.getunleash.io/docs-assets/unleash_logo_icon.svg';

// The three states of a boolean flag's override control, in the order they are
// rendered — also the order the arrow keys walk through.
const OVERRIDE_VALUES = ['off', 'default', 'on'] as const;
type OverrideValue = (typeof OVERRIDE_VALUES)[number];

// How long typing has to pause before the search result count is announced.
// Long enough to swallow a burst of keystrokes, short enough not to feel lost.
const SEARCH_ANNOUNCE_DELAY_MS = 400;

// Distinguishes the DOM ids of multiple toolbars on the same page
let instanceCounter = 0;

/**
 * Create the toolbar UI component using Lit
 */
export class ToolbarUI implements IToolbarUI {
  private container: HTMLElement;
  private rootElement: HTMLElement;
  private stateManager: ToolbarStateManager;
  private currentTab: 'flags' | 'context' = 'flags';
  private position: string;
  private themePreset: 'light' | 'dark';
  private customTheme?: InitToolbarOptions['theme'];
  private originalBaseContext: Partial<UnleashContext>;
  private searchQuery: string = '';
  // Spoken result summary, kept out of the visible UI. Trails searchQuery by
  // SEARCH_ANNOUNCE_DELAY_MS so it lands once, after typing settles.
  private searchAnnouncement: string = '';
  private announceTimer?: ReturnType<typeof setTimeout>;
  private draggable: boolean;
  private showToggleButton: boolean;
  private focusOnOpen: ToolbarFocusTarget;

  // Unique per instance, so ids referenced by aria-controls/labelledby stay
  // unambiguous if a page mounts more than one toolbar
  private uid = `ut-${++instanceCounter}`;

  // Owns toolbar placement + the drag-to-move interaction
  private drag: DragController;

  // Owns the shortcut, Escape, the focus tether and outside clicks
  private keyboard: KeyboardController;

  // Ephemeral "fully hidden" state (NOT persisted): the toolbar reappears on
  // the next page load. Set via the header's close (×) button.
  private hiddenCompletely = false;

  // Custom banner
  private banner?: string;
  private bannerLink?: string;
  private bannerLinkText?: string;

  constructor(
    stateManager: ToolbarStateManager,
    wrappedClient: WrappedUnleashClient,
    options: InitToolbarOptions = {},
  ) {
    this.stateManager = stateManager;
    this.position = options.position || 'bottom-right';
    this.themePreset = options.themePreset || 'light';
    this.customTheme = options.theme;
    this.draggable = options.draggable ?? true;
    this.showToggleButton = options.showToggleButton ?? true;
    this.focusOnOpen = options.focusOnOpen ?? 'panel';
    this.banner = options.banner;
    this.bannerLink = options.bannerLink;
    this.bannerLinkText = options.bannerLinkText;

    // Capture original base context before any overrides are applied
    this.originalBaseContext = wrappedClient.__original.getContext();

    // Initialize visibility from persisted state, or use initiallyVisible option
    const persistedVisibility = this.stateManager.getVisibility();
    const isVisible =
      persistedVisibility !== undefined ? persistedVisibility : (options.initiallyVisible ?? false);

    // Persist the initial visibility if not already set
    if (persistedVisibility === undefined) {
      this.stateManager.setVisibility(isVisible);
    }

    // Create single root container. The position (preset class or dragged
    // coordinates) is managed by applyPosition(), called from render().
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'unleash-toolbar-container';
    if (this.themePreset === 'dark') {
      this.rootElement.classList.add('ut-theme-dark');
    }
    this.applyCustomTheme(this.rootElement);

    // Attach to container or body
    this.container = options.container || document.body;
    this.container.appendChild(this.rootElement);

    // Placement + drag-to-move are delegated to the DragController. It calls
    // back to open the panel (a plain click) and to request a re-render.
    this.drag = new DragController(
      this.rootElement,
      this.stateManager,
      { draggable: this.draggable, position: this.position },
      { onOpen: () => this.show(), requestRender: () => this.render() },
    );

    // All keyboard interaction (shortcut, Escape, the focus tether) plus the
    // optional outside-click close live in their own controller.
    this.keyboard = new KeyboardController(
      this.rootElement,
      {
        shortcut: options.shortcut ?? DEFAULT_SHORTCUT,
        closeOnOutsideClick: options.closeOnOutsideClick ?? false,
      },
      {
        onToggle: () => this.toggle(),
        onMinimize: () => this.minimize(),
        isOpen: () => this.isPanelOpen(),
      },
    );

    // Subscribe to state changes
    this.stateManager.subscribe(() => {
      this.render();
    });

    // Initial render
    this.render();
  }

  private applyCustomTheme(element: HTMLElement): void {
    if (!this.customTheme) return;

    const style = element.style;
    if (this.customTheme.primaryColor)
      style.setProperty('--ut-primary', this.customTheme.primaryColor);
    if (this.customTheme.backgroundColor)
      style.setProperty('--ut-bg', this.customTheme.backgroundColor);
    if (this.customTheme.textColor) style.setProperty('--ut-text', this.customTheme.textColor);
    if (this.customTheme.borderColor)
      style.setProperty('--ut-border', this.customTheme.borderColor);
    if (this.customTheme.fontFamily) style.setProperty('--ut-font', this.customTheme.fontFamily);
    // Left unset, the focus ring falls through to the themePreset's own value
    if (this.customTheme.focusColor) style.setProperty('--ut-focus', this.customTheme.focusColor);
  }

  /** Whether the expanded panel is currently on screen */
  private isPanelOpen(): boolean {
    return Boolean(this.stateManager.getVisibility()) && !this.hiddenCompletely;
  }

  show(options: ShowToolbarOptions = {}): void {
    const target = options.focus ?? this.focusOnOpen;

    // Focusing the panel takes focus away from the page, so record where it was
    // in case the floating icon isn't rendered to hand it back to.
    this.keyboard.rememberFocus();

    // 'context' and 'search' live on different tabs; switch before rendering so
    // the target is visible (and therefore focusable) by the time we focus it.
    if (target === 'context') this.currentTab = 'context';
    if (target === 'search') this.currentTab = 'flags';

    this.hiddenCompletely = false;
    this.stateManager.setVisibility(true);
    this.render();
    this.applyFocus(target);
  }

  hide(): void {
    // Whether the toolbar *holds* focus, not merely whether it was open: an app
    // calling hide() while the user is typing in the page must not pull focus
    // away. Captured before the render, because hiding the panel drops focus to
    // the body and the answer would then always be no.
    const heldFocus = this.containsFocus();

    this.stateManager.setVisibility(false);
    this.render();

    if (heldFocus) {
      this.keyboard.restoreFocus(this.showToggleButton ? this.queryToggleButton() : null);
    }
  }

  /** Whether focus currently sits on the toolbar or anything inside it */
  private containsFocus(): boolean {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    return active !== null && this.rootElement.contains(active);
  }

  /**
   * Three states, not two. Once Tab can carry focus out of an open panel, the
   * shortcut is also the only way back in, so pressing it from the page pulls
   * focus into the panel instead of closing a panel the user is still reading.
   * Only a press from inside the toolbar means "done with this".
   */
  toggle(options: ShowToolbarOptions = {}): void {
    if (!this.isPanelOpen()) {
      this.show(options);
      return;
    }

    if (!this.containsFocus()) {
      // Re-entering from somewhere new: Escape has to hand focus back to where
      // the user is *now*, not to where they were when they first opened it.
      this.keyboard.rememberFocus();
      this.applyFocus(options.focus ?? this.focusOnOpen);
      return;
    }

    this.minimize();
  }

  /**
   * Collapse the panel down to the floating toggle icon (persisted).
   * Triggered by the header's minimize (_) button and by Escape.
   */
  private minimize(): void {
    this.hide();
  }

  private queryToggleButton(): HTMLElement | null {
    return this.rootElement.querySelector<HTMLElement>('.ut-toggle');
  }

  private queryPanel(): HTMLElement | null {
    return this.rootElement.querySelector<HTMLElement>('.unleash-toolbar');
  }

  /** Move focus to the requested control, falling back to the panel container */
  private applyFocus(target: ToolbarFocusTarget): void {
    const panel = this.queryPanel();
    if (!panel) return;

    const selectors: Record<ToolbarFocusTarget, string | null> = {
      panel: null,
      search: '.ut-search-input',
      context: '.ut-context-form .ut-input:not([readonly])',
    };

    const selector = selectors[target];
    const element = selector ? panel.querySelector<HTMLElement>(selector) : null;
    (element ?? panel).focus();
  }

  /**
   * Hide the toolbar entirely — both panel and floating icon. The "everything
   * hidden" state is ephemeral and NOT persisted, so a page refresh brings the
   * toolbar back. We do persist visibility as collapsed, so on reload it
   * returns minimized (the floating icon) rather than fully open. Triggered by
   * the header's close (×) button.
   */
  private hideCompletely(): void {
    // Nothing of the toolbar survives this, so unlike hide() there is no icon to
    // fall back to — without the hand-off focus would drop to the body and the
    // next Tab would restart from the top of the document.
    const heldFocus = this.containsFocus();

    this.hiddenCompletely = true;
    this.stateManager.setVisibility(false);
    this.render();

    if (heldFocus) this.keyboard.restoreFocus(null);
  }

  destroy(): void {
    clearTimeout(this.announceTimer);
    this.drag.destroy();
    this.keyboard.destroy();
    this.rootElement.remove();
  }

  private render(): void {
    const state = this.stateManager.getState();
    const flagNames = this.stateManager.getFlagNames();
    const isVisible = this.stateManager.getVisibility();

    // Three states: fully hidden (nothing shown), collapsed (toggle icon), open (panel)
    const showToggle = !isVisible && !this.hiddenCompletely && this.showToggleButton;
    const showPanel = isVisible && !this.hiddenCompletely;

    // Single unified template for everything
    const template = html`
      <button
        class="ut-toggle${this.draggable ? ' ut-draggable' : ''}"
        style=${showToggle ? 'display: flex;' : 'display: none;'}
        @pointerdown=${(e: PointerEvent) => this.drag.onPointerDown(e)}
        @click=${() => this.drag.onToggleClick()}
        title=${this.toggleTitle()}
      >
        <!-- alt="" so the button's own text supplies the accessible name -->
        <img src="${UNLEASH_LOGO}" alt="" draggable="false" />
        <span class="ut-sr-only">Open Unleash Toolbar</span>
      </button>

      <!-- A labelled region rather than a dialog: nothing here is modal, and a
           landmark is reachable from a screen reader's rotor without depending
           on where the toolbar happens to sit in the tab order. -->
      <div
        class="unleash-toolbar"
        style=${showPanel ? 'display: flex;' : 'display: none;'}
        role="region"
        aria-labelledby="${this.uid}-title"
        tabindex="-1"
      >
        ${this.renderHeader(state)}
        ${this.renderBanner()}
        ${this.renderTabsNavigation()}
        <div class="ut-content">
          <div
            id="${this.uid}-panel-flags"
            role="tabpanel"
            aria-labelledby="${this.uid}-tab-flags"
            style=${this.currentTab === 'flags' ? '' : 'display: none;'}
          >
            ${this.renderFlagsTab(flagNames)}
          </div>
          <div
            id="${this.uid}-panel-context"
            role="tabpanel"
            aria-labelledby="${this.uid}-tab-context"
            style=${this.currentTab === 'context' ? '' : 'display: none;'}
          >
            ${this.renderContextTab(state.contextOverrides)}
          </div>
        </div>
      </div>
    `;

    render(template, this.rootElement);
    this.drag.apply();
  }

  /** Tooltip for the floating icon: what it does, plus how else to open it */
  private toggleTitle(): string {
    const shortcut = this.keyboard.shortcutLabel;
    const base = shortcut ? `Open Unleash Toolbar (${shortcut})` : 'Open Unleash Toolbar';
    return this.draggable ? `${base} — drag to move` : base;
  }

  private renderHeader(state: ToolbarState) {
    const flagCount = Object.keys(state.flags).length;
    const overrideCount = Object.values(state.flags).filter((f) => f.override !== null).length;
    const shortcut = this.keyboard.shortcutLabel;

    // Without the floating icon there is nothing to minimize *to*, so the two
    // header buttons would do the same thing — render only the close button.
    const closeHint = shortcut ? `Close (${shortcut} to reopen)` : 'Close toolbar';

    return html`
      <div class="ut-header">
        <div class="ut-title">
          <img src="${UNLEASH_LOGO}" alt="" />
          <div>
            <div class="ut-title-main" id="${this.uid}-title">Unleash Toolbar</div>
            <div class="ut-title-sub">${flagCount} flags • ${overrideCount} overrides</div>
          </div>
        </div>
        <div class="ut-header-actions">
          ${
            this.showToggleButton
              ? html`
          <button
            class="ut-btn-close ut-btn-minimize"
            @click=${() => this.minimize()}
            title="Minimize to floating icon (Esc)"
            aria-label="Minimize toolbar"
          ><span class="ut-minimize-glyph"></span></button>
          <button
            class="ut-btn-close"
            @click=${() => this.hideCompletely()}
            title="Hide until page refresh"
            aria-label="Hide toolbar"
          >×</button>
        `
              : html`
          <button
            class="ut-btn-close"
            @click=${() => this.minimize()}
            title=${closeHint}
            aria-label=${closeHint}
          >×</button>
        `
          }
        </div>
      </div>
    `;
  }

  private renderBanner() {
    if (!this.banner) return null;

    const linkText = this.bannerLinkText || 'Read more';

    return html`
      <div class="ut-banner" role="note">
        <span class="ut-banner-text">${this.banner}</span>
        ${
          this.bannerLink
            ? html`<a
                class="ut-banner-link"
                href=${this.bannerLink}
                target="_blank"
                rel="noopener noreferrer"
              >${linkText}</a>`
            : null
        }
      </div>
    `;
  }

  private renderTabsNavigation() {
    const tabs = [
      { id: 'flags', label: 'Feature Flags' },
      { id: 'context', label: 'Context' },
    ] as const;

    return html`
      <div
        class="ut-tabs"
        role="tablist"
        aria-label="Toolbar sections"
        @keydown=${(e: KeyboardEvent) => this.onTabsKeyDown(e)}
      >
        ${tabs.map((tab) => {
          const isActive = this.currentTab === tab.id;
          return html`
        <button
          class=${`ut-tab ${isActive ? 'active' : ''}`}
          id="${this.uid}-tab-${tab.id}"
          role="tab"
          aria-selected=${isActive ? 'true' : 'false'}
          aria-controls="${this.uid}-panel-${tab.id}"
          tabindex=${isActive ? 0 : -1}
          @click=${() => this.switchTab(tab.id)}
        >
          ${tab.label}
        </button>
      `;
        })}
      </div>
    `;
  }

  /**
   * Arrow-key navigation across the tablist, per the WAI-ARIA tabs pattern:
   * only the selected tab is in the tab order, and Left/Right (plus Home/End)
   * move between them with selection following focus.
   */
  private onTabsKeyDown(event: KeyboardEvent): void {
    const order = ['flags', 'context'] as const;
    const next = rovingIndexForKey(event.key, order.indexOf(this.currentTab), order.length, {
      homeEnd: true,
    });
    if (next === null) return;

    event.preventDefault();
    // Stop the Tab trap and any page-level arrow handling from also reacting
    event.stopPropagation();

    // The tablist is the listener's own element, so the newly selected tab is
    // just its nth matching child
    const tablist = event.currentTarget as HTMLElement;
    this.switchTab(order[next]);
    this.focusWithin(tablist, '[role="tab"]', next);
  }

  private switchTab(tab: 'flags' | 'context'): void {
    this.currentTab = tab;
    this.render();
  }

  private renderFlagsTab(flagNames: string[]) {
    if (flagNames.length === 0) {
      return html`
        <div class="ut-empty">
          No flags evaluated yet. Use feature flags in your app to see them here.
        </div>
      `;
    }

    const filteredFlags = this.filterFlags(flagNames);

    return html`
      <div class="ut-tab-header">
        <div class="ut-search-container">
          <label class="ut-sr-only" for="${this.uid}-search">Search flags</label>
          <input
            type="text"
            id="${this.uid}-search"
            class="ut-search-input"
            placeholder="Search flags..."
            .value=${this.searchQuery}
            @input=${(e: Event) => this.updateSearch((e.target as HTMLInputElement).value)}
          />
          <!-- Filtering rewrites the list silently. role="status" is implicitly
               polite and atomic, so the summary waits for a pause in speech and
               is read whole. -->
          <div class="ut-sr-only" role="status">${this.searchAnnouncement}</div>
        </div>
        <button class="ut-btn" @click=${() => this.stateManager.resetOverrides()}>
          Reset All Overrides
        </button>
      </div>
      <div class="ut-flag-list">
        ${
          filteredFlags.length > 0
            ? filteredFlags.map((name) => this.renderFlagItem(name))
            : html`<div class="ut-empty">No flags match "${this.searchQuery}"</div>`
        }
      </div>
    `;
  }

  private filterFlags(flagNames: string[]): string[] {
    if (!this.searchQuery) return flagNames;

    const query = this.searchQuery.toLowerCase();
    return flagNames.filter((name) => name.toLowerCase().includes(query));
  }

  private updateSearch(query: string): void {
    this.searchQuery = query;
    this.render();

    // The list itself updates on every keystroke; only the spoken summary waits,
    // or a screen reader would queue one announcement per character typed.
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => this.announceMatches(), SEARCH_ANNOUNCE_DELAY_MS);
  }

  private announceMatches(): void {
    const query = this.searchQuery;
    const count = this.filterFlags(this.stateManager.getFlagNames()).length;

    // Cleared search: the empty field says it, and an empty region stays silent
    if (!query) {
      this.searchAnnouncement = '';
    } else if (count === 0) {
      this.searchAnnouncement = `No flags match "${query}"`;
    } else {
      // The query is repeated back so that narrowing a search which happens to
      // keep the same count still reads as a change worth announcing
      this.searchAnnouncement = `${count} flag${count === 1 ? '' : 's'} match${count === 1 ? 'es' : ''} "${query}"`;
    }

    this.render();
  }

  private renderFlagItem(name: string) {
    const metadata = this.stateManager.getFlagMetadata(name);
    if (!metadata) return null;

    // Use the explicitly stored flag type
    const isVariant = metadata.flagType === 'variant';
    const hasOverride = metadata.override !== null;

    // Determine current state for toggle
    let toggleState: OverrideValue = 'default';
    if (hasOverride && metadata.override?.type === 'flag') {
      toggleState = metadata.override.value ? 'on' : 'off';
    }

    return html`
      <div class="ut-flag-item">
        <div class="ut-flag-main">
          <div class="ut-flag-header">
            <div class="ut-flag-title-row">
              <div class="ut-flag-name">${name}</div>
            </div>
            <div class="ut-flag-meta">
              <div class="ut-flag-default-value" title="Default value from Unleash">
                ${this.renderValueBadge(metadata.lastDefaultValue)}
              </div>
              ${
                hasOverride
                  ? html`
                <span class="ut-override-indicator" title="Override value (overriding the default)">
                  → ${this.renderValueBadge(metadata.lastEffectiveValue)}
                </span>
              `
                  : null
              }
            </div>
          </div>
        </div>
        
        <div class="ut-flag-control">
          ${
            !isVariant
              ? this.renderOverrideRadioGroup(name, toggleState)
              : html`
            <div class="ut-variant-control">
              ${
                hasOverride && metadata.override?.type === 'variant'
                  ? html`
                <input
                  type="text"
                  class="ut-input-small"
                  placeholder="Variant name"
                  .value=${metadata.override.variantKey}
                  @input=${(e: Event) => this.setVariant(name, (e.target as HTMLInputElement).value)}
                  title="Enter variant name to override with"
                  aria-label="Variant name to override ${name} with"
                />
                <button
                  class="ut-btn-small active"
                  @click=${(e: Event) => this.toggleVariantOverride(name, e)}
                  title="Clear variant override"
                  aria-label="Clear variant override for ${name}"
                >Clear Override</button>
              `
                  : html`
                <button
                  class="ut-btn-small"
                  @click=${(e: Event) => this.toggleVariantOverride(name, e)}
                  title="Set a variant override"
                  aria-label="Override variant for ${name}"
                >Override Variant</button>
              `
              }
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  /**
   * The OFF / — / ON control for a boolean flag, as a WAI-ARIA radio group.
   *
   * Radio semantics (rather than three plain buttons) are what tell a screen
   * reader which of the three is currently in effect. The roving tabindex is
   * also a plain keyboard win: each flag row costs one Tab stop instead of
   * three, so a list of 50 flags takes 50 stops to walk rather than 150.
   */
  private renderOverrideRadioGroup(name: string, toggleState: OverrideValue) {
    const labels: Record<OverrideValue, { text: string; description: string }> = {
      off: { text: 'OFF', description: `Force ${name} off` },
      default: { text: '—', description: `Use the default value from Unleash for ${name}` },
      on: { text: 'ON', description: `Force ${name} on` },
    };

    return html`
      <div
        class="ut-toggle-group"
        role="radiogroup"
        aria-label="Override for ${name}"
        @keydown=${(e: KeyboardEvent) => this.onOverrideKeyDown(e, name, toggleState)}
      >
        ${OVERRIDE_VALUES.map((value) => {
          const isActive = toggleState === value;
          return html`
        <button
          class=${`ut-toggle-btn ${isActive ? 'active' : ''}`}
          role="radio"
          aria-checked=${isActive ? 'true' : 'false'}
          aria-label=${labels[value].description}
          tabindex=${isActive ? 0 : -1}
          @click=${() => this.setFlagOverride(name, value)}
          title=${labels[value].description}
        >${labels[value].text}</button>
      `;
        })}
      </div>
    `;
  }

  /**
   * Arrow-key navigation within a flag's override radio group. Selection follows
   * focus, which is the expected behaviour for radios.
   */
  private onOverrideKeyDown(event: KeyboardEvent, name: string, current: OverrideValue): void {
    // No homeEnd: a radio group is not expected to respond to Home/End
    const next = rovingIndexForKey(
      event.key,
      OVERRIDE_VALUES.indexOf(current),
      OVERRIDE_VALUES.length,
    );
    if (next === null) return;

    event.preventDefault();
    event.stopPropagation();

    // The group is the listener's own element, so the newly selected radio is
    // just its nth matching child — no need to match the flag by name.
    const group = event.currentTarget as HTMLElement;
    this.setFlagOverride(name, OVERRIDE_VALUES[next]);
    // The roving tabindex has moved, so focus must follow it explicitly
    this.focusWithin(group, '[role="radio"]', next);
  }

  private renderValueBadge(value: FlagValue) {
    if (typeof value === 'boolean') {
      return html`<span class=${`ut-badge ut-badge-${value ? 'success' : 'danger'}`}>${value ? 'ON' : 'OFF'}</span>`;
    }
    if (value && typeof value === 'object' && 'name' in value) {
      return html`<span class="ut-badge ut-badge-default">${value.name}</span>`;
    }
    return html`<span class="ut-badge ut-badge-default">null</span>`;
  }

  private setFlagOverride(flagName: string, value: 'on' | 'off' | 'default'): void {
    if (value === 'default') {
      this.stateManager.setFlagOverride(flagName, null);
    } else if (value === 'on') {
      this.stateManager.setFlagOverride(flagName, { type: 'flag', value: true });
    } else if (value === 'off') {
      this.stateManager.setFlagOverride(flagName, { type: 'flag', value: false });
    }
  }

  private toggleVariantOverride(flagName: string, event: Event): void {
    const metadata = this.stateManager.getFlagMetadata(flagName);
    // Resolve the row *before* touching state: the re-render detaches the
    // clicked button, and closest() on a detached node would find nothing.
    const control = (event.currentTarget as HTMLElement).closest('.ut-variant-control');

    if (metadata?.override) {
      // Clearing replaces the clicked button with the "Override Variant" one, so
      // focus has to follow it across the swap or it lands on the document body.
      this.stateManager.setFlagOverride(flagName, null);
      this.focusWithin(control, '.ut-btn-small');
    } else {
      this.stateManager.setFlagOverride(flagName, { type: 'variant', variantKey: 'default' });
      // Select the prefilled "default" so the variant name can be typed over it
      const input = this.focusWithin(control, '.ut-input-small') as HTMLInputElement | null;
      input?.select();
    }
  }

  /**
   * Focus the `index`th control matching `selector` inside `container`, after a
   * re-render swapped it in.
   *
   * Scoping by the container the interaction started from means the flag never
   * has to be matched by name — which also sidesteps having to escape flag names
   * that contain selector syntax.
   *
   * Indexes among *matching* elements rather than using `:nth-of-type()`, which
   * counts same-tag siblings and would silently pick the wrong control if a
   * container ever gained a button that is not part of the group.
   */
  private focusWithin(container: Element | null, selector: string, index = 0): HTMLElement | null {
    const element = container?.querySelectorAll<HTMLElement>(selector)[index] ?? null;
    element?.focus();
    return element;
  }

  private setVariant(flagName: string, variantKey: string): void {
    this.stateManager.setFlagOverride(flagName, { type: 'variant', variantKey });
  }

  private isFieldOverridden(
    fieldName: string,
    baseContext: Partial<UnleashContext>,
    contextOverrides: Partial<UnleashContext>,
  ): boolean {
    if (fieldName === 'properties') {
      return false; // Handle properties separately
    }
    const baseValue = baseContext[fieldName as keyof UnleashContext];
    const overrideValue = contextOverrides[fieldName as keyof UnleashContext];

    // Only consider it overridden if there's an override AND it differs from base
    return overrideValue !== undefined && overrideValue !== baseValue;
  }

  private renderContextField(
    label: string,
    fieldName: string,
    placeholder: string,
    value: string,
    isOverridden: boolean,
    readonly = false,
  ) {
    return html`
      <div class="ut-form-group">
        <label class="ut-label" for="${this.uid}-field-${fieldName}">
          ${label}${readonly ? html` <span class="ut-readonly-label">(read-only)</span>` : null}
        </label>
        <div class="ut-input-with-reset">
          <input 
            type="text" 
            class=${readonly ? 'ut-input ut-input-readonly' : 'ut-input'}
            placeholder=${placeholder}
            .value=${value}
            @input=${readonly ? null : (e: Event) => this.updateContextField(fieldName, (e.target as HTMLInputElement).value)}
            ?readonly=${readonly}
            title=${readonly ? 'This context field is static and cannot be modified.' : ''}
            id="${this.uid}-field-${fieldName}"
          />
          ${
            isOverridden && !readonly
              ? html`
            <button
              class="ut-reset-field"
              @click=${() => this.resetContextField(fieldName)}
              title="Reset to original value"
            ><span aria-hidden="true">↻</span><span class="ut-sr-only">Reset ${label} to original value</span></button>
          `
              : null
          }
        </div>
      </div>
    `;
  }

  private updateContextField(field: string, value: string): void {
    this.stateManager.setContextOverride({ [field]: value || undefined });
  }

  private resetContextField(field: string): void {
    this.stateManager.removeContextOverride(field as keyof UnleashContext);
  }

  private renderContextTab(contextOverrides: Partial<UnleashContext>) {
    // Use original base context (not current client context which includes overrides)
    const baseContext = this.originalBaseContext;
    const mergedContext = { ...baseContext, ...contextOverrides };

    // Standard context fields that should not appear in custom properties
    const standardFields = [
      'userId',
      'sessionId',
      'remoteAddress',
      'environment',
      'appName',
      'properties',
    ];

    // Merge properties and exclude any that are standard fields
    const baseProperties = baseContext.properties || {};
    const overrideProperties = contextOverrides.properties || {};
    const mergedProperties = { ...baseProperties, ...overrideProperties };

    // Filter out standard fields and show only non-empty properties
    const customPropertiesArray = Object.entries(mergedProperties).filter(([key, value]) => {
      if (standardFields.includes(key)) return false;
      // Only show properties that have a non-empty value
      return value !== '';
    });

    const customProperties = Object.fromEntries(customPropertiesArray);

    return html`
      <div class="ut-tab-header">
        <button class="ut-btn" @click=${() => this.stateManager.resetContextOverrides()}>
          Reset All Context
        </button>
      </div>
      <div class="ut-context-form">
        ${this.renderContextField('User ID', 'userId', 'user-123', mergedContext.userId || '', this.isFieldOverridden('userId', baseContext, contextOverrides))}
        ${this.renderContextField('Session ID', 'sessionId', 'session-456', mergedContext.sessionId || '', this.isFieldOverridden('sessionId', baseContext, contextOverrides))}
        ${this.renderContextField('Remote Address', 'remoteAddress', '192.168.1.1', mergedContext.remoteAddress || '', this.isFieldOverridden('remoteAddress', baseContext, contextOverrides))}
        ${this.renderContextField('Environment', 'environment', 'development', mergedContext.environment || '', false, true)}
        ${this.renderContextField('App Name', 'appName', 'my-app', mergedContext.appName || '', false, true)}

        <div class="ut-form-group">
          <div class="ut-label">Custom Properties</div>
          <div class="ut-properties">
            ${this.renderProperties(customProperties || {}, baseProperties)}
          </div>
        </div>
      </div>
    `;
  }

  private renderProperties(
    properties: Record<string, string>,
    baseProperties: Record<string, string> = {},
  ) {
    const entries = Object.entries(properties);

    if (entries.length === 0) {
      return html`
        <div class="ut-empty-properties">
          No custom properties defined in base context
        </div>
      `;
    }

    return html`
      ${entries.map(([key, value]) => {
        const baseValue = baseProperties[key];
        const isOverridden = baseValue !== undefined && baseValue !== value;
        return html`
          <div class="ut-property-row">
            <div class="ut-property-key" title="Property key (read-only)">${key}</div>
            <div class="ut-input-with-reset">
              <input
                type="text"
                class="ut-input"
                placeholder="Value"
                .value=${value}
                @input=${(e: Event) => this.updatePropertyValue(key, (e.target as HTMLInputElement).value)}
                title=${isOverridden ? `Original: ${baseValue}` : ''}
                aria-label="Value of custom property ${key}"
              />
              ${
                isOverridden
                  ? html`
                <button
                  class="ut-reset-field"
                  @click=${() => this.resetProperty(key)}
                  title="Reset to original value"
                ><span aria-hidden="true">↻</span><span class="ut-sr-only">Reset ${key} to original value</span></button>
              `
                  : null
              }
            </div>
          </div>
        `;
      })}
    `;
  }

  private updatePropertyValue(key: string, value: string): void {
    const state = this.stateManager.getState();
    const properties = { ...(state.contextOverrides.properties || {}), [key]: value };
    this.stateManager.setContextOverride({ properties });
  }

  private resetProperty(key: string): void {
    const baseProperties = this.originalBaseContext.properties || {};
    const state = this.stateManager.getState();
    const properties = { ...(state.contextOverrides.properties || {}) };

    // Restore to base value
    if (baseProperties[key] !== undefined) {
      properties[key] = baseProperties[key];
    } else {
      delete properties[key];
    }

    this.stateManager.setContextOverride({ properties });
  }
}
