import { html, render } from 'lit-html';
import type { ToolbarStateManager } from './state';
import type {
  DragPosition,
  FlagValue,
  InitToolbarOptions,
  IToolbarUI,
  ToolbarState,
  UnleashContext,
  WrappedUnleashClient,
} from './types';

// Unleash logo from CDN
const UNLEASH_LOGO = 'https://cdn.getunleash.io/docs-assets/unleash_logo_icon.svg';

// Layout constants shared by drag/positioning logic
const EDGE_MARGIN = 20; // px gap kept between the toolbar and the window edge
const TOGGLE_SIZE = 48; // px width/height of the floating toggle icon
const PANEL_WIDTH = 400; // px width of the expanded panel (matches CSS)
const DRAG_THRESHOLD = 4; // px of movement before a pointer-drag begins

const POSITION_CLASSES = [
  'position-top-left',
  'position-top-right',
  'position-bottom-left',
  'position-bottom-right',
  'position-left',
  'position-right',
];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Determine which window edge a dragged toolbar should snap to, and where along
 * that edge it sits. Pure function so it can be unit-tested independently.
 *
 * @param left/top - top-left corner of the dragged element (viewport coords)
 * @param width/height - size of the dragged element
 * @param vw/vh - viewport dimensions
 */
export function computeDragPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  vw: number,
  vh: number,
): DragPosition {
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  const distLeft = centerX;
  const distRight = vw - centerX;
  const distTop = centerY;
  const distBottom = vh - centerY;
  const nearest = Math.min(distLeft, distRight, distTop, distBottom);

  // Offsets are stored as a fraction of the available travel along the edge so
  // the position stays proportional when the window is resized.
  const offsetX = vw > width ? clamp(left / (vw - width), 0, 1) : 0;
  const offsetY = vh > height ? clamp(top / (vh - height), 0, 1) : 0;

  if (nearest === distTop) return { edge: 'top', offset: offsetX };
  if (nearest === distBottom) return { edge: 'bottom', offset: offsetX };
  if (nearest === distLeft) return { edge: 'left', offset: offsetY };
  return { edge: 'right', offset: offsetY };
}

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
  private draggable: boolean;

  // Ephemeral "fully hidden" state (NOT persisted): the toolbar reappears on
  // the next page load. Set via the header's close (×) button.
  private hiddenCompletely = false;

  // Drag bookkeeping
  private isDragging = false;
  private dragMoved = false;
  private suppressClick = false;
  private dragGrabX = 0;
  private dragGrabY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private snapTimer?: ReturnType<typeof setTimeout>;

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

    // Subscribe to state changes
    this.stateManager.subscribe(() => {
      this.render();
    });

    // Keep a dragged position on-screen when the window is resized
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);
    }

    // Initial render
    this.render();
  }

  private handleResize = (): void => {
    if (!this.isDragging) this.applyPosition();
  };

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
  }

  show(): void {
    this.hiddenCompletely = false;
    this.stateManager.setVisibility(true);
    this.render();
  }

  hide(): void {
    this.stateManager.setVisibility(false);
    this.render();
  }

  /**
   * Collapse the panel down to the floating toggle icon (persisted).
   * Triggered by the header's minimize (_) button.
   */
  private minimize(): void {
    this.hide();
  }

  /**
   * Hide the toolbar entirely — both panel and floating icon. This state is
   * ephemeral and intentionally NOT persisted, so a page refresh brings the
   * toolbar back. Triggered by the header's close (×) button.
   */
  private hideCompletely(): void {
    this.hiddenCompletely = true;
    this.render();
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.snapTimer !== undefined) clearTimeout(this.snapTimer);
    this.removeDragListeners();
    this.rootElement.remove();
  }

  private render(): void {
    const state = this.stateManager.getState();
    const flagNames = this.stateManager.getFlagNames();
    const isVisible = this.stateManager.getVisibility();

    // Three states: fully hidden (nothing shown), collapsed (toggle icon), open (panel)
    const showToggle = !isVisible && !this.hiddenCompletely;
    const showPanel = isVisible && !this.hiddenCompletely;

    // Single unified template for everything
    const template = html`
      <button
        class="ut-toggle${this.draggable ? ' ut-draggable' : ''}"
        style=${showToggle ? 'display: flex;' : 'display: none;'}
        @pointerdown=${(e: PointerEvent) => this.onTogglePointerDown(e)}
        @click=${() => this.onToggleClick()}
        title=${this.draggable ? 'Open Unleash Toolbar (drag to move)' : 'Open Unleash Toolbar'}
      >
        <img src="${UNLEASH_LOGO}" alt="Unleash" draggable="false" />
      </button>

      <div
        class="unleash-toolbar"
        style=${showPanel ? 'display: flex;' : 'display: none;'}
      >
        ${this.renderHeader(state)}
        ${this.renderTabsNavigation()}
        <div class="ut-content">
          <div style=${this.currentTab === 'flags' ? '' : 'display: none;'}>
            ${this.renderFlagsTab(flagNames)}
          </div>
          <div style=${this.currentTab === 'context' ? '' : 'display: none;'}>
            ${this.renderContextTab(state.contextOverrides)}
          </div>
        </div>
      </div>
    `;

    render(template, this.rootElement);
    this.applyPosition();
  }

  /**
   * Apply the toolbar position to the root container. When the user has dragged
   * the toolbar, position via inline coordinates; otherwise fall back to the
   * preset position-* class from the `position` option.
   */
  private applyPosition(): void {
    const root = this.rootElement;
    // A persisted drag position only applies while dragging is enabled, so
    // toggling `draggable: false` reverts to the configured preset position.
    const drag = this.draggable ? this.stateManager.getDragPosition() : undefined;

    // Reset any inline coordinates before re-applying
    root.style.top = '';
    root.style.bottom = '';
    root.style.left = '';
    root.style.right = '';
    root.classList.remove(...POSITION_CLASSES);

    if (!drag) {
      root.classList.add(`position-${this.position}`);
      return;
    }

    // Always position via left/top (never right/bottom) so the snap-to-edge
    // animation moves through a single, continuous coordinate space.
    const { left, top } = this.stateManager.getVisibility()
      ? this.computePanelCoords(drag)
      : this.computeIconCoords(drag);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  }

  /** Inline coordinates for the collapsed floating icon at a dragged position */
  private computeIconCoords(drag: DragPosition): { left: number; top: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const alongX = clamp(drag.offset * (vw - TOGGLE_SIZE), EDGE_MARGIN, vw - TOGGLE_SIZE - EDGE_MARGIN);
    const alongY = clamp(drag.offset * (vh - TOGGLE_SIZE), EDGE_MARGIN, vh - TOGGLE_SIZE - EDGE_MARGIN);

    switch (drag.edge) {
      case 'top':
        return { left: alongX, top: EDGE_MARGIN };
      case 'bottom':
        return { left: alongX, top: vh - TOGGLE_SIZE - EDGE_MARGIN };
      case 'left':
        return { left: EDGE_MARGIN, top: alongY };
      default:
        return { left: vw - TOGGLE_SIZE - EDGE_MARGIN, top: alongY };
    }
  }

  /**
   * Inline coordinates for the expanded panel at a dragged position. The panel
   * hugs the same edge as the icon and is centered near the icon's offset, then
   * clamped so the 400px-wide panel never overflows the viewport.
   */
  private computePanelCoords(drag: DragPosition): { left: number; top: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelHeight = Math.min(700, vh * 0.85);

    const iconLeft = drag.offset * (vw - TOGGLE_SIZE);
    const iconTop = drag.offset * (vh - TOGGLE_SIZE);
    const left = clamp(
      iconLeft + TOGGLE_SIZE / 2 - PANEL_WIDTH / 2,
      EDGE_MARGIN,
      vw - PANEL_WIDTH - EDGE_MARGIN,
    );
    const top = clamp(
      iconTop + TOGGLE_SIZE / 2 - panelHeight / 2,
      EDGE_MARGIN,
      vh - panelHeight - EDGE_MARGIN,
    );

    switch (drag.edge) {
      case 'top':
        return { left, top: EDGE_MARGIN };
      case 'bottom':
        return { left, top: vh - panelHeight - EDGE_MARGIN };
      case 'left':
        return { left: EDGE_MARGIN, top };
      default:
        return { left: vw - PANEL_WIDTH - EDGE_MARGIN, top };
    }
  }

  // --- Floating toggle: click to open + optional drag-to-move ---

  private onToggleClick(): void {
    // A drag just finished — swallow the click so it doesn't open the panel
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.show();
  }

  private onTogglePointerDown(e: PointerEvent): void {
    if (!this.draggable || e.button !== 0) return;

    // Cancel any in-flight snap animation so the icon tracks the pointer immediately
    if (this.snapTimer !== undefined) {
      clearTimeout(this.snapTimer);
      this.snapTimer = undefined;
    }
    this.rootElement.classList.remove('ut-snapping');

    const rect = this.rootElement.getBoundingClientRect();
    this.dragGrabX = e.clientX - rect.left;
    this.dragGrabY = e.clientY - rect.top;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isDragging = true;
    this.dragMoved = false;

    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;

    if (!this.dragMoved) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.dragMoved = true;
      this.rootElement.classList.add('ut-dragging');
      this.rootElement.classList.remove(...POSITION_CLASSES);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = clamp(e.clientX - this.dragGrabX, EDGE_MARGIN, vw - TOGGLE_SIZE - EDGE_MARGIN);
    const top = clamp(e.clientY - this.dragGrabY, EDGE_MARGIN, vh - TOGGLE_SIZE - EDGE_MARGIN);

    const root = this.rootElement;
    root.style.right = '';
    root.style.bottom = '';
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  };

  private onPointerUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.removeDragListeners();
    this.rootElement.classList.remove('ut-dragging');

    if (!this.dragMoved) return; // treat as a plain click → onToggleClick opens it

    this.suppressClick = true;
    const rect = this.rootElement.getBoundingClientRect();
    const position = computeDragPosition(
      rect.left,
      rect.top,
      rect.width || TOGGLE_SIZE,
      rect.height || TOGGLE_SIZE,
      window.innerWidth,
      window.innerHeight,
    );

    // Animate the snap from the drop point to the edge, then drop the
    // transition class so later renders/resizes reposition instantly.
    this.rootElement.classList.add('ut-snapping');
    this.snapTimer = setTimeout(() => {
      this.rootElement.classList.remove('ut-snapping');
      this.snapTimer = undefined;
    }, 250);

    this.stateManager.setDragPosition(position);
    this.render();
  };

  private removeDragListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
  }

  private renderHeader(state: ToolbarState) {
    const flagCount = Object.keys(state.flags).length;
    const overrideCount = Object.values(state.flags).filter((f) => f.override !== null).length;

    return html`
      <div class="ut-header">
        <div class="ut-title">
          <img src="${UNLEASH_LOGO}" alt="Unleash" />
          <div>
            <div class="ut-title-main">Unleash Toolbar</div>
            <div class="ut-title-sub">${flagCount} flags • ${overrideCount} overrides</div>
          </div>
        </div>
        <div class="ut-header-actions">
          <button
            class="ut-btn-close ut-btn-minimize"
            @click=${() => this.minimize()}
            title="Minimize to floating icon"
            aria-label="Minimize toolbar"
          ><span class="ut-minimize-glyph"></span></button>
          <button
            class="ut-btn-close"
            @click=${() => this.hideCompletely()}
            title="Hide until page refresh"
            aria-label="Hide toolbar"
          >×</button>
        </div>
      </div>
    `;
  }

  private renderTabsNavigation() {
    return html`
      <div class="ut-tabs">
        <button 
          class=${`ut-tab ${this.currentTab === 'flags' ? 'active' : ''}`}
          @click=${() => this.switchTab('flags')}
        >
          Feature Flags
        </button>
        <button 
          class=${`ut-tab ${this.currentTab === 'context' ? 'active' : ''}`}
          @click=${() => this.switchTab('context')}
        >
          Context
        </button>
      </div>
    `;
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

    // Filter flags based on search query
    const filteredFlags = this.searchQuery
      ? flagNames.filter((name) => name.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : flagNames;

    return html`
      <div class="ut-tab-header">
        <div class="ut-search-container">
          <input
            type="text"
            class="ut-search-input"
            placeholder="Search flags..."
            .value=${this.searchQuery}
            @input=${(e: Event) => this.updateSearch((e.target as HTMLInputElement).value)}
          />
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

  private updateSearch(query: string): void {
    this.searchQuery = query;
    this.render();
  }

  private renderFlagItem(name: string) {
    const metadata = this.stateManager.getFlagMetadata(name);
    if (!metadata) return null;

    // Use the explicitly stored flag type
    const isVariant = metadata.flagType === 'variant';
    const hasOverride = metadata.override !== null;

    // Determine current state for toggle
    let toggleState = 'default';
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
              ? html`
            <div class="ut-toggle-group">
              <button 
                class=${`ut-toggle-btn ${toggleState === 'off' ? 'active' : ''}`}
                @click=${() => this.setFlagOverride(name, 'off')}
                title="Force this flag to OFF"
              >OFF</button>
              <button 
                class=${`ut-toggle-btn ${toggleState === 'default' ? 'active' : ''}`}
                @click=${() => this.setFlagOverride(name, 'default')}
                title="Use default value from Unleash (no override)"
              >—</button>
              <button 
                class=${`ut-toggle-btn ${toggleState === 'on' ? 'active' : ''}`}
                @click=${() => this.setFlagOverride(name, 'on')}
                title="Force this flag to ON"
              >ON</button>
            </div>
          `
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
                />
                <button 
                  class="ut-btn-small active" 
                  @click=${() => this.toggleVariantOverride(name)}
                  title="Clear variant override"
                >Clear Override</button>
              `
                  : html`
                <button 
                  class="ut-btn-small" 
                  @click=${() => this.toggleVariantOverride(name)}
                  title="Set a variant override"
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

  private toggleVariantOverride(flagName: string): void {
    const metadata = this.stateManager.getFlagMetadata(flagName);

    if (metadata?.override) {
      // Clear override
      this.stateManager.setFlagOverride(flagName, null);
    } else {
      // Set default variant override
      this.stateManager.setFlagOverride(flagName, { type: 'variant', variantKey: 'default' });
    }
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
        <label class="ut-label">
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
          />
          ${
            isOverridden && !readonly
              ? html`
            <button 
              class="ut-reset-field" 
              @click=${() => this.resetContextField(fieldName)}
              title="Reset to original value"
            >↻</button>
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
              />
              ${
                isOverridden
                  ? html`
                <button 
                  class="ut-reset-field" 
                  @click=${() => this.resetProperty(key)}
                  title="Reset to original value"
                >↻</button>
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
