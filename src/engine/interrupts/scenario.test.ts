import { describe, it, expect } from 'vitest';
import {
  validateScenario,
  eventsDueAt,
  nextEventTick,
  canEverWake,
  MAX_SCENARIO_EVENTS,
  MAX_SCENARIO_TICK,
} from './scenario';
import type { InterruptScenario } from './types';

describe('InterruptScenario validation and scheduling', () => {
  it('validates correct scenarios', () => {
    const scenario: InterruptScenario = {
      events: [
        { atTick: 0, kind: 'nmi' },
        { atTick: 10, kind: 'intr', vector: 32 },
        { atTick: 50, kind: 'nmi' },
        { atTick: 100, kind: 'intr', vector: 255 },
      ],
    };
    const res = validateScenario(scenario);
    expect(res.valid).toBe(true);
  });

  it('rejects scenario with more than 1,000 events', () => {
    const events = [];
    for (let i = 0; i <= MAX_SCENARIO_EVENTS; i++) {
      events.push({ atTick: i, kind: 'nmi' as const });
    }
    const res = validateScenario({ events });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.code).toBe('too-many-events');
    }
  });

  it('rejects events with tick out of range or non-integer', () => {
    expect(
      validateScenario({
        events: [{ atTick: -1, kind: 'nmi' }],
      })
    ).toEqual({
      valid: false,
      code: 'tick-out-of-range',
      message: 'Event at index 0 tick -1 out of bounds (0..1000000).',
      eventIndex: 0,
    });

    expect(
      validateScenario({
        events: [{ atTick: MAX_SCENARIO_TICK + 1, kind: 'nmi' }],
      })
    ).toEqual({
      valid: false,
      code: 'tick-out-of-range',
      message: `Event at index 0 tick 1000001 out of bounds (0..${MAX_SCENARIO_TICK}).`,
      eventIndex: 0,
    });

    expect(
      validateScenario({
        events: [{ atTick: 2.5, kind: 'nmi' }],
      })
    ).toEqual({
      valid: false,
      code: 'tick-out-of-range',
      message: 'Event at index 0 has non-integer tick.',
      eventIndex: 0,
    });
  });

  it('rejects NMI event carrying a vector', () => {
    const res = validateScenario({
      events: [{ atTick: 5, kind: 'nmi', vector: 2 }],
    });
    expect(res).toEqual({
      valid: false,
      code: 'nmi-has-vector',
      message: 'NMI event at index 0 must not specify a vector. NMI is fixed to vector 2.',
      eventIndex: 0,
    });
  });

  it('rejects INTR event missing a vector', () => {
    const res = validateScenario({
      events: [{ atTick: 5, kind: 'intr' }],
    });
    expect(res).toEqual({
      valid: false,
      code: 'intr-missing-vector',
      message: 'INTR event at index 0 requires an 8-bit vector number supplied by device.',
      eventIndex: 0,
    });
  });

  it('rejects INTR event with invalid vector', () => {
    const resNegative = validateScenario({
      events: [{ atTick: 5, kind: 'intr', vector: -1 }],
    });
    expect(resNegative.valid).toBe(false);
    if (!resNegative.valid) {
      expect(resNegative.code).toBe('intr-invalid-vector');
    }

    const resTooLarge = validateScenario({
      events: [{ atTick: 5, kind: 'intr', vector: 256 }],
    });
    expect(resTooLarge.valid).toBe(false);
    if (!resTooLarge.valid) {
      expect(resTooLarge.code).toBe('intr-invalid-vector');
    }
  });

  it('orders events due at the same tick deterministically (NMI before INTR, then vector)', () => {
    const scenario: InterruptScenario = {
      events: [
        { atTick: 10, kind: 'intr', vector: 40 },
        { atTick: 10, kind: 'nmi' },
        { atTick: 10, kind: 'intr', vector: 20 },
      ],
    };

    const due = eventsDueAt(scenario, 10);
    expect(due.length).toBe(3);
    expect(due[0]).toEqual({ atTick: 10, kind: 'nmi' });
    expect(due[1]).toEqual({ atTick: 10, kind: 'intr', vector: 20 });
    expect(due[2]).toEqual({ atTick: 10, kind: 'intr', vector: 40 });
  });

  it('finds nextEventTick correctly', () => {
    const scenario: InterruptScenario = {
      events: [
        { atTick: 10, kind: 'nmi' },
        { atTick: 25, kind: 'intr', vector: 30 },
        { atTick: 50, kind: 'nmi' },
      ],
    };

    expect(nextEventTick(scenario, 0)).toBe(10);
    expect(nextEventTick(scenario, 10)).toBe(25);
    expect(nextEventTick(scenario, 30)).toBe(50);
    expect(nextEventTick(scenario, 50)).toBeNull();
  });

  it('correctly determines canEverWake based on IF and event kinds', () => {
    expect(canEverWake(undefined, 0, 1)).toBe(false);
    expect(canEverWake({ events: [] }, 0, 1)).toBe(false);

    // Only past events
    const pastScenario: InterruptScenario = {
      events: [{ atTick: 5, kind: 'nmi' }],
    };
    expect(canEverWake(pastScenario, 10, 1)).toBe(false);

    // Future NMI wakes regardless of IF
    const nmiScenario: InterruptScenario = {
      events: [{ atTick: 15, kind: 'nmi' }],
    };
    expect(canEverWake(nmiScenario, 10, 0)).toBe(true);
    expect(canEverWake(nmiScenario, 10, 1)).toBe(true);

    // Future INTR only wakes if IF = 1
    const intrScenario: InterruptScenario = {
      events: [{ atTick: 15, kind: 'intr', vector: 32 }],
    };
    expect(canEverWake(intrScenario, 10, 0)).toBe(false);
    expect(canEverWake(intrScenario, 10, 1)).toBe(true);
  });
});
