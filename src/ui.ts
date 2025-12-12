import { ToolbarStateManager } from './state';
import {
  InitToolbarOptions,
  UnleashContext,
  WrappedUnleashClient,
  IToolbarUI,
} from './types';
import { html, render } from 'lit-html';

// Unleash logo from CDN
const UNLEASH_LOGO = 'https://cdn.getunleash.io/docs-assets/unleash_logo_icon.svg';

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

  constructor(
    stateManager: ToolbarStateManager,
    wrappedClient: WrappedUnleashClient,
    options: InitToolbarOptions = {}
  ) {
    this.stateManager = stateManager;
    this.position = options.position || 'bottom';
    this.themePreset = options.themePreset || 'light';
    this.customTheme = options.theme;
    
    // Capture original base context before any overrides are applied
    this.originalBaseContext = wrappedClient.__original?.getContext?.() || {};

    // Initialize visibility from persisted state, or use initiallyVisible option
    const persistedVisibility = this.stateManager.getVisibility();
    const isVisible = persistedVisibility !== undefined ? persistedVisibility : (options.initiallyVisible ?? false);
    
    // Persist the initial visibility if not already set
    if (persistedVisibility === undefined) {
      this.stateManager.setVisibility(isVisible);
    }

    // Create single root container
    this.rootElement = document.createElement('div');
    this.rootElement.className = `unleash-toolbar-container position-${this.position}`;
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

    // Initial render
    this.render();
  }

  private applyCustomTheme(element: HTMLElement): void {
    if (!this.customTheme) return;

    const style = element.style;
    if (this.customTheme.primaryColor) style.setProperty('--ut-primary', this.customTheme.primaryColor);
    if (this.customTheme.backgroundColor) style.setProperty('--ut-bg', this.customTheme.backgroundColor);
    if (this.customTheme.textColor) style.setProperty('--ut-text', this.customTheme.textColor);
    if (this.customTheme.borderColor) style.setProperty('--ut-border', this.customTheme.borderColor);
    if (this.customTheme.fontFamily) style.setProperty('--ut-font', this.customTheme.fontFamily);
  }

  show(): void {
    this.stateManager.setVisibility(true);
    this.render();
  }

  hide(): void {
    this.stateManager.setVisibility(false);
    this.render();
  }

  destroy(): void {
    this.rootElement.remove();
  }

  private render(): void {
    console.log('[Unleash Toolbar Lit] Rendering UI');
    const state = this.stateManager.getState();
    const flagNames = this.stateManager.getFlagNames();
    const isVisible = this.stateManager.getVisibility();

    // Single unified template for everything
    const template = html`
      <button 
        class="ut-toggle" 
        style=${isVisible ? 'display: none;' : 'display: flex;'}
        @click=${() => this.show()}
        title="Open Unleash Toolbar"
      >
        <img src="${UNLEASH_LOGO}" alt="Unleash" />
      </button>

      <div 
        class="unleash-toolbar" 
        style=${isVisible ? 'display: flex;' : 'display: none;'}
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
  }

  private renderHeader(state: any) {
    const flagCount = Object.keys(state.flags).length;
    const overrideCount = Object.values(state.flags).filter((f: any) => f.override !== null).length;

    return html`
      <div class="ut-header">
        <div class="ut-title">
          <img src="${UNLEASH_LOGO}" alt="Unleash" />
          <div>
            <div class="ut-title-main">Unleash Toolbar</div>
            <div class="ut-title-sub">${flagCount} flags • ${overrideCount} overrides</div>
          </div>
        </div>
        <button class="ut-btn-close" @click=${() => this.hide()} title="Close toolbar">×</button>
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

    return html`
      <div class="ut-tab-header">
        <button class="ut-btn" @click=${() => this.stateManager.resetOverrides()}>
          Reset All Overrides
        </button>
      </div>
      <div class="ut-flag-list">
        ${flagNames.map(name => this.renderFlagItem(name))}
      </div>
    `;
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
              ${hasOverride ? html`
                <span class="ut-override-indicator" title="Override value (overriding the default)">
                  → ${this.renderValueBadge(metadata.lastEffectiveValue)}
                </span>
              ` : null}
            </div>
          </div>
        </div>
        
        <div class="ut-flag-control">
          ${!isVariant ? html`
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
          ` : html`
            <div class="ut-variant-control">
              ${hasOverride && metadata.override?.type === 'variant' ? html`
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
              ` : html`
                <button 
                  class="ut-btn-small" 
                  @click=${() => this.toggleVariantOverride(name)}
                  title="Set a variant override"
                >Override Variant</button>
              `}
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderValueBadge(value: any) {
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

  private isFieldOverridden(fieldName: string, baseContext: Partial<UnleashContext>, contextOverrides: Partial<UnleashContext>): boolean {
    if (fieldName === 'properties') {
      return false; // Handle properties separately
    }
    const baseValue = baseContext[fieldName as keyof UnleashContext];
    const overrideValue = contextOverrides[fieldName as keyof UnleashContext];
    
    // Only consider it overridden if there's an override AND it differs from base
    return overrideValue !== undefined && overrideValue !== baseValue;
  }

  private renderContextField(label: string, fieldName: string, placeholder: string, value: string, isOverridden: boolean, readonly = false) {
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
          ${isOverridden && !readonly ? html`
            <button 
              class="ut-reset-field" 
              @click=${() => this.resetContextField(fieldName)}
              title="Reset to original value"
            >↻</button>
          ` : null}
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
    const standardFields = ['userId', 'sessionId', 'remoteAddress', 'environment', 'appName', 'properties'];
    
    // Merge properties and exclude any that are standard fields
    const baseProperties = baseContext.properties || {};
    const overrideProperties = contextOverrides.properties || {};
    const mergedProperties = { ...baseProperties, ...overrideProperties };
    
    // Filter out standard fields and show only non-empty properties
    const customPropertiesArray = Object.entries(mergedProperties)
      .filter(([key, value]) => {
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

  private renderProperties(properties: Record<string, string>, baseProperties: Record<string, string> = {}) {
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
              ${isOverridden ? html`
                <button 
                  class="ut-reset-field" 
                  @click=${() => this.resetProperty(key)}
                  title="Reset to original value"
                >↻</button>
              ` : null}
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
