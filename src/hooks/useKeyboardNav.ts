/**
 * @file useKeyboardNav.ts
 * Reusable roving-tabindex navigation and accessible global keyboard shortcuts (Stage 11C).
 * Guarantees that shortcuts never trigger while typing in form inputs.
 */

import { type KeyboardEvent, useCallback, useEffect, useState } from 'react';

/**
 * Options for roving-tabindex keyboard navigation.
 */
export interface RovingTabOptions {
  readonly itemCount: number;
  readonly initialIndex?: number;
  readonly wrap?: boolean;
  readonly orientation?: 'horizontal' | 'vertical' | 'both';
  readonly onSelect?: (index: number) => void;
}

/**
 * Hook providing roving-tabindex arrow navigation across lists, radio groups, and question bars.
 */
export function useRovingTabIndex({
  itemCount,
  initialIndex = 0,
  wrap = true,
  orientation = 'both',
  onSelect,
}: RovingTabOptions) {
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (itemCount <= 0) return;

      let nextIndex = activeIndex;
      let handled = false;

      const isPrev =
        (orientation !== 'vertical' && e.key === 'ArrowLeft') ||
        (orientation !== 'horizontal' && e.key === 'ArrowUp');
      const isNext =
        (orientation !== 'vertical' && e.key === 'ArrowRight') ||
        (orientation !== 'horizontal' && e.key === 'ArrowDown');

      if (isPrev) {
        handled = true;
        nextIndex = activeIndex - 1;
        if (nextIndex < 0) {
          nextIndex = wrap ? itemCount - 1 : 0;
        }
      } else if (isNext) {
        handled = true;
        nextIndex = activeIndex + 1;
        if (nextIndex >= itemCount) {
          nextIndex = wrap ? 0 : itemCount - 1;
        }
      } else if (e.key === 'Home') {
        handled = true;
        nextIndex = 0;
      } else if (e.key === 'End') {
        handled = true;
        nextIndex = itemCount - 1;
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (onSelect) {
          e.preventDefault();
          onSelect(activeIndex);
        }
        return;
      }

      if (handled) {
        e.preventDefault();
        setActiveIndex(nextIndex);
        if (onSelect) {
          onSelect(nextIndex);
        }
      }
    },
    [activeIndex, itemCount, onSelect, orientation, wrap]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: handleKeyDown,
      onClick: () => {
        setActiveIndex(index);
        if (onSelect) onSelect(index);
      },
    }),
    [activeIndex, handleKeyDown, onSelect]
  );

  return {
    activeIndex,
    setActiveIndex,
    getItemProps,
    onKeyDown: handleKeyDown,
  };
}

/**
 * Single shortcut definition.
 */
export interface ShortcutDefinition {
  readonly key: string;
  readonly description: string;
  readonly action: () => void;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
}

/**
 * Checks whether an element is an interactive text input where shortcuts must be ignored.
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (
    target.isContentEditable ||
    target.contentEditable === 'true' ||
    target.getAttribute('contenteditable') === 'true'
  ) {
    return true;
  }
  return false;
}

/**
 * Registers global keyboard shortcuts with built-in "?" help dialog handler.
 */
export function useGlobalShortcuts(
  shortcuts: readonly ShortcutDefinition[],
  options: { readonly enabled?: boolean; readonly onOpenHelp?: () => void } = {}
) {
  const enabled = options.enabled !== false;
  const onOpenHelp = options.onOpenHelp;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      // Never trigger shortcuts while student is typing
      if (isTypingInInput(e.target)) return;

      // Handle "?" shortcut for help dialog
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (onOpenHelp) {
          e.preventDefault();
          onOpenHelp();
          return;
        }
      }

      for (const sc of shortcuts) {
        const matchesKey = e.key.toLowerCase() === sc.key.toLowerCase();
        const matchesAlt = Boolean(sc.altKey) === Boolean(e.altKey);
        const matchesCtrl = Boolean(sc.ctrlKey) === (Boolean(e.ctrlKey) || Boolean(e.metaKey));
        const matchesShift = Boolean(sc.shiftKey) === Boolean(e.shiftKey);

        if (matchesKey && matchesAlt && matchesCtrl && matchesShift) {
          e.preventDefault();
          sc.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [enabled, onOpenHelp, shortcuts]);
}
