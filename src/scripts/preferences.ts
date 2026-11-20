export const DEFAULT_PRACTICE_KEY = 'medi:default-practice';
export const THEME_KEY = 'medi:theme';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'medi' | 'medi-light';

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

export function resolveTheme(preference: ThemePreference, prefersLight: boolean): ResolvedTheme {
  if (preference === 'light') return 'medi-light';
  if (preference === 'system' && prefersLight) return 'medi-light';
  return 'medi';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); preferences then live for the session only.
  }
}

export function readDefaultPractice(): string | null {
  return read(DEFAULT_PRACTICE_KEY);
}

/**
 * Remembers the practice the user actually listens to, so the next launch
 * starts with it; the Settings radios read the same value.
 */
export function writeDefaultPractice(id: string): void {
  write(DEFAULT_PRACTICE_KEY, id);
}

export function readThemePreference(): ThemePreference {
  const stored = read(THEME_KEY);
  return isThemePreference(stored) ? stored : 'dark';
}

export function describeTheme(theme: ResolvedTheme): string {
  return theme === 'medi-light' ? '#f6f7f2' : '#17231f';
}

/**
 * Applies the stored theme and keeps the Settings radios in sync. It is the
 * only owner of theme persistence; the player never touches it.
 */
export function initPreferences(): void {
  const themeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-theme-preference]'));
  const defaultInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-player-default-practice]'));
  const media = window.matchMedia('(prefers-color-scheme: light)');
  let preference = readThemePreference();

  const apply = (): void => {
    const theme = resolveTheme(preference, media.matches);
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = describeTheme(theme);
    for (const input of themeInputs) input.checked = input.value === preference;
  };

  apply();

  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (!input.checked || !isThemePreference(input.value)) return;
      preference = input.value;
      write(THEME_KEY, preference);
      apply();
    });
  }

  media.addEventListener('change', () => {
    if (preference === 'system') apply();
  });

  const storedDefault = readDefaultPractice();
  if (storedDefault) {
    for (const input of defaultInputs) input.checked = input.value === storedDefault;
  }
  for (const input of defaultInputs) {
    input.addEventListener('change', () => {
      if (input.checked) write(DEFAULT_PRACTICE_KEY, input.value);
    });
  }
}
