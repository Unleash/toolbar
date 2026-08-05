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

/** Arrow keys that step a roving-tabindex selection, and the direction each moves */
const ROVING_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Resolve a keypress into the index a roving-tabindex group should move to, or
 * `null` when the key is not one that navigates.
 *
 * Shared by the tablist and each flag's override radio group: both walk a short
 * list with wrap-around, and duplicating the modular arithmetic per widget is
 * how off-by-one bugs get fixed in one place and missed in the other.
 *
 * `homeEnd` is opt-in rather than always on because the two WAI-ARIA patterns
 * differ: Home/End are expected of a tablist, but not of a radio group. Making it
 * a parameter records that asymmetry as intentional.
 */
export function rovingIndexForKey(
  key: string,
  current: number,
  length: number,
  options: { homeEnd?: boolean } = {},
): number | null {
  if (length === 0) return null;

  const step = ROVING_STEPS[key];
  if (step !== undefined) {
    // `current` is -1 when nothing is selected yet; stepping from there still
    // lands inside the list rather than going negative.
    return (current + step + length) % length;
  }

  if (options.homeEnd && key === 'Home') return 0;
  if (options.homeEnd && key === 'End') return length - 1;

  return null;
}

/** Static config for the keyboard controller */
export interface KeyboardControllerConfig {
  shortcut: string | false;
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
 * - a focus tether that hands Tab back to wherever the panel was summoned from
 * - an optional outside-click minimize
 *
 * The panel is deliberately not modal: the page underneath stays interactive,
 * because watching the page react to a flag change is the entire point of the
 * tool. Focus is therefore never trapped — Tab out of either end of the panel
 * leaves it, which WCAG 2.1.2 requires of anything non-modal.
 */
export class KeyboardController {
  private parsedShortcut: ParsedShortcut | null = null;
  /** The element focused before the panel opened, restored when it closes */
  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    config: KeyboardControllerConfig,
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

    if (event.key === 'Tab') {
      this.handleTab(event);
    }
  };

  /**
   * Hand Tab back to the summoning element when it steps off either end of the
   * panel.
   *
   * The toolbar is appended to the end of `document.body` (or wherever the host
   * puts it), so plain document order would drop the user at the browser chrome
   * rather than where they were reading. Returning to the origin keeps their
   * place, and unlike a trap it is a real exit: the panel stays open and the
   * next Tab carries on through the page from that point.
   *
   * With no origin to hand back to — the floating icon was clicked, or the
   * origin has since been unmounted — the browser's own sequencing is left
   * alone.
   */
  private handleTab(event: KeyboardEvent): void {
    if (!this.callbacks.isOpen()) return;

    const origin = this.previouslyFocused;
    if (!origin?.isConnected) return;

    const tabbables = getTabbableElements(this.root);
    if (tabbables.length === 0) return;

    // -1 covers the panel container itself, which is focusable but skipped by Tab
    // and sits ahead of every control in it: going forward from there enters the
    // panel natively, but going back would step straight out into the page.
    const index = tabbables.indexOf(document.activeElement as HTMLElement);
    const leaving = event.shiftKey ? index <= 0 : index === tabbables.length - 1;
    if (!leaving) return;

    event.preventDefault();
    origin.focus();
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
   * Return focus to wherever the panel was summoned from, falling back to the
   * toolbar's own trigger.
   *
   * The origin wins because the trigger is only the right target when the
   * trigger *was* the origin — and on exactly those paths `rememberFocus()` has
   * already stored `null`, so the fallback takes over on its own.
   */
  restoreFocus(fallback: HTMLElement | null): void {
    const previous = this.previouslyFocused;
    this.previouslyFocused = null;

    if (previous?.isConnected) {
      previous.focus();
      return;
    }

    // `isConnected` is not enough on its own: the toolbar hides the floating
    // icon with an inline `display: none` rather than unmounting it, and
    // focus() on a hidden element is a silent no-op that would leave focus
    // stranded on the body.
    if (fallback?.isConnected && !isHiddenWithin(fallback, this.root)) fallback.focus();
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
