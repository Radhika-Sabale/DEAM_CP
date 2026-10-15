/**
 * @file flagsWord.ts
 * Serialization and deserialization of 8086 FLAGS register to/from 16-bit words.
 *
 * DESIGN DECISIONS:
 * 1. Real 8086 bit layout:
 *    - Bit 0: CF (Carry Flag)
 *    - Bit 1: Fixed 1 (always set on real 8086 hardware)
 *    - Bit 6: ZF (Zero Flag)
 *    - Bit 7: SF (Sign Flag)
 *    - Bit 8: TF (Trap / Single-Step Flag)
 *    - Bit 9: IF (Interrupt Enable Flag)
 *    - Bit 11: OF (Overflow Flag)
 * 2. Unmodeled bits (PF bit 2, AF bit 4, DF bit 10, bits 3, 5, 12..15) read as 0
 *    and are ignored when deserializing from an arbitrary 16-bit word.
 * 3. 'undefined' OF flag is encoded as 0 in the packed word.
 */

/** Canonical 8086 bit index mappings for modeled flags */
export const FLAGS_BIT_POSITIONS = {
  CF: 0,
  ALWAYS_ONE: 1,
  ZF: 6,
  SF: 7,
  TF: 8,
  IF: 9,
  OF: 11,
} as const;

export const FLAGS_BIT_MASKS = {
  CF: 1 << FLAGS_BIT_POSITIONS.CF,
  ALWAYS_ONE: 1 << FLAGS_BIT_POSITIONS.ALWAYS_ONE,
  ZF: 1 << FLAGS_BIT_POSITIONS.ZF,
  SF: 1 << FLAGS_BIT_POSITIONS.SF,
  TF: 1 << FLAGS_BIT_POSITIONS.TF,
  IF: 1 << FLAGS_BIT_POSITIONS.IF,
  OF: 1 << FLAGS_BIT_POSITIONS.OF,
} as const;

export interface ModeledFlags {
  readonly Z: 0 | 1;
  readonly C: 0 | 1;
  readonly S: 0 | 1;
  readonly O: 0 | 1 | 'undefined';
  readonly I: 0 | 1;
  readonly T: 0 | 1;
}

/**
 * Encodes modeled status and control flags into the canonical 8086 16-bit FLAGS register word.
 * Bit 1 is unconditionally asserted (1), as on actual physical silicon.
 *
 * @param flags The modeled 8086 flags
 * @returns 16-bit unsigned integer representing the FLAGS word
 */
export function flagsToWord(flags: ModeledFlags): number {
  let word = FLAGS_BIT_MASKS.ALWAYS_ONE; // Bit 1 is fixed to 1

  if (flags.C === 1) word |= FLAGS_BIT_MASKS.CF;
  if (flags.Z === 1) word |= FLAGS_BIT_MASKS.ZF;
  if (flags.S === 1) word |= FLAGS_BIT_MASKS.SF;
  if (flags.T === 1) word |= FLAGS_BIT_MASKS.TF;
  if (flags.I === 1) word |= FLAGS_BIT_MASKS.IF;
  if (flags.O === 1) word |= FLAGS_BIT_MASKS.OF;

  return word & 0xffff;
}

/**
 * Decodes a 16-bit FLAGS word into discrete modeled 8086 flags.
 * Unmodeled bits (e.g. PF, AF, DF, reserved bits) are ignored.
 *
 * @param word 16-bit unsigned FLAGS register value
 * @returns Decoded ModeledFlags object
 */
export function wordToFlags(word: number): ModeledFlags {
  return {
    C: (word & FLAGS_BIT_MASKS.CF) !== 0 ? 1 : 0,
    Z: (word & FLAGS_BIT_MASKS.ZF) !== 0 ? 1 : 0,
    S: (word & FLAGS_BIT_MASKS.SF) !== 0 ? 1 : 0,
    T: (word & FLAGS_BIT_MASKS.TF) !== 0 ? 1 : 0,
    I: (word & FLAGS_BIT_MASKS.IF) !== 0 ? 1 : 0,
    O: (word & FLAGS_BIT_MASKS.OF) !== 0 ? 1 : 0,
  };
}
