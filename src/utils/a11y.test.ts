/**
 * @file a11y.test.ts
 * Tests for live announcements, unique IDs, and score labels (Stage 11C).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce, formatScoreAriaLabel, resetA11yForTesting, uniqueId } from './a11y';

describe('a11y utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetA11yForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetA11yForTesting();
  });

  it('generates unique deterministic-prefix IDs', () => {
    const id1 = uniqueId('question');
    const id2 = uniqueId('question');
    expect(id1).toContain('question-1-');
    expect(id2).toContain('question-2-');
    expect(id1).not.toBe(id2);
  });

  it('formats accessible score labels accurately', () => {
    const label1 = formatScoreAriaLabel(8, 10);
    expect(label1).toBe('Score 8 out of 10 (80 percent)');

    const label2 = formatScoreAriaLabel(17, 20, 'Post-Test');
    expect(label2).toBe('Post-Test: Score 17 out of 20 (85 percent)');
  });

  it('announces messages via shared visually-hidden live region', () => {
    announce('Step submitted correctly', 'polite');
    vi.advanceTimersByTime(100);

    const liveEl = document.getElementById('delab-live-announcer-polite');
    expect(liveEl).not.toBeNull();
    expect(liveEl?.getAttribute('aria-live')).toBe('polite');
    expect(liveEl?.textContent).toBe('Step submitted correctly');

    // Visually hidden styles check
    expect(liveEl?.style.position).toBe('absolute');
    expect(liveEl?.style.width).toBe('1px');
  });

  it('creates assertive announcer when assertive politeness requested', () => {
    announce('Critical error occurred', 'assertive');
    vi.advanceTimersByTime(100);

    const assertiveEl = document.getElementById('delab-live-announcer-assertive');
    expect(assertiveEl).not.toBeNull();
    expect(assertiveEl?.getAttribute('aria-live')).toBe('assertive');
    expect(assertiveEl?.textContent).toBe('Critical error occurred');
  });
});
