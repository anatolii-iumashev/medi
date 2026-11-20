import { describe, expect, it } from 'vitest';
import { describeTheme, isThemePreference, resolveTheme } from '../src/scripts/preferences';

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
});
