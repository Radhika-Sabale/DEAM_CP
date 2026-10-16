/**
 * @file Tabs.tsx
 * Accessible tabs primitive implementing WAI-ARIA tablist design pattern
 * with roving tabindex, arrow key navigation, and Home/End support.
 */

import {
  type FC,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs: FC<TabsProps> = ({
  tabs,
  value,
  defaultValue,
  onChange,
  className = '',
}) => {
  const baseId = useId();
  const [internalValue, setInternalValue] = useState<string>(() => {
    return value ?? defaultValue ?? tabs[0]?.id ?? '';
  });

  const activeTabId = value !== undefined ? value : internalValue;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleSelectTab = (tabId: string): void => {
    if (value === undefined) {
      setInternalValue(tabId);
    }
    onChange?.(tabId);
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ): void => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const enabledIndex = enabledTabs.findIndex((t) => t.id === tabs[currentIndex]?.id);

    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (enabledIndex + 1) % enabledTabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (enabledIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = enabledTabs[nextIndex];
    if (nextTab) {
      handleSelectTab(nextTab.id);
      const buttonEl = tabRefs.current.get(nextTab.id);
      buttonEl?.focus();
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className={`w-full min-w-0 max-w-full ${className}`}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex max-w-full space-x-1 overflow-x-auto rounded-full border border-gray-200 bg-white/70 p-1 dark:border-gray-800 dark:bg-gray-900/70"
      >
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === activeTabId;
          const tabElementId = `${baseId}-tab-${tab.id}`;
          const panelElementId = `${baseId}-panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              id={tabElementId}
              role="tab"
              type="button"
              disabled={tab.disabled}
              aria-selected={isSelected}
              aria-controls={panelElementId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelectTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab && (
        <div
          id={`${baseId}-panel-${activeTab.id}`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          className="py-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
};
