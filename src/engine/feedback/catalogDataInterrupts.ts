/**
 * @file catalogDataInterrupts.ts
 * Authoritative taxonomy of student cognitive misconceptions for the
 * 8086 Interrupt Controller and Subsystem module (Stage 15B).
 */

import type { MisconceptionCatalogEntry } from './types';

export const INTERRUPT_MISCONCEPTION_ENTRIES: readonly MisconceptionCatalogEntry[] = [
  {
    tag: 'wrong-ivt-address',
    title: 'Incorrect Interrupt Vector Table Address Calculation',
    description:
      'The student calculates the IVT offset address incorrectly (such as n*2, n+4, n, or (n-1)*4 instead of n*4). Each 8086 IVT entry occupies 4 bytes (2 bytes for IP offset and 2 bytes for CS segment).',
    affectedModules: ['interrupt-controller'],
    example: 'For vector 0x20 (32 decimal), student predicts IVT address 0x40 (32*2) or 0x24 (32+4) instead of 0x80 (32*4).',
    hints: {
      level1: () => 'Review the layout and sizing of each descriptor entry in the 8086 Interrupt Vector Table.',
      level2: () => 'Each interrupt vector descriptor occupies 4 bytes in memory (2 bytes IP, 2 bytes CS), so vector n resides at byte address n * 4.',
      level3: (ctx) => `Multiplying the vector number by 4 gives the correct IVT entry address: ${ctx.expected}.`,
    },
  },
  {
    tag: 'unset-vector-assumed-valid',
    title: 'Uninstalled Interrupt Vector Assumed Valid',
    description:
      'The student assumes an interrupt vector table slot is valid and ready to service interrupts even though it contains all zeros (0x0000:0x0000) or has not been initialized with a valid handler pointer.',
    affectedModules: ['interrupt-controller'],
    example: 'Executing INT 0x80 when vector 0x80 holds 0x0000:0x0000; student assumes handler execution begins rather than a fault/halt.',
    hints: {
      level1: () => 'Check whether the operating system or program initialized the vector table entry before triggering the interrupt.',
      level2: () => 'In 8086 systems, uninitialized IVT slots hold 0x0000:0x0000; triggering an unset vector will jump to unmapped memory or trigger a CPU fault.',
      level3: (ctx) => `Since the IVT entry is not installed, the CPU cannot service it normally: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-int-frame-size',
    title: 'Incorrect Interrupt Stack Frame Byte Size',
    description:
      'The student predicts an interrupt stack frame pushes only 2 bytes (like a NEAR CALL with IP only) or 4 bytes (like a FAR CALL with CS and IP), omitting the 2-byte FLAGS register.',
    affectedModules: ['interrupt-controller'],
    example: 'Interrupt entry occurs; student predicts SP decreases by 2 or 4 instead of 6 bytes.',
    hints: {
      level1: () => 'Consider all registers that 8086 hardware must preserve on the stack during an interrupt entry.',
      level2: () => 'An 8086 hardware interrupt frame always pushes 3 words (6 bytes total): FLAGS, then CS, then IP.',
      level3: (ctx) => `Accounting for all 6 bytes (3 words) of the interrupt frame yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-int-frame-order',
    title: 'Incorrect Interrupt Stack Frame Word Ordering',
    description:
      'The student pushes the 3 words of the interrupt frame in the wrong sequence (for example, pushing IP first, CS second, and FLAGS third, or placing FLAGS at the top of the stack).',
    affectedModules: ['interrupt-controller'],
    example: 'On interrupt entry, student places FLAGS at TOS (SP) and IP at SP+4 instead of IP at TOS (SP) and FLAGS at SP+4.',
    hints: {
      level1: () => 'Recall the chronological hardware micro-sequence when 8086 enters an interrupt.',
      level2: () => '8086 hardware pushes FLAGS first (highest address), then CS, and finally IP (lowest address / top of stack).',
      level3: (ctx) => `Ordering stack words from top of stack (SP) upward produces: ${ctx.expected}.`,
    },
  },
  {
    tag: 'ret-instead-of-iret',
    title: 'Used RET Instead of IRET to Exit Interrupt Handler',
    description:
      'The student expects returning from an interrupt service routine using normal RET, which pops only IP (2 bytes), leaving the saved CS and FLAGS on the stack and failing to restore status flags.',
    affectedModules: ['interrupt-controller'],
    example: 'Returning from ISR with RET; student expects SP restored to initial SP, but 4 bytes (CS and FLAGS) remain on stack.',
    hints: {
      level1: () => 'Check which instruction is designed specifically to return from an interrupt handler versus a regular subroutine.',
      level2: () => 'Standard RET only pops IP (2 bytes). Interrupt handlers require IRET to pop IP, CS, and the saved FLAGS register (6 bytes total).',
      level3: (ctx) => `Using IRET rather than RET correctly restores flags and stack pointer: ${ctx.expected}.`,
    },
  },
  {
    tag: 'if-tf-not-cleared-on-entry',
    title: 'Assumed IF and TF Retained Across Interrupt Entry',
    description:
      'The student expects IF or TF to remain set after entering an interrupt service routine, failing to recognize that 8086 hardware automatically clears both IF and TF upon interrupt entry.',
    affectedModules: ['interrupt-controller'],
    example: 'When IF = 1 and an interrupt occurs, student expects IF = 1 inside the handler, allowing uncontrolled nested interrupts.',
    hints: {
      level1: () => 'Consider what the CPU hardware does to interrupt control flags to prevent re-entrant interrupt cascades.',
      level2: () => 'Upon acknowledging any interrupt, 8086 hardware automatically clears IF (disabling maskable INTR) and TF (disabling single-stepping).',
      level3: (ctx) => `Both IF and TF are cleared to 0 by hardware upon entry: ${ctx.expected}.`,
    },
  },
  {
    tag: 'nmi-treated-as-maskable',
    title: 'Treated Non-Maskable Interrupt (NMI) as Blocked by IF=0',
    description:
      'The student assumes that clearing the Interrupt Flag (CLI / IF = 0) blocks Non-Maskable Interrupts (NMI), confusing maskable INTR with non-maskable NMI.',
    affectedModules: ['interrupt-controller'],
    example: 'NMI occurs while IF = 0; student predicts the CPU ignores the NMI until STI executes.',
    hints: {
      level1: () => 'Review the distinction between maskable (INTR) and non-maskable (NMI) interrupt pins on 8086.',
      level2: () => 'The Interrupt Flag (IF) controls only the INTR input. Non-Maskable Interrupts (NMI) are never blocked by IF = 0.',
      level3: (ctx) => `Because NMI cannot be masked by IF, the interrupt is recognized: ${ctx.expected}.`,
    },
  },
  {
    tag: 'intr-ignores-if',
    title: 'Assumed INTR Serviced While Interrupt Flag (IF) is Cleared',
    description:
      'The student predicts that a maskable hardware interrupt (INTR) is serviced immediately even though the Interrupt Flag is cleared (IF = 0).',
    affectedModules: ['interrupt-controller'],
    example: 'INTR arrives with IF = 0; student predicts immediate jump to the vector handler instead of remaining pending.',
    hints: {
      level1: () => 'Check the state of the 8086 Interrupt Flag (IF) before determining whether INTR can be serviced.',
      level2: () => 'When IF = 0, maskable interrupts on the INTR line are ignored and remain pending until IF is set to 1 by STI or IRET.',
      level3: (ctx) => `Since IF = 0, INTR cannot be serviced at this time: ${ctx.expected}.`,
    },
  },
  {
    tag: 'forgot-sti-in-handler-for-nesting',
    title: 'Expected Interrupt Nesting Without STI in Handler',
    description:
      'The student expects higher or equal priority maskable interrupts to nest inside an active ISR without an explicit STI instruction, forgetting that entry automatically cleared IF.',
    affectedModules: ['interrupt-controller'],
    example: 'Inside an ISR with no STI; another INTR arrives; student expects the CPU to preempt the current handler immediately.',
    hints: {
      level1: () => 'Remember that interrupt entry automatically clears IF; how can an ISR allow nested interrupts?',
      level2: () => 'To allow nested interrupts inside a handler, the programmer must explicitly execute STI to re-enable INTR.',
      level3: (ctx) => `Without an explicit STI inside the handler, nested INTR interrupts remain blocked: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-interrupt-priority',
    title: 'Incorrect Simultaneous Interrupt Servicing Priority',
    description:
      'The student prioritizes pending interrupts in the wrong architectural order when multiple interrupts occur at the same tick (such as prioritizing INTR over NMI).',
    affectedModules: ['interrupt-controller'],
    example: 'NMI and INTR are asserted simultaneously; student services INTR first instead of NMI.',
    hints: {
      level1: () => 'Review 8086 hardware priority arbitration between external pins and internal traps.',
      level2: () => '8086 priority order prioritizes internal faults and single-step trap, then software INT, then NMI, and finally INTR.',
      level3: (ctx) => `Following 8086 hardware priority arbitration rules yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'tf-trap-timing',
    title: 'Premature Single-Step Trap Timing on TF Set',
    description:
      'The student predicts that the single-step trap (vector 1) fires immediately on the instruction that sets TF (such as POPF), rather than after the following instruction completes.',
    affectedModules: ['interrupt-controller'],
    example: 'POPF sets TF = 1; student predicts Type 1 trap fires before executing the next instruction.',
    hints: {
      level1: () => 'Check the exact instruction cycle boundary where the 8086 CPU samples and executes the Trap Flag (TF).',
      level2: () => 'When TF is set by POPF, the trap does not trigger on POPF itself; it fires after the instruction following POPF has finished.',
      level3: (ctx) => `The single-step trap occurs after completing the next instruction: ${ctx.expected}.`,
    },
  },
];
