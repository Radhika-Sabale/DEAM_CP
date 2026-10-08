/**
 * @file specs.ts
 * Specification validation and normalization for sequential state machines (Stage 10A).
 * Validates counters (synchronous & asynchronous) and sequence detectors (Mealy & Moore).
 */

import type {
  CounterDirection,
  CounterSpec,
  DetectorSpec,
  FlipFlopType,
} from '../../types/sequential';
import { checkVariableLimit, minStateBits } from './encoding';

/** Validation failure diagnostic naming the field, error code, and plain-language explanation. */
export interface SpecValidationError {
  readonly code:
    | 'bad-kind'
    | 'bad-flip-flop'
    | 'bad-modulus'
    | 'bad-sequence'
    | 'bad-pattern'
    | 'bad-state-bits'
    | 'bad-direction'
    | 'bad-machine'
    | 'too-many-variables'
    | 'async-unsupported';
  readonly field: string;
  readonly message: string;
}

/** Normalized metadata computed from a valid machine specification. */
export interface MachineInfo {
  readonly stateBits: number;
  readonly stateCount: number;
  readonly hasInput: boolean;
  readonly inputKind: 'none' | 'counter-up-down' | 'detector';
}

/** Normalized Counter specification with filled-in stateBits and defaults. */
export interface NormalizedCounterSpec extends CounterSpec {
  readonly kind: 'counter';
  readonly flipFlop: FlipFlopType;
  readonly style: 'sync' | 'async';
  readonly direction: 'up' | 'down' | 'up-down' | 'custom';
  readonly modulus: number;
  readonly sequence?: readonly number[];
  readonly stateBits: number;
  readonly asyncTrigger?: 'rising' | 'falling';
}

/** Normalized Sequence Detector specification with filled-in stateBits and defaults. */
export interface NormalizedDetectorSpec extends DetectorSpec {
  readonly kind: 'detector';
  readonly flipFlop: FlipFlopType;
  readonly pattern: string;
  readonly machine: 'mealy' | 'moore';
  readonly overlapping: boolean;
  readonly stateBits: number;
}

/** Discriminated union of normalized specifications. */
export type NormalizedSequentialSpec = NormalizedCounterSpec | NormalizedDetectorSpec;

/** Discriminated result returned by validateSpec. */
export type SpecValidationResult =
  | {
      readonly ok: true;
      readonly spec: NormalizedSequentialSpec;
      readonly info: MachineInfo;
    }
  | {
      readonly ok: false;
      readonly errors: readonly SpecValidationError[];
    };

const VALID_FLIP_FLOPS: readonly FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

/** Helper checking if an integer is a positive power of 2 (2, 4, 8, 16...). */
function isPowerOfTwo(val: number): boolean {
  return val > 0 && (val & (val - 1)) === 0;
}

/**
 * Validates and normalizes a candidate sequential machine specification.
 * Pure function. Never throws on malformed inputs; returns structured error diagnostics.
 *
 * @param candidate Raw specification object to validate
 * @returns Discriminated result with normalized spec and machine info, or error array
 */
export function validateSpec(candidate: unknown): SpecValidationResult {
  const errors: SpecValidationError[] = [];

  if (typeof candidate !== 'object' || candidate === null) {
    return {
      ok: false,
      errors: [
        {
          code: 'bad-kind',
          field: 'root',
          message: 'Specification must be a non-null object.',
        },
      ],
    };
  }

  const raw = candidate as Record<string, unknown>;
  const kind = raw['kind'];

  if (kind !== 'counter' && kind !== 'detector') {
    return {
      ok: false,
      errors: [
        {
          code: 'bad-kind',
          field: 'kind',
          message: `Field 'kind' must be either 'counter' or 'detector'. Received: "${String(kind)}"`,
        },
      ],
    };
  }

  // Common flip-flop validation
  const flipFlop = (raw['flipFlop'] ?? raw['flipFlopType']) as FlipFlopType | undefined;
  if (!flipFlop || !VALID_FLIP_FLOPS.includes(flipFlop)) {
    errors.push({
      code: 'bad-flip-flop',
      field: 'flipFlop',
      message: `Field 'flipFlop' must be one of: SR, JK, D, T. Received: "${String(flipFlop)}"`,
    });
  }

  if (kind === 'counter') {
    return validateCounterSpec(raw, flipFlop ?? 'JK', errors);
  }

  return validateDetectorSpec(raw, flipFlop ?? 'D', errors);
}

