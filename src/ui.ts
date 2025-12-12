import { ToolbarStateManager } from './state';
import {
  InitToolbarOptions,
  UnleashContext,
  WrappedUnleashClient,
} from './types';
import './toolbar.css';

// Inline Unleash logo SVG (avoids bundling issues)
const UNLEASH_LOGO = `data:image/svg+xml,%3csvg%20width='161'%20height='161'%20viewBox='0%200%20161%20161'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M80.6201%20160.62C124.803%20160.62%20160.62%20124.803%20160.62%2080.62C160.62%2036.4372%20124.803%200.619995%2080.6201%200.619995C36.4373%200.619995%200.620117%2036.4372%200.620117%2080.62C0.620117%20124.803%2036.4373%20160.62%2080.6201%20160.62Z'%20fill='white'/%3e%3cpath%20d='M92.0501%2046.33V92.05H114.9V46.33H92.0501ZM69.1901%2069.19V46.33H46.3301V114.9H92.0501V92.05H69.1901V69.19Z'%20fill='white'/%3e%3cpath%20d='M92.0501%2046.33V92.05H114.9V46.33H92.0501ZM69.1901%2069.19V46.33H46.3301V114.9H92.0501V92.05H69.1901V69.19Z'%20fill='%231A4049'/%3e%3cpath%20d='M92.05%2092.05H114.91V114.91H92.05V92.05Z'%20fill='%23817AFE'/%3e%3c/svg%3e`;

/**
 * Create the toolbar UI component
 */
export class ToolbarUI {
  private container: HTMLElement;
  private rootElement: HTMLElement;
  private toggleButton: HTMLElement;
  private stateManager: ToolbarStateManager;
  private currentTab: 'flags' | 'context' = 'flags';
  private position: string;
  private originalBaseContext: Partial<UnleashContext>;

  constructor(
    stateManager: ToolbarStateManager,
    wrappedClient: WrappedUnleashClient,
    options: InitToolbarOptions = {}
  ) {
    this.stateManager = stateManager;
    this.position = options.position || 'bottom';
    
    // Capture original base context before any overrides are applied
    this.originalBaseContext = wrappedClient.__original?.getContext?.() || {};

    // Initialize visibility from persisted state, or use initiallyVisible option
    const persistedVisibility = this.stateManager.getVisibility();
    const isVisible = persistedVisibility !== undefined ? persistedVisibility : (options.initiallyVisible ?? false);
    
    // Persist the initial visibility if not already set
    if (persistedVisibility === undefined) {
      this.stateManager.setVisibility(isVisible);
    }

    // Create root element
    this.rootElement = document.createElement('div');
    this.rootElement.className = `unleash-toolbar position-${this.position}`;
    this.rootElement.style.display = isVisible ? 'flex' : 'none';

    // Create toggle button (shown when toolbar is hidden)
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = `ut-toggle position-${this.position}`;
    this.toggleButton.innerHTML = `<img src="${UNLEASH_LOGO}" alt="Unleash" />`;
    this.toggleButton.style.display = isVisible ? 'none' : 'flex';
    this.toggleButton.addEventListener('click', () => this.show());

    // Apply theme preset
    const themePreset = options.themePreset || 'light';
    if (themePreset === 'dark') {
      this.rootElement.classList.add('ut-theme-dark');
      this.toggleButton.classList.add('ut-theme-dark');
    }

    // Apply custom theme (overrides preset)
    if (options.theme) {
      this.applyTheme(options.theme);
    }

    // Attach to container or body
    this.container = options.container || document.body;
    this.container.appendChild(this.rootElement);
    this.container.appendChild(this.toggleButton);

    // Subscribe to state changes
    this.stateManager.subscribe(() => {
      this.render();
    });

    // Initial render
    this.render();
  }

  private applyTheme(theme: InitToolbarOptions['theme']): void {
    if (!theme) return;

    const style = this.rootElement.style;
    if (theme.primaryColor) style.setProperty('--ut-primary', theme.primaryColor);
    if (theme.backgroundColor) style.setProperty('--ut-bg', theme.backgroundColor);
    if (theme.textColor) style.setProperty('--ut-text', theme.textColor);
    if (theme.borderColor) style.setProperty('--ut-border', theme.borderColor);
    if (theme.fontFamily) style.setProperty('--ut-font', theme.fontFamily);
  }

  show(): void {
    this.stateManager.setVisibility(true);
    this.rootElement.style.display = 'flex';
    this.toggleButton.style.display = 'none';
  }

  hide(): void {
    this.stateManager.setVisibility(false);
    this.rootElement.style.display = 'none';
    this.toggleButton.style.display = 'flex';
  }

  destroy(): void {
    this.rootElement.remove();
    this.toggleButton.remove();
  }

