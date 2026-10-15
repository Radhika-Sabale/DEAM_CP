/**
 * @file catalogDataAlu.ts
 * Authoritative taxonomy of student cognitive misconceptions for the
 * Arithmetic Logic Unit (ALU) module (Stage 13B).
 */

import type { MisconceptionCatalogEntry } from './types';

/**
 * Seven domain misconception entries specific to the ALU datapath, flags, and carry chain.
 */
export const ALU_MISCONCEPTION_ENTRIES: readonly MisconceptionCatalogEntry[] = [
  {
    tag: 'wrong-borrow-convention',
    title: 'Reversed Subtraction Borrow/Carry Convention (8086 CF=1 on Borrow)',
    description:
      'The student misinterprets the Carry Flag during subtraction or comparison. In x86/8086 microprocessors, CF = 1 indicates that an unsigned borrow occurred (A < B). Students frequently assume CF = 1 indicates "no borrow" (as in 6502/ARM inverted carry conventions) or fail to realize that subtraction inverts the adder carry-out.',
    affectedModules: ['alu', 'numberSystems', 'cpu8086'],
    example: 'Computing 5 - 7 with 4-bit operands yields borrow; student predicts CF = 0 instead of CF = 1.',
    hints: {
      level1: () => 'In 8086 architecture, the Carry Flag (CF) acts as an active-high borrow indicator during subtraction.',
      level2: () => 'Check whether operand A is strictly less than operand B (unsigned). If A < B, a borrow occurs and CF must be 1.',
      level3: (ctx) => `Since A < B unsigned, a borrow is required, setting the Carry Flag: ${ctx.expected}.`,
    },
  },
  {
    tag: 'forgot-invert-b-in-subtract',
    title: 'Omitted Operand Inversion in Two\'s Complement Subtraction',
    description:
      'The student attempts subtraction (A - B) by computing A + B or A + B + 1 directly, omitting the bitwise inversion (~B) step required by two\'s complement hardware. An adder performs subtraction as A + ~B + 1.',
    affectedModules: ['alu'],
    example: 'Computing 7 - 3 = 4; student calculates 7 + 3 = 10 (binary 1010) instead of 7 + (~3) + 1.',
    hints: {
      level1: () => 'Binary subtraction in hardware is performed by adding the two\'s complement of the subtrahend: A + NOT(B) + 1.',
      level2: () => 'Make sure you invert all bits of operand B before feeding it into the adder with carry-in set to 1.',
      level3: (ctx) => `Inverting B and adding 1 produces the correct subtraction result: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-shift-carry-out',
    title: 'Incorrect Bit Shifted into Carry Flag',
    description:
      'The student misidentifies which bit is shifted into the Carry Flag during a shift or rotate operation. For SHL/ROL, the bit pushed out from the MSB enters CF; for SHR/SAR/ROR, the bit pushed out from the LSB enters CF.',
    affectedModules: ['alu', 'cpu8086'],
    example: 'Executing SHR 1100_2 by 1; student sets CF = 1 (copying the MSB) instead of CF = 0 (the bit shifted out of bit 0).',
    hints: {
      level1: () => 'The Carry Flag receives the last bit shifted completely out of the operand register.',
      level2: () => 'For left shifts/rotates, CF receives the former MSB; for right shifts/rotates, CF receives the former LSB.',
      level3: (ctx) => `The bit shifted out of the boundary into CF is: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-sign-flag',
    title: 'Incorrect Sign Flag Evaluation',
    description:
      'The student misdetermines the Sign Flag (SF) of the ALU result. In two\'s complement representation, SF must strictly mirror the Most Significant Bit (MSB) of the truncated result width, regardless of whether unsigned interpretation was intended.',
    affectedModules: ['alu', 'cpu8086'],
    example: 'Computing 7 + 2 = 9 (1001_2 in 4-bit); student reports SF = 0 because inputs were positive, ignoring that MSB is 1.',
    hints: {
      level1: () => 'The Sign Flag (SF) is always equal to the Most Significant Bit (MSB) of the result.',
      level2: () => 'Inspect the leftmost bit of your result; if MSB is 1, SF is 1, and if MSB is 0, SF is 0.',
      level3: (ctx) => `The MSB of the result determines the Sign Flag: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-zero-flag',
    title: 'Incorrect Zero Flag Evaluation',
    description:
      'The student sets ZF = 1 when the ALU output is non-zero, or leaves ZF = 0 when the output bits are all zero. The Zero Flag asserts if and only if all bits of the result slice are 0.',
    affectedModules: ['alu', 'cpu8086'],
    example: 'Computing 5 - 5 = 0; student reports ZF = 0 believing "no error" means 0.',
    hints: {
      level1: () => 'The Zero Flag (ZF) indicates whether the entire result slice equals zero.',
      level2: () => 'Check if all bits in the output are zero: if result == 0, ZF = 1, otherwise ZF = 0.',
      level3: (ctx) => `Since the output is ${ctx.expected === '1' ? 'zero' : 'nonzero'}, the Zero Flag must be: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-cmp-relation',
    title: 'Mismatched Compare Condition Flags (Signed vs Unsigned)',
    description:
      'The student misinterprets condition codes following a CMP operation or in conditional jumps (Jcc), confusing unsigned conditions (based on CF and ZF) with signed conditions (based on SF, OF, and ZF). For example, evaluating signed JL using unsigned CF instead of checking whether SF != OF, or evaluating unsigned JA using signed flags.',
    affectedModules: ['alu', 'cpu8086'],
    example: 'Comparing signed numbers 7 and -2 using unsigned CF, concluding 7 < -2 because 7 - 0xFE generated a borrow.',
    hints: {
      level1: () => 'Unsigned comparisons evaluate CF and ZF; signed comparisons evaluate whether SF matches OF.',
      level2: () => 'For signed less-than (JL/LSS), test SF != OF; for unsigned below (JB/LO), test CF == 1.',
      level3: (ctx) => `Evaluating the correct relational flag condition gives: ${ctx.expected}.`,
    },
  },
  {
    tag: 'inc-dec-changes-carry',
    title: 'Assumed INC/DEC Modifies the Carry Flag',
    description:
      'The student assumes INC or DEC modifies the Carry Flag (CF). In x86/8086 architectures, INC and DEC update ZF, SF, OF, AF, and PF, but deliberately preserve the existing CF to allow loop index updates without corrupting multi-precision arithmetic carry chains.',
    affectedModules: ['alu', 'cpu8086'],
    example: 'Executing INC 0xFF (8-bit); student sets CF = 1 due to wraparound to 0x00, but CF is actually preserved.',
    hints: {
      level1: () => 'In 8086 architecture, the INC and DEC instructions do NOT modify the Carry Flag.',
      level2: () => 'INC and DEC affect ZF, SF, and OF, but preserve the previous state of CF untouched.',
      level3: (ctx) => `Because INC/DEC preserves CF, the Carry Flag remains: ${ctx.expected}.`,
    },
  },
];
