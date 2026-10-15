/**
 * @file catalogDataCore2.ts
 * Core misconception catalog entries for Number Systems, Boolean, and General domains.
 */

import type { MisconceptionCatalogEntry } from './types';

export const CORE_MISCONCEPTION_ENTRIES_2: readonly MisconceptionCatalogEntry[] = [
  {
    tag: 'wrong-complement',
    title: 'Flawed Two\'s or Radix Complement Calculation',
    description:
      'The student inverts the bits for two\'s complement but forgets to add 1 to the least significant bit. Alternatively, they confuse 1\'s complement with 2\'s complement or apply diminishing radix complement rules incorrectly. This causes an off-by-one error in signed arithmetic representations.',
    affectedModules: ['numberSystems', 'alu'],
    example: 'Computing 2\'s complement of 0101 as 1010 instead of 1011 (forgot to add 1).',
    hints: {
      level1: () => 'Remember the definition of two\'s complement: invert all bits, then add 1 to the LSB.',
      level2: () => 'Check whether you completed the addition of 1 after performing bitwise inversion.',
      level3: (ctx) => `Inverting the bits and adding 1 produces the correct complement: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-radix-weight',
    title: 'Incorrect Positional Radix Weight or Exponent',
    description:
      'The student misassigns positional weights, such as numbering integer bit positions from 1 instead of 0 or indexing fractional bits with positive powers. They fail to understand that position i has weight r^i where i = 0 at the radix point. This scales numbers by powers of the radix.',
    affectedModules: ['numberSystems'],
    example: 'Computing 101_2 as 1*2^3 + 0*2^2 + 1*2^1 = 10 instead of 1*2^2 + 0*2^1 + 1*2^0 = 5.',
    hints: {
      level1: () => 'Positional weights start at radix^0 immediately to the left of the radix point.',
      level2: () => 'Verify the exponent indices assigned to each column, starting at 0 for the least significant integer digit.',
      level3: (ctx) => `Evaluating each digit with proper radix weights yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'demorgan-misapplied',
    title: 'De Morgan\'s Law Misapplied (Operator or Bar)',
    description:
      'The student splits a complement bar across terms but forgets to interchange AND with OR (or vice versa). Alternatively, they partially complement terms while leaving the operator unchanged, breaking algebraic equivalence. De Morgan\'s theorem requires both complementing individual terms and dualizing the binary operator.',
    affectedModules: ['boolean'],
    example: 'Rewriting (A + B)\' as A\' + B\' instead of A\' * B\'.',
    hints: {
      level1: () => 'De Morgan\'s law requires two simultaneous changes: break the complement bar AND flip the operator.',
      level2: () => 'Check your operator; an OR (+) under a negation must become an AND (*), and vice versa.',
      level3: (ctx) => `Applying De Morgan's theorem correctly transforms the expression to: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-carry-propagation',
    title: 'Dropped or Erroneous Addition Carry Bit',
    description:
      'The student forgets to propagate carry-out bits to the next higher significance column during binary addition. They treat each bit position as an isolated half-adder or misplace the carry in subsequent operations. This corrupts all higher-order bits of the sum.',
    affectedModules: ['numberSystems', 'alu'],
    example: 'Computing 1 + 1 = 0 but failing to carry 1 to the next column, leaving sum 0 instead of 10.',
    hints: {
      level1: () => 'When the sum in a binary bit column equals 2 or 3, a carry bit must propagate to the next column.',
      level2: () => 'Examine the carry generated from the previous column and ensure it is included in this bit\'s sum.',
      level3: (ctx) => `Including the carry bit produces the correct column sum and carry: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-bit-order',
    title: 'Reversed Bit Order (MSB vs LSB)',
    description:
      'The student reverses the significance order of binary digits, writing the Most Significant Bit where the Least Significant Bit belongs. This commonly occurs when grouping bits for octal/hex conversion or assembling division remainders. Reversing bit order distorts the numeric value completely.',
    affectedModules: ['numberSystems'],
    example: 'Writing binary 1100 as 0011, confusing MSB and LSB.',
    hints: {
      level1: () => 'Check the direction of significance: the Most Significant Bit (MSB) must remain on the far left.',
      level2: () => 'Ensure bit grouping and assembly proceeds in the proper order from least to most significant.',
      level3: (ctx) => `Arranging the bits in correct left-to-right order yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-remainder-order',
    title: 'Reversed Division Remainder Order',
    description:
      'The student reads successive division remainders from top to bottom instead of bottom to top. The first remainder produced by repeated division corresponds to the least significant digit (r^0), not the most significant. Writing remainders top-to-bottom inverts the radix representation.',
    affectedModules: ['numberSystems'],
    example: 'Dividing 13 by 2 yields remainders 1, 0, 1, 1; student writes 1011 instead of reading upward 1101.',
    hints: {
      level1: () => 'The first remainder calculated represents the Least Significant Digit (LSD) of the converted number.',
      level2: () => 'Read the remainders from bottom to top (last remainder becomes the Most Significant Digit).',
      level3: (ctx) => `Assembling the remainders from bottom to top yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-overflow-rule',
    title: 'Confused Signed Overflow with Unsigned Carry',
    description:
      'The student confuses unsigned carry-out (C_out) with signed two\'s complement overflow (V). In two\'s complement, overflow occurs if and only if adding two numbers of the same sign produces a result with the opposite sign (or when C_in != C_out at the sign bit). Relying solely on final carry-out yields erroneous overflow verdicts.',
    affectedModules: ['numberSystems', 'alu', 'cpu8086'],
    example: 'Claiming overflow occurred in 7 + 1 = 8 (unsigned) when interpreting as signed 4-bit numbers.',
    hints: {
      level1: () => 'Signed two\'s complement overflow depends on sign agreement, not simply the final carry-out bit.',
      level2: () => 'Check if two positive numbers produced a negative sum, or two negative numbers produced a positive sum.',
      level3: (ctx) => `Applying the signed overflow rule reveals: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-law-applied',
    title: 'Mislabeled or Incorrect Boolean Law Justification',
    description:
      'The student performs a valid algebraic step but cites an incorrect governing Boolean law (e.g. citing De Morgan instead of Distributive). Alternatively, they invent an invalid rule to justify an ungrounded manipulation. In formal digital proofs, the deductive justification must accurately match the transformation.',
    affectedModules: ['boolean'],
    example: 'Simplifying A + AB to A and claiming it was justified by the Complement law rather than Absorption.',
    hints: {
      level1: () => 'Verify that the law cited precisely describes the identity used in this simplification step.',
      level2: () => 'Check the algebraic form of your transformation against standard Boolean axiom definitions.',
      level3: (ctx) => `The correct governing law for this algebraic identity is: ${ctx.expected}.`,
    },
  },
  {
    tag: 'algebra-sign-error',
    title: 'Algebraic Dual or Sign Error in Boolean Manipulation',
    description:
      'The student incorrectly distributes an operator over an identical operator or drops a literal during factoring. For instance, distributing OR over OR (A + (B + C) -> (A + B) + (A + C)) or treating Boolean addition like arithmetic addition. Boolean algebra requires strict adherence to lattice dualities.',
    affectedModules: ['boolean'],
    example: 'Distributing A + (B + C) as (A + B) * (A + C).',
    hints: {
      level1: () => 'Review the distributive and associative laws; operations with identical operators do not distribute.',
      level2: () => 'Verify whether parentheses and operators follow boolean lattice properties without arithmetic assumptions.',
      level3: (ctx) => `The correct simplification following boolean rules is: ${ctx.expected}.`,
    },
  },
  {
    tag: 'other',
    title: 'General or Unclassified Step Discrepancy',
    description:
      'The student\'s step does not match any known common misconception pattern in the catalog. The submitted expression or value is mathematically non-equivalent to the correct state. A counterexample assignment demonstrates the logical divergence.',
    affectedModules: ['kmap', 'sequential', 'numberSystems', 'boolean', 'alu', 'cpu8086'],
    example: 'Submitting an arbitrary incorrect expression or calculation that fails logical equivalence.',
    hints: {
      level1: () => 'Your current step does not match the expected state for this transformation.',
      level2: () => 'Compare your result against a truth table or step calculation to identify where it deviates.',
      level3: (ctx) => `The correct value for this step is: ${ctx.expected}.`,
    },
  },
];
