/**
 * @file useKeyboardNav.test.ts
 * Tests for roving tabindex arrow-key navigation and global shortcut safety (Stage 11C).
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isTypingInInput, useGlobalShortcuts, useRovingTabIndex } from './useKeyboardNav';

describe('useKeyboardNav', () => {
  describe('useRovingTabIndex', () => {
    it('navigates with arrow keys and wraps around when enabled', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() =>
        useRovingTabIndex({ itemCount: 4, initialIndex: 0, wrap: true, onSelect })
      );

      expect(result.current.activeIndex).toBe(0);

      // ArrowRight -> index 1
      act(() => {
        result.current.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>);
      });
      expect(result.current.activeIndex).toBe(1);
      expect(onSelect).toHaveBeenCalledWith(1);

      // End -> index 3
      act(() => {
        result.current.onKeyDown({ key: 'End', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>);
      });
      expect(result.current.activeIndex).toBe(3);

      // ArrowRight wraps to 0
      act(() => {
        result.current.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>);
      });
      expect(result.current.activeIndex).toBe(0);

      // ArrowLeft wraps to 3
      act(() => {
        result.current.onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>);
      });
      expect(result.current.activeIndex).toBe(3);

      // Home -> index 0
      act(() => {
        result.current.onKeyDown({ key: 'Home', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>);
      });
      expect(result.current.activeIndex).toBe(0);
    });

    it('assigns tabIndex 0 to active item and -1 to others', () => {
      const { result } = renderHook(() => useRovingTabIndex({ itemCount: 3, initialIndex: 1 }));

      expect(result.current.getItemProps(0).tabIndex).toBe(-1);
      expect(result.current.getItemProps(1).tabIndex).toBe(0);
      expect(result.current.getItemProps(2).tabIndex).toBe(-1);
    });
  });

  describe('useGlobalShortcuts & isTypingInInput', () => {
    it('detects input fields correctly', () => {
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      const div = document.createElement('div');
      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';

      expect(isTypingInInput(input)).toBe(true);
      expect(isTypingInInput(textarea)).toBe(true);
      expect(isTypingInInput(select)).toBe(true);
      expect(isTypingInInput(editableDiv)).toBe(true);
      expect(isTypingInInput(div)).toBe(false);
      expect(isTypingInInput(null)).toBe(false);
    });

    it('executes shortcuts and opens help dialog with ? key', () => {
      const action = vi.fn();
      const onOpenHelp = vi.fn();

      renderHook(() =>
        useGlobalShortcuts([{ key: 'k', description: 'Next step', action }], { onOpenHelp })
      );

      // Normal shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
      expect(action).toHaveBeenCalledTimes(1);

      // Help shortcut ?
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      expect(onOpenHelp).toHaveBeenCalledTimes(1);
    });

    it('ignores shortcuts when target is an input field', () => {
      const action = vi.fn();
      renderHook(() => useGlobalShortcuts([{ key: 'j', description: 'Prev', action }]));

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true });
      input.dispatchEvent(event);

      expect(action).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });
});
