/**
 * @file ThemeToggle.tsx
 * Accessible interactive theme switch cycling through light, dark, and system modes,
 * clearly announcing current selection to assistive technologies.
 */

import type { FC } from 'react';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle: FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = (): void => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const currentLabel = resolvedTheme === 'dark' ? 'Dark theme' : 'Light theme';
  const nextLabel = resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Switch to ${nextLabel.toLowerCase()}`}
      title={`Switch to ${nextLabel.toLowerCase()}`}
      className="theme-toggle inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <span>{currentLabel}</span>
    </button>
  );
};
