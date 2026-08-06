import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUT, formatShortcut, matchesShortcut, parseShortcut } from '../shortcut';

/** Minimal stand-in for the parts of KeyboardEvent that matchesShortcut reads */
/** parseShortcut for chords the test knows are valid */
const chord = (shortcut: string) => {
  const parsed = parseShortcut(shortcut);
  if (!parsed) throw new Error(`expected '${shortcut}' to parse`);
  return parsed;
};

const keyEvent = (
  key: string,
  modifiers: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('parseShortcut', () => {
  it('should parse the default shortcut', () => {
    expect(parseShortcut(DEFAULT_SHORTCUT)).toEqual({
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
      key: 'f',
    });
  });

  it('should be case- and whitespace-insensitive', () => {
    expect(parseShortcut(' MOD + Shift + F ')).toEqual(parseShortcut('mod+shift+f'));
  });

  it('should accept modifier aliases', () => {
    const withAliases = parseShortcut('cmd+option+control+k');
    expect(withAliases).toMatchObject({ meta: true, alt: true, ctrl: true, key: 'k' });
  });

  it('should support non-character keys', () => {
    expect(parseShortcut('mod+arrowup')).toMatchObject({ mod: true, key: 'arrowup' });
  });

  it('should return null when no non-modifier key is named', () => {
    expect(parseShortcut('mod+shift')).toBeNull();
    expect(parseShortcut('')).toBeNull();
    expect(parseShortcut('+++')).toBeNull();
  });
});

describe('matchesShortcut', () => {
  const modShiftF = chord('mod+shift+f');

  it('should match Cmd+Shift+F on macOS', () => {
    expect(matchesShortcut(keyEvent('f', { metaKey: true, shiftKey: true }), modShiftF, true)).toBe(
      true,
    );
  });

  it('should match Ctrl+Shift+F off macOS', () => {
    expect(
      matchesShortcut(keyEvent('f', { ctrlKey: true, shiftKey: true }), modShiftF, false),
    ).toBe(true);
  });

  it('should not treat Ctrl as the primary modifier on macOS', () => {
    expect(matchesShortcut(keyEvent('f', { ctrlKey: true, shiftKey: true }), modShiftF, true)).toBe(
      false,
    );
  });

  it('should be case-insensitive about the key', () => {
    expect(matchesShortcut(keyEvent('F', { metaKey: true, shiftKey: true }), modShiftF, true)).toBe(
      true,
    );
  });

  it('should require every modifier in the chord', () => {
    expect(matchesShortcut(keyEvent('f', { metaKey: true }), modShiftF, true)).toBe(false);
    expect(matchesShortcut(keyEvent('f', { shiftKey: true }), modShiftF, true)).toBe(false);
  });

  it('should not match a superset chord the host app may own', () => {
    // Cmd+Alt+Shift+F is a different binding and must fall through
    expect(
      matchesShortcut(
        keyEvent('f', { metaKey: true, shiftKey: true, altKey: true }),
        modShiftF,
        true,
      ),
    ).toBe(false);
  });

  it('should not match a different key', () => {
    expect(matchesShortcut(keyEvent('g', { metaKey: true, shiftKey: true }), modShiftF, true)).toBe(
      false,
    );
  });
});

describe('formatShortcut', () => {
  it('should use symbols on macOS', () => {
    expect(formatShortcut(chord('mod+shift+f'), true)).toBe('⌘⇧F');
  });

  it('should use words elsewhere', () => {
    expect(formatShortcut(chord('mod+shift+f'), false)).toBe('Ctrl+Shift+F');
  });

  it('should keep multi-character key names intact', () => {
    expect(formatShortcut(chord('mod+arrowup'), false)).toBe('Ctrl+arrowup');
  });
});
