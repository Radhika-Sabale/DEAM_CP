/**
 * @file useTheme.ts
 * Hook for managing application light/dark theme, synchronizing with the OS preference,
 * and applying the active theme to document.documentElement.
 */

import { useEffect, useState } from 'react';
import { selectTheme, useUiStore } from '../store/uiStore';

/**
 * Resolved concrete theme representation.
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Determines whether the operating system currently prefers dark mode.
 */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Applies the theme data attribute and the legacy utility class to <html>.
 */
function applyThemeClass(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = isDark ? 'dark' : 'light';
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Custom hook to subscribe to and control application theme.
 *
 * Anti-flash strategy:
 * Reads preference synchronously from localStorage during module evaluation,
 * and immediately binds matchMedia change listeners to reflect OS changes in real-time.
 */
export function useTheme(): {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
} {
  const theme = useUiStore(selectTheme);
  const setTheme = useUiStore((state) => state.setTheme);

  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      setSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const resolvedTheme: ResolvedTheme = isDark ? 'dark' : 'light';

  useEffect(() => {
    applyThemeClass(isDark);
  }, [isDark]);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
