import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PRACTICE_KEY,
  describeTheme,
  isThemePreference,
  readDefaultPractice,
  resolveTheme,
  writeDefaultPractice,
} from '../src/scripts/preferences';

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preferences', () => {
  it('accepts only the three supported theme preferences', () => {
    expect(['system', 'dark', 'light'].filter(isThemePreference)).toEqual(['system', 'dark', 'light']);
    expect(['auto', 'sepia', '', null].filter(isThemePreference)).toEqual([]);
  });

  it('resolves the stored preference to a daisyUI theme', () => {
    expect(resolveTheme('dark', false)).toBe('medi');
    expect(resolveTheme('dark', true)).toBe('medi');
    expect(resolveTheme('light', false)).toBe('medi-light');
    expect(resolveTheme('light', true)).toBe('medi-light');
    expect(resolveTheme('system', false)).toBe('medi');
    expect(resolveTheme('system', true)).toBe('medi-light');
  });

  it('maps each theme to the browser chrome color', () => {
    expect(describeTheme('medi')).toBe('#17231f');
    expect(describeTheme('medi-light')).toBe('#f6f7f2');
  });

  it('remembers the practice chosen for the next launch', () => {
    const store = stubStorage();
    expect(readDefaultPractice()).toBeNull();
    writeDefaultPractice('soft-white-noise');
    expect(store.get(DEFAULT_PRACTICE_KEY)).toBe('soft-white-noise');
    expect(readDefaultPractice()).toBe('soft-white-noise');
  });

  it('keeps the session working when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => writeDefaultPractice('shamanic-drums')).not.toThrow();
    expect(readDefaultPractice()).toBeNull();
  });
});
