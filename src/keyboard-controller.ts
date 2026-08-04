import {
  DEFAULT_SHORTCUT,
  formatShortcut,
  matchesShortcut,
  type ParsedShortcut,
  parseShortcut,
} from './shortcut';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].join(',');

/**
 * Whether an element is hidden from the tab order by this toolbar's own markup.
 *
 * The toolbar hides the panel, the floating icon and inactive tab panels with an
 * inline `display: none`, so walking inline styles (plus the `hidden` attribute)
 * is enough and — unlike `offsetParent` or `getClientRects()` — it also works in
 * jsdom, where nothing has layout.
 */
function isHiddenWithin(element: HTMLElement, root: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node) {
    if (node.hasAttribute('hidden') || node.style.display === 'none') return true;
    if (node === root) return false;
    node = node.parentElement;
  }
  return false;
}

/**
 * Visible, tabbable elements inside `root`, in DOM order.
 *
 * Elements with a negative tabindex are focusable but deliberately skipped by
 * Tab, so they are excluded here too.
 */
export function getTabbableElements(root: HTMLElement): HTMLElement[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  return candidates.filter((element) => {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex !== null && Number.parseInt(tabindex, 10) < 0) return false;
    return !isHiddenWithin(element, root);
  });
}

/** Static config for the keyboard controller */
export interface KeyboardControllerConfig {
  shortcut: string | false;
  trapFocus: boolean;
  closeOnOutsideClick: boolean;
}

/** Callbacks the controller uses to drive the owning UI */
export interface KeyboardControllerCallbacks {
  /** Open the panel if collapsed, minimize it if open (bound to the shortcut) */
  onToggle: () => void;
  /** Minimize the panel (bound to Escape and to outside clicks) */
  onMinimize: () => void;
  /** Whether the panel is currently open */
  isOpen: () => boolean;
}

/**
 * Owns every keyboard and outside-pointer interaction for the toolbar:
 *
 * - a global shortcut that toggles the panel
 * - Escape to minimize while focus is inside the panel
 * - a soft focus trap that keeps Tab cycling within the open panel
 * - an optional outside-click minimize
 *
 * "Soft" trap means the page is never marked `inert` and the panel does not
 * claim `aria-modal`: mouse users keep full access to the page underneath, which
 * matters for a tool whose whole point is watching the page react to a flag.
 * Only the Tab sequence is contained, and Escape always releases it.
 */
export class KeyboardController {
  private parsedShortcut: ParsedShortcut | null = null;
  /** The element focused before the panel opened, restored when it closes */
  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private config: KeyboardControllerConfig,
    private callbacks: KeyboardControllerCallbacks,
  ) {
    if (config.shortcut !== false) {
      this.parsedShortcut = parseShortcut(config.shortcut || DEFAULT_SHORTCUT);
    }

    // Escape and the Tab trap only concern keys pressed inside the toolbar, so
    // they listen on the root rather than the document.
    this.root.addEventListener('keydown', this.onRootKeyDown);

    if (typeof document !== 'undefined') {
      if (this.parsedShortcut) {
        document.addEventListener('keydown', this.onDocumentKeyDown);
      }
      if (config.closeOnOutsideClick) {
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
      }
    }
  }

  /** The configured chord in display form (e.g. `⌘⇧F`), or null when disabled */
  get shortcutLabel(): string | null {
    return this.parsedShortcut ? formatShortcut(this.parsedShortcut) : null;
  }

  private onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.parsedShortcut || event.repeat) return;
    if (!matchesShortcut(event, this.parsedShortcut)) return;

    event.preventDefault();
    this.callbacks.onToggle();
  };

  private onRootKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (!this.callbacks.isOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onMinimize();
      return;
    }

    if (event.key === 'Tab' && this.config.trapFocus) {
      this.handleTab(event);
    }
  };

  private handleTab(event: KeyboardEvent): void {
    if (!this.callbacks.isOpen()) return;

    const tabbables = getTabbableElements(this.root);
    if (tabbables.length === 0) return;

    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    // Wrap around at both ends. If focus is somewhere unexpected (e.g. on the
    // panel container itself, which has tabindex="-1"), Tab still enters the
    // sequence at the correct end instead of escaping to the page.
    if (event.shiftKey) {
      if (active === first || !tabbables.includes(active as HTMLElement)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !tabbables.includes(active as HTMLElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  private onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.callbacks.isOpen()) return;

    const target = event.target as Node | null;
    if (target && this.root.contains(target)) return;

    this.callbacks.onMinimize();
  };

  /**
   * Remember where focus was before the panel took it, so it can be handed back
   * on close. Ignores elements inside the toolbar itself (e.g. the floating
   * icon), which are about to disappear.
   */
  rememberFocus(): void {
    if (typeof document === 'undefined') return;

    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || this.root.contains(active)) {
      this.previouslyFocused = null;
      return;
    }
    this.previouslyFocused = active;
  }

  /**
   * Return focus to the toolbar's trigger, or — when the trigger is not rendered
   * — to whatever held focus before the panel opened.
   */
  restoreFocus(fallback: HTMLElement | null): void {
    if (fallback?.isConnected) {
      fallback.focus();
      this.previouslyFocused = null;
      return;
    }

    const previous = this.previouslyFocused;
    this.previouslyFocused = null;
    if (previous?.isConnected) previous.focus();
  }

  destroy(): void {
    this.root.removeEventListener('keydown', this.onRootKeyDown);
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.onDocumentKeyDown);
      document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    }
    this.previouslyFocused = null;
  }
}