  private render(): void {
    console.log('[Unleash Toolbar] Rendering UI');
    const state = this.stateManager.getState();
    const flagNames = this.stateManager.getFlagNames();

    // Preserve focus and cursor position (before re-render)
    const activeElement = document.activeElement as HTMLInputElement | HTMLSelectElement | null;
    const focusInfo = activeElement && this.rootElement.contains(activeElement) ? {
      action: activeElement.getAttribute('data-action'),
      contextField: activeElement.getAttribute('data-context-field'),
      propertyKey: activeElement.getAttribute('data-property-key'),
      flag: activeElement.getAttribute('data-flag'),
      value: activeElement.value,
      selectionStart: (activeElement as HTMLInputElement).selectionStart,
      selectionEnd: (activeElement as HTMLInputElement).selectionEnd,
      tagName: activeElement.tagName
    } : null;

    this.rootElement.innerHTML = `
      ${this.renderHeader(state)}
      ${this.renderTabs()}
      <div class="ut-content">
        ${this.currentTab === 'flags' ? this.renderFlagsTab(flagNames) : this.renderContextTab(state.contextOverrides)}
      </div>
    `;

    this.attachEventListeners();

    // Restore focus and cursor position (after re-render)
    if (focusInfo) {
      let elementToFocus: HTMLElement | null = null;
      
      if (focusInfo.flag && focusInfo.action) {
        // Flag-specific element (variant input)
        elementToFocus = this.rootElement.querySelector(`[data-flag="${focusInfo.flag}"][data-action="${focusInfo.action}"]`);
      } else if (focusInfo.propertyKey && focusInfo.action) {
        // Property field (need both action and property key to be specific)
        elementToFocus = this.rootElement.querySelector(`[data-action="${focusInfo.action}"][data-property-key="${focusInfo.propertyKey}"]`);
      } else if (focusInfo.contextField) {
        // Context field
        elementToFocus = this.rootElement.querySelector(`[data-context-field="${focusInfo.contextField}"]`);
      } else if (focusInfo.action) {
        // Fallback to action only
        elementToFocus = this.rootElement.querySelector(`[data-action="${focusInfo.action}"]`);
      }
      
      if (elementToFocus && (elementToFocus.tagName === 'INPUT' || elementToFocus.tagName === 'SELECT')) {
        const input = elementToFocus as HTMLInputElement | HTMLSelectElement;
        input.focus();
        if (input.tagName === 'INPUT' && typeof focusInfo.selectionStart === 'number') {
          (input as HTMLInputElement).setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
        }
      }
    }
  }

  private renderHeader(state: any): string {
    const flagCount = Object.keys(state.flags).length;
    const overrideCount = Object.values(state.flags).filter((f: any) => f.override !== null).length;

    return `
      <div class="ut-header">
        <div class="ut-title">
          <img src="${UNLEASH_LOGO}" alt="Unleash" />
          <div>
            <div style="font-weight: 600; font-size: 14px; line-height: 1.3;">Unleash Toolbar</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 1px;">${flagCount} flags • ${overrideCount} overrides</div>
          </div>
        </div>
        <button class="ut-btn-close" data-action="close" title="Minimize toolbar">×</button>
      </div>
    `;
  }

  private renderTabs(): string {
    return `
      <div class="ut-tabs">
        <button class="ut-tab ${this.currentTab === 'flags' ? 'active' : ''}" data-tab="flags">
          Feature Flags
        </button>
        <button class="ut-tab ${this.currentTab === 'context' ? 'active' : ''}" data-tab="context">
          Context
        </button>
      </div>
    `;
  }

  private renderFlagsTab(flagNames: string[]): string {
    if (flagNames.length === 0) {
      return `
        <div class="ut-empty">
          No flags evaluated yet. Use feature flags in your app to see them here.
        </div>
      `;
    }

    return `
      <div class="ut-tab-header">
        <button class="ut-btn" data-action="reset-overrides">Reset All Overrides</button>
      </div>
      <div class="ut-flag-list">
        ${flagNames.map(name => this.renderFlagItem(name)).join('')}
      </div>
    `;
  }

