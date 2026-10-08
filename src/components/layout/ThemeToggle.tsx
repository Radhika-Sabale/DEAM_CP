/**
 * @file ThemeToggle.tsx
 * Accessible interactive theme switch cycling through light, dark, and system modes,
 * clearly announcing current selection to assistive technologies.
 */

import type { FC } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { MonitorIcon, MoonIcon, SunIcon } from '../ui/Icons';

export const ThemeToggle: FC = () => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = (): void => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getLabel = (): string => {
    switch (theme) {
      case 'light':
        return 'Theme: Light. Click to switch to Dark theme';
      case 'dark':
        return 'Theme: Dark. Click to switch to System theme';
      case 'system':
        return 'Theme: System preference. Click to switch to Light theme';
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={getLabel()}
      title={getLabel()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {theme === 'light' && <SunIcon className="h-4 w-4 text-amber-500" />}
      {theme === 'dark' && <MoonIcon className="h-4 w-4 text-blue-400" />}
      {theme === 'system' && <MonitorIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
      <span className="capitalize">{theme}</span>
    </button>
  );
};
