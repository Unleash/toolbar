/**
 * Parsing and matching for the toolbar's keyboard shortcut.
 *
 * Kept free of DOM state so the chord logic can be unit-tested directly.
 */

/** A shortcut broken down into the modifiers and the key it requires */
export interface ParsedShortcut {
  /** Requires the platform's primary modifier: Cmd on macOS, Ctrl elsewhere */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** The non-modifier key, lowercased (matched against `KeyboardEvent.key`) */
  key: string;
}

/** The shortcut used when none is configured */
export const DEFAULT_SHORTCUT = 'mod+shift+f';

/**
 * Whether the current platform uses Cmd (rather than Ctrl) as its primary
 * modifier. Falls back to Ctrl when there is no navigator to inspect (SSR).
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  // userAgentData is the modern API; platform is the widely-supported fallback
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Parse a chord like `'mod+shift+f'` into its parts. Returns `null` for input
 * that names no actual key, so a malformed option can never match every keypress.
 */
export function parseShortcut(shortcut: string): ParsedShortcut | null {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  const parsed: ParsedShortcut = {
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key: '',
  };

  for (const part of parts) {
    switch (part) {
      case 'mod':
        parsed.mod = true;
        break;
      case 'ctrl':
      case 'control':
        parsed.ctrl = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        parsed.meta = true;
        break;
      case 'alt':
      case 'option':
        parsed.alt = true;
        break;
      case 'shift':
        parsed.shift = true;
        break;
      default:
        // The last non-modifier token wins, so 'mod+shift+f' yields key 'f'
        parsed.key = part;
    }
  }

  return parsed.key ? parsed : null;
}

/**
 * Whether a keyboard event satisfies a parsed chord.
 *
 * Modifiers must match exactly — a chord without `alt` will not fire when Alt is
 * held — so the toolbar cannot swallow a superset chord the host app owns.
 */
export function matchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  shortcut: ParsedShortcut,
  isMac: boolean = isMacPlatform(),
): boolean {
  const expectedCtrl = shortcut.ctrl || (shortcut.mod && !isMac);
  const expectedMeta = shortcut.meta || (shortcut.mod && isMac);

  if (event.ctrlKey !== expectedCtrl) return false;
  if (event.metaKey !== expectedMeta) return false;
  if (event.altKey !== shortcut.alt) return false;
  if (event.shiftKey !== shortcut.shift) return false;

  return event.key.toLowerCase() === shortcut.key;
}

const SYMBOLS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
};

const WORDS: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
};

/**
 * Human-readable form of a chord for tooltips, e.g. `⌘⇧F` on macOS and
 * `Ctrl+Shift+F` elsewhere.
 */
export function formatShortcut(shortcut: ParsedShortcut, isMac: boolean = isMacPlatform()): string {
  const table = isMac ? SYMBOLS : WORDS;
  const parts: string[] = [];

  if (shortcut.mod) parts.push(table.mod);
  if (shortcut.ctrl && !shortcut.mod) parts.push(table.ctrl);
  if (shortcut.meta && !shortcut.mod) parts.push(table.meta);
  if (shortcut.alt) parts.push(table.alt);
  if (shortcut.shift) parts.push(table.shift);
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);

  return isMac ? parts.join('') : parts.join('+');
}