  private renderFlagItem(name: string): string {
    const metadata = this.stateManager.getFlagMetadata(name);
    if (!metadata) return '';

    // Use the explicitly stored flag type
    const isVariant = metadata.flagType === 'variant';
    const hasOverride = metadata.override !== null;
    
    // Determine current state for toggle
    let toggleState = 'default';
    if (hasOverride && metadata.override?.type === 'flag') {
      toggleState = metadata.override.value ? 'on' : 'off';
    }

    return `
      <div class="ut-flag-item">
        <div class="ut-flag-main">
          <div class="ut-flag-header">
            <div class="ut-flag-title-row">
              <div class="ut-flag-name">${this.escapeHtml(name)}</div>
            </div>
            <div class="ut-flag-meta">
              <div class="ut-flag-default-value" title="Default value from Unleash">
                ${this.renderValueBadge(metadata.lastDefaultValue)}
              </div>
              ${hasOverride ? `
                <span class="ut-override-indicator" title="Override value (overriding the default)">
                  → ${this.renderValueBadge(metadata.lastEffectiveValue)}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="ut-flag-control">
          ${!isVariant ? `
            <div class="ut-toggle-group" data-flag="${this.escapeHtml(name)}">
              <button 
                class="ut-toggle-btn ${toggleState === 'off' ? 'active' : ''}" 
                data-action="set-override" 
                data-flag="${this.escapeHtml(name)}"
                data-value="off"
                title="Force this flag to OFF"
              >OFF</button>
              <button 
                class="ut-toggle-btn ${toggleState === 'default' ? 'active' : ''}" 
                data-action="set-override" 
                data-flag="${this.escapeHtml(name)}"
                data-value="default"
                title="Use default value from Unleash (no override)"
              >—</button>
              <button 
                class="ut-toggle-btn ${toggleState === 'on' ? 'active' : ''}" 
                data-action="set-override" 
                data-flag="${this.escapeHtml(name)}"
                data-value="on"
                title="Force this flag to ON"
              >ON</button>
            </div>
          ` : `
            <div class="ut-variant-control">
              ${hasOverride && metadata.override?.type === 'variant' ? `
                <input 
                  type="text" 
                  class="ut-input-small" 
                  id="ut-variant-${this.escapeHtml(name)}"
                  name="variant-${this.escapeHtml(name)}"
                  placeholder="Variant name" 
                  value="${this.escapeHtml(metadata.override.variantKey)}"
                  data-action="set-variant"
                  data-flag="${this.escapeHtml(name)}"
                  title="Enter variant name to override with"
                />
                <button 
                  class="ut-btn-small active" 
                  data-action="toggle-variant-override"
                  data-flag="${this.escapeHtml(name)}"
                  title="Clear variant override"
                >Clear Override</button>
              ` : `
                <button 
                  class="ut-btn-small" 
                  data-action="toggle-variant-override"
                  data-flag="${this.escapeHtml(name)}"
                  title="Set a variant override"
                >Override Variant</button>
              `}
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderValueBadge(value: any): string {
    if (typeof value === 'boolean') {
      return `<span class="ut-badge ut-badge-${value ? 'success' : 'danger'}">${value ? 'ON' : 'OFF'}</span>`;
    }
    if (value && typeof value === 'object' && 'name' in value) {
      return `<span class="ut-badge ut-badge-default">${this.escapeHtml(value.name)}</span>`;
    }
    return `<span class="ut-badge ut-badge-default">null</span>`;
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

  private renderContextField(label: string, fieldName: string, placeholder: string, value: string, isOverridden: boolean, readonly = false): string {
    return `
      <div class="ut-form-group">
        <label class="ut-label" for="ut-field-${fieldName}">
          ${label}${readonly ? ' <span style="opacity: 0.6; font-size: 11px;">(read-only)</span>' : ''}
        </label>
        <div class="ut-input-with-reset">
          <input 
            type="text" 
            class="ut-input" 
            id="ut-field-${fieldName}"
            name="${fieldName}"
            placeholder="${placeholder}"
            value="${this.escapeHtml(value)}"
            data-context-field="${fieldName}"
            ${readonly ? 'readonly' : ''}
            ${readonly ? 'style="opacity: 0.7; cursor: not-allowed;" title="This context field is static and cannot be modified."' : ''}
          />
          ${isOverridden && !readonly ? `<button class="ut-reset-field" data-action="reset-context-field" data-field="${fieldName}" title="Reset to original value">↻</button>` : ''}
        </div>
      </div>
    `;
  }

  private renderContextTab(contextOverrides: Partial<UnleashContext>): string {
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

    return `
      <div class="ut-tab-header">
        <button class="ut-btn" data-action="reset-context">Reset All Context</button>
      </div>
      <div class="ut-context-form">
        ${this.renderContextField('User ID', 'userId', 'user-123', mergedContext.userId || '', this.isFieldOverridden('userId', baseContext, contextOverrides))}
        ${this.renderContextField('Session ID', 'sessionId', 'session-456', mergedContext.sessionId || '', this.isFieldOverridden('sessionId', baseContext, contextOverrides))}
        ${this.renderContextField('Remote Address', 'remoteAddress', '192.168.1.1', mergedContext.remoteAddress || '', this.isFieldOverridden('remoteAddress', baseContext, contextOverrides))}
        ${this.renderContextField('Environment', 'environment', 'development', mergedContext.environment || '', false, true)}
        ${this.renderContextField('App Name', 'appName', 'my-app', mergedContext.appName || '', false, true)}

        <div class="ut-form-group">
          <div class="ut-label">Custom Properties</div>
          <div class="ut-properties" data-properties-container>
            ${this.renderProperties(customProperties || {}, baseProperties)}
          </div>
        </div>
      </div>
    `;
  }

  private renderProperties(properties: Record<string, string>, baseProperties: Record<string, string> = {}): string {
    const entries = Object.entries(properties);
    
    if (entries.length === 0) {
      return `
        <div style="font-size: 12px; color: #636e72; margin-bottom: 8px;">
          No custom properties defined in base context
        </div>
      `;
    }

    return `
      ${entries.map(([key, value]) => {
        const baseValue = baseProperties[key];
        const isOverridden = baseValue !== undefined && baseValue !== value;
        return `
        <div class="ut-property-row">
          <div class="ut-property-key" title="Property key (read-only)">${this.escapeHtml(key)}</div>
          <div class="ut-input-with-reset">
            <input 
              type="text" 
              class="ut-input" 
              id="ut-prop-value-${this.escapeHtml(key)}"
              name="property-value-${this.escapeHtml(key)}"
              placeholder="Value"
              value="${this.escapeHtml(value)}"
              data-property-key="${this.escapeHtml(key)}"
              data-action="update-property-value"
              ${isOverridden ? `title="Original: ${this.escapeHtml(baseValue)}"` : ''}
            />
            ${isOverridden ? `
              <button 
                class="ut-reset-field" 
                data-action="reset-property"
                data-property-key="${this.escapeHtml(key)}"
                title="Reset to original value"
                tabindex="-1"
              >↻</button>
            ` : ''}
          </div>
        </div>
      `}).join('')}
    `;
  }



  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.rootElement.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.hide());

    // Reset buttons
    const resetOverridesBtn = this.rootElement.querySelector('[data-action="reset-overrides"]');
    resetOverridesBtn?.addEventListener('click', () => {
      this.stateManager.resetOverrides();
    });

    const resetContextBtn = this.rootElement.querySelector('[data-action="reset-context"]');
    resetContextBtn?.addEventListener('click', () => {
      this.stateManager.resetContextOverrides();
    });

    this.rootElement.querySelectorAll('[data-action="reset-context-field"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldName = (e.currentTarget as HTMLElement).dataset.field;
        if (fieldName) {
          this.stateManager.removeContextOverride(fieldName as keyof UnleashContext);
        }
      });
    });

    // Tab switching
    this.rootElement.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentTab = target.dataset.tab as 'flags' | 'context';
        this.render();
      });
    });

    // Flag overrides - toggle buttons
    this.rootElement.querySelectorAll('[data-action="set-override"]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const flagName = target.dataset.flag!;
        const value = target.dataset.value!;

        if (value === 'default') {
          this.stateManager.setFlagOverride(flagName, null);
        } else if (value === 'on') {
          this.stateManager.setFlagOverride(flagName, { type: 'flag', value: true });
        } else if (value === 'off') {
          this.stateManager.setFlagOverride(flagName, { type: 'flag', value: false });
        }
      });
    });

    // Variant override toggle
    this.rootElement.querySelectorAll('[data-action="toggle-variant-override"]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const flagName = target.dataset.flag!;
        const metadata = this.stateManager.getFlagMetadata(flagName);
        
        if (metadata?.override) {
          // Clear override
          this.stateManager.setFlagOverride(flagName, null);
        } else {
          // Set default variant override
          this.stateManager.setFlagOverride(flagName, { type: 'variant', variantKey: 'default' });
        }
      });
    });

    // Variant inputs
    this.rootElement.querySelectorAll('[data-action="set-variant"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const flagName = target.dataset.flag!;
        this.stateManager.setFlagOverride(flagName, { type: 'variant', variantKey: target.value });
      });
    });

    // Context fields
    this.rootElement.querySelectorAll('[data-context-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const field = target.dataset.contextField!;
        this.stateManager.setContextOverride({ [field]: target.value || undefined });
      });
    });

    // Property management - reset only
    this.rootElement.querySelectorAll('[data-action="reset-property"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const key = target.dataset.propertyKey!;
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
      });
    });

    this.rootElement.querySelectorAll('[data-action="update-property-value"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const key = target.dataset.propertyKey!;
        const state = this.stateManager.getState();
        const properties = { ...(state.contextOverrides.properties || {}), [key]: target.value };
        this.stateManager.setContextOverride({ properties });
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
