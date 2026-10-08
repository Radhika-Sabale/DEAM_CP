/**
 * @file eventQueue.test.ts
 * Property and unit tests for discrete-event binary min-heap priority queue.
 */

import { describe, expect, it } from 'vitest';
import { createPrng, prngInt } from '../common/seededRandom';
import { EventQueue } from './eventQueue';

describe('EventQueue', () => {
  it('rejects invalid timestamps (negative, floats, NaN, Infinity)', () => {
    const q = new EventQueue<string>();

    expect(q.push(-1, 'event')).toBe(false);
    expect(q.push(1.5, 'event')).toBe(false);
    expect(q.push(NaN, 'event')).toBe(false);
    expect(q.push(Infinity, 'event')).toBe(false);
    expect(q.push(-Infinity, 'event')).toBe(false);
    expect(q.size()).toBe(0);
  });

  it('guarantees strict FIFO ordering on events with equal timestamps', () => {
    const q = new EventQueue<string>();

    q.push(10, 'first');
    q.push(10, 'second');
    q.push(10, 'third');
    q.push(10, 'fourth');

    expect(q.pop()).toEqual({ time: 10, payload: 'first' });
    expect(q.pop()).toEqual({ time: 10, payload: 'second' });
    expect(q.pop()).toEqual({ time: 10, payload: 'third' });
    expect(q.pop()).toEqual({ time: 10, payload: 'fourth' });
    expect(q.pop()).toBeUndefined();
  });

  it('supports peek, peekTime, size, isEmpty, and clear', () => {
    const q = new EventQueue<number>();
    expect(q.isEmpty()).toBe(true);
    expect(q.peek()).toBeUndefined();
    expect(q.peekTime()).toBeUndefined();

    q.push(5, 100);
    q.push(2, 200);

    expect(q.size()).toBe(2);
    expect(q.isEmpty()).toBe(false);
    expect(q.peekTime()).toBe(2);
    expect(q.peek()).toEqual({ time: 2, payload: 200 });

    q.clear();
    expect(q.size()).toBe(0);
    expect(q.isEmpty()).toBe(true);
    expect(q.pop()).toBeUndefined();
  });

  it('pops elements matching popWhile predicate', () => {
    const q = new EventQueue<string>();
    q.push(0, 'A');
    q.push(0, 'B');
    q.push(5, 'C');
    q.push(10, 'D');

    const atZero = q.popWhile((time) => time === 0);
    expect(atZero).toEqual([
      { time: 0, payload: 'A' },
      { time: 0, payload: 'B' },
    ]);
    expect(q.size()).toBe(2);
    expect(q.peekTime()).toBe(5);
  });

  it('Property test: 10,000 randomized events pop in identical order to stable sort', () => {
    const rng = createPrng(424242);
    const q = new EventQueue<number>();

    interface ExpectedItem {
      readonly time: number;
      readonly insertionIndex: number;
      readonly value: number;
    }

    const items: ExpectedItem[] = [];
    const count = 10000;

    for (let i = 0; i < count; i++) {
      const time = prngInt(rng, 0, 500);
      const value = prngInt(rng, 1, 1000000);
      items.push({ time, insertionIndex: i, value });
      q.push(time, value);
    }

    // Stable reference sort: primary = time, secondary = insertionIndex
    const sorted = [...items].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.insertionIndex - b.insertionIndex;
    });

    for (let i = 0; i < count; i++) {
      const popped = q.pop();
      const expected = sorted[i];
      if (!expected || !popped) {
        throw new Error(`Unexpected undefined at index ${i}`);
      }
      expect(popped.time).toBe(expected.time);
      expect(popped.payload).toBe(expected.value);
    }

    expect(q.isEmpty()).toBe(true);
  });
});
