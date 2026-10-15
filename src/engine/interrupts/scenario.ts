/**
 * @file scenario.ts
 * External interrupt event scenarios, validation, and deterministic scheduling queries.
 *
 * DESIGN DECISIONS:
 * 1. An InterruptScenario specifies timed external hardware events (NMI, INTR).
 * 2. Scenario limits:
 *    - Up to 1,000 events
 *    - atTick in range 0..1,000,000
 *    - kind 'intr' requires vector in 0..255
 *    - kind 'nmi' must NOT carry a vector
 * 3. Events at the same tick are ordered strictly by hardware priority (NMI before INTR),
 *    never by array insertion order.
 * 4. canEverWake detects when a halted CPU can never wake up because no future NMI is scheduled
 *    and INTR cannot wake it when IF=0.
 */

import type {
  InterruptEvent,
  InterruptScenario,
  ScenarioValidationResult,
} from './types';

export const MAX_SCENARIO_EVENTS = 1_000;
export const MAX_SCENARIO_TICK = 1_000_000;

/**
 * Validates an InterruptScenario against architectural limits and typing rules.
 *
 * @param scenario The scenario object to validate
 * @returns ScenarioValidationResult with error details if invalid
 */
export function validateScenario(scenario: InterruptScenario): ScenarioValidationResult {
  if (!scenario || !Array.isArray(scenario.events)) {
    return {
      valid: false,
      code: 'too-many-events',
      message: 'Scenario must contain an array of events.',
    };
  }

  if (scenario.events.length > MAX_SCENARIO_EVENTS) {
    return {
      valid: false,
      code: 'too-many-events',
      message: `Scenario exceeds maximum allowed event limit of ${MAX_SCENARIO_EVENTS}. Found: ${scenario.events.length}`,
    };
  }

  for (let i = 0; i < scenario.events.length; i++) {
    const ev = scenario.events[i];
    if (!ev || typeof ev.atTick !== 'number' || !Number.isInteger(ev.atTick)) {
      return {
        valid: false,
        code: 'tick-out-of-range',
        message: `Event at index ${i} has non-integer tick.`,
        eventIndex: i,
      };
    }

    if (ev.atTick < 0 || ev.atTick > MAX_SCENARIO_TICK) {
      return {
        valid: false,
        code: 'tick-out-of-range',
        message: `Event at index ${i} tick ${ev.atTick} out of bounds (0..${MAX_SCENARIO_TICK}).`,
        eventIndex: i,
      };
    }

    if (ev.kind === 'nmi') {
      if (ev.vector !== undefined && ev.vector !== null) {
        return {
          valid: false,
          code: 'nmi-has-vector',
          message: `NMI event at index ${i} must not specify a vector. NMI is fixed to vector 2.`,
          eventIndex: i,
        };
      }
    } else if (ev.kind === 'intr') {
      if (ev.vector === undefined || ev.vector === null) {
        return {
          valid: false,
          code: 'intr-missing-vector',
          message: `INTR event at index ${i} requires an 8-bit vector number supplied by device.`,
          eventIndex: i,
        };
      }
      if (!Number.isInteger(ev.vector) || ev.vector < 0 || ev.vector > 255) {
        return {
          valid: false,
          code: 'intr-invalid-vector',
          message: `INTR event at index ${i} vector ${ev.vector} must be an integer in 0..255.`,
          eventIndex: i,
        };
      }
    } else {
      return {
        valid: false,
        code: 'too-many-events',
        message: `Event at index ${i} has unknown kind '${(ev as { kind: string }).kind}'.`,
        eventIndex: i,
      };
    }
  }

  return { valid: true };
}

/**
 * Returns all events scheduled for execution at a specific CPU tick.
 * Events are deterministically sorted by architectural priority:
 * NMI first, then INTR.
 *
 * @param scenario The scenario containing events
 * @param tick Target CPU tick
 * @returns Array of events due at tick, sorted by priority
 */
export function eventsDueAt(
  scenario: InterruptScenario,
  tick: number
): readonly InterruptEvent[] {
  const matching = scenario.events.filter((ev) => ev.atTick === tick);
  return matching.sort((a, b) => {
    // NMI has higher priority than INTR
    if (a.kind === 'nmi' && b.kind !== 'nmi') return -1;
    if (a.kind !== 'nmi' && b.kind === 'nmi') return 1;
    // For multiple INTRs at the same tick, sort deterministically by vector number
    return (a.vector ?? 0) - (b.vector ?? 0);
  });
}

/**
 * Finds the earliest scheduled event tick strictly greater than currentTick.
 *
 * @param scenario The scenario containing events
 * @param currentTick Current CPU tick
 * @returns Earliest future tick, or null if no future events exist
 */
export function nextEventTick(
  scenario: InterruptScenario,
  currentTick: number
): number | null {
  let minTick: number | null = null;
  for (const ev of scenario.events) {
    if (ev.atTick > currentTick) {
      if (minTick === null || ev.atTick < minTick) {
        minTick = ev.atTick;
      }
    }
  }
  return minTick;
}

/**
 * Evaluates whether a halted CPU can ever be awakened by future scenario events.
 *
 * An NMI wakes the CPU unconditionally.
 * An INTR wakes the CPU if and only if IF=1.
 * While halted, instructions cannot run to change IF; therefore if IF=0, INTR cannot wake it.
 *
 * @param scenario Optional scenario
 * @param currentTick Current tick position
 * @param ifFlag Current Interrupt Flag (IF) value (0 or 1)
 * @returns True if a wake-capable event is scheduled at or after currentTick
 */
export function canEverWake(
  scenario: InterruptScenario | undefined,
  currentTick: number,
  ifFlag: 0 | 1
): boolean {
  if (!scenario || scenario.events.length === 0) return false;

  for (const ev of scenario.events) {
    if (ev.atTick >= currentTick) {
      if (ev.kind === 'nmi') {
        return true; // NMI always wakes halted CPU
      }
      if (ev.kind === 'intr' && ifFlag === 1) {
        return true; // INTR wakes halted CPU when IF is enabled
      }
    }
  }

  return false;
}