function validateCounterSpec(
  raw: Record<string, unknown>,
  flipFlop: FlipFlopType,
  errors: SpecValidationError[]
): SpecValidationResult {
  const rawStyle = (raw['style'] ?? raw['syncMode']) as string | undefined;
  let style: 'sync' | 'async' = 'sync';
  if (rawStyle === 'async' || rawStyle === 'asynchronous') {
    style = 'async';
  } else if (rawStyle === 'sync' || rawStyle === 'synchronous' || rawStyle === undefined) {
    style = 'sync';
  } else {
    errors.push({
      code: 'bad-kind',
      field: 'style',
      message: `Field 'style' must be 'sync' or 'async'. Received: "${String(rawStyle)}"`,
    });
  }

  const rawDirection = raw['direction'] as CounterDirection | undefined;
  let direction: 'up' | 'down' | 'up-down' | 'custom' = 'up';
  if (rawDirection === 'up' || rawDirection === 'down' || rawDirection === 'up-down' || rawDirection === 'custom') {
    direction = rawDirection;
  } else if (rawDirection === 'arbitrary') {
    direction = 'custom';
  } else {
    errors.push({
      code: 'bad-direction',
      field: 'direction',
      message: `Field 'direction' must be one of: 'up', 'down', 'up-down', 'custom'. Received: "${String(rawDirection)}"`,
    });
  }

  let modulus = typeof raw['modulus'] === 'number' ? raw['modulus'] : 0;
  const sequence = (raw['sequence'] ?? raw['explicitSequence']) as readonly number[] | undefined;

  let stateCount = 0;
  let computedStateBits = 1;

  if (direction === 'custom') {
    if (!Array.isArray(sequence) || sequence.length < 2) {
      errors.push({
        code: 'bad-sequence',
        field: 'sequence',
        message: "Field 'sequence' must be an array of at least 2 distinct integer state codes.",
      });
    } else {
      const nonInt = sequence.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 0);
      if (nonInt) {
        errors.push({
          code: 'bad-sequence',
          field: 'sequence',
          message: "Field 'sequence' must contain only non-negative integers.",
        });
      }
      const uniqueSet = new Set(sequence);
      if (uniqueSet.size !== sequence.length) {
        errors.push({
          code: 'bad-sequence',
          field: 'sequence',
          message: "Field 'sequence' cannot contain duplicate state codes; all states in the custom cycle must be distinct.",
        });
      }
      if (!nonInt && sequence.length > 0) {
        const maxCode = Math.max(...sequence);
        computedStateBits = minStateBits(maxCode + 1);
        stateCount = sequence.length;
        modulus = sequence.length;
      }
    }
  } else {
    // Standard up, down, or up-down counter
    if (typeof modulus !== 'number' || !Number.isInteger(modulus) || modulus < 2 || modulus > 16) {
      errors.push({
        code: 'bad-modulus',
        field: 'modulus',
        message: "Field 'modulus' must be an integer between 2 and 16.",
      });
    } else {
      stateCount = modulus;
      computedStateBits = minStateBits(modulus);
    }
  }

  // Explicit stateBits check if user provided one
  let finalStateBits = computedStateBits;
  if (raw['stateBits'] !== undefined && raw['stateBits'] !== null) {
    const rawBits = raw['stateBits'];
    if (typeof rawBits !== 'number' || !Number.isInteger(rawBits) || rawBits < 1 || rawBits > 4) {
      errors.push({
        code: 'bad-state-bits',
        field: 'stateBits',
        message: "Field 'stateBits' must be an integer between 1 and 4.",
      });
    } else if (rawBits < computedStateBits) {
      errors.push({
        code: 'bad-state-bits',
        field: 'stateBits',
        message: `Field 'stateBits' (${rawBits}) is too small to encode state count or max code requiring ${computedStateBits} bits.`,
      });
    } else {
      finalStateBits = rawBits;
    }
  }

  // Async ripple counter constraints
  if (style === 'async') {
    if (direction === 'up-down' || direction === 'custom') {
      errors.push({
        code: 'async-unsupported',
        field: 'style',
        message: `Asynchronous ripple counters cannot support '${direction}' sequences without complex feedback logic; please use synchronous style instead.`,
      });
    } else if (direction === 'down' && !isPowerOfTwo(modulus)) {
      errors.push({
        code: 'async-unsupported',
        field: 'modulus',
        message: `Asynchronous ripple down-counters require a power-of-2 modulus (2, 4, 8, or 16); please use synchronous style for non-power-of-2 down-counters.`,
      });
    }
  }

  const hasInput = direction === 'up-down';
  const varCheck = checkVariableLimit(finalStateBits, hasInput);
  if (!varCheck.ok) {
    errors.push({
      code: 'too-many-variables',
      field: 'stateBits',
      message: varCheck.message,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const normalized: NormalizedCounterSpec = {
    kind: 'counter',
    flipFlop,
    style,
    direction,
    modulus,
    sequence: direction === 'custom' && sequence ? [...sequence] : undefined,
    stateBits: finalStateBits,
    asyncTrigger: style === 'async' ? ((raw['asyncTrigger'] as 'rising' | 'falling') ?? 'falling') : undefined,
  };

  return {
    ok: true,
    spec: normalized,
    info: {
      stateBits: finalStateBits,
      stateCount,
      hasInput,
      inputKind: hasInput ? 'counter-up-down' : 'none',
    },
  };
}

function validateDetectorSpec(
  raw: Record<string, unknown>,
  flipFlop: FlipFlopType,
  errors: SpecValidationError[]
): SpecValidationResult {
  const pattern = raw['pattern'];
  if (typeof pattern !== 'string' || !/^[01]{2,8}$/.test(pattern)) {
    errors.push({
      code: 'bad-pattern',
      field: 'pattern',
      message: "Field 'pattern' must be a binary string of 2 to 8 bits ('0' and '1').",
    });
  }

  const machine = (raw['machine'] ?? raw['machineKind']) as string | undefined;
  if (machine !== 'mealy' && machine !== 'moore') {
    errors.push({
      code: 'bad-machine',
      field: 'machine',
      message: `Field 'machine' must be either 'mealy' or 'moore'. Received: "${String(machine)}"`,
    });
  }

  const overlapping = typeof raw['overlapping'] === 'boolean' ? raw['overlapping'] : Boolean(raw['allowOverlap']);

  if (errors.length > 0 || typeof pattern !== 'string' || (machine !== 'mealy' && machine !== 'moore')) {
    return { ok: false, errors };
  }

  const patternLength = pattern.length;
  const stateCount = machine === 'mealy' ? patternLength : patternLength + 1;
  const stateBits = minStateBits(stateCount);
  const hasInput = true;

  const varCheck = checkVariableLimit(stateBits, hasInput);
  if (!varCheck.ok) {
    errors.push({
      code: 'too-many-variables',
      field: 'pattern',
      message: varCheck.message,
    });
    return { ok: false, errors };
  }

  const normalized: NormalizedDetectorSpec = {
    kind: 'detector',
    flipFlop,
    pattern,
    machine,
    overlapping,
    stateBits,
  };

  return {
    ok: true,
    spec: normalized,
    info: {
      stateBits,
      stateCount,
      hasInput,
      inputKind: 'detector',
    },
  };
}
