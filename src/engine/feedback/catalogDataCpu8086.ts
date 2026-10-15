/**
 * @file catalogDataCpu8086.ts
 * Authoritative taxonomy of student cognitive misconceptions for the
 * 8086 Microprocessor Architecture module (Stage 14C).
 */

import type { MisconceptionCatalogEntry } from './types';

export const CPU8086_MISCONCEPTION_ENTRIES: readonly MisconceptionCatalogEntry[] = [
  {
    tag: 'wrong-jcc-condition',
    title: 'Incorrect Conditional Branch Flag Condition',
    description:
      'The student misidentifies the flag condition for a conditional jump mnemonic (excluding signed versus unsigned relationship mix-ups, which are classified under wrong-cmp-relation). Examples include inverting the Zero Flag (treating JZ as JNZ or JE as JNE), confusing strict versus non-strict inequality boundaries (treating JA as JAE or JG as JGE), or reading JNE as JE.',
    affectedModules: ['cpu8086'],
    example: 'Executing JZ target when ZF = 0; student predicts branch taken believing JZ means "Jump if Zero flag is Clear".',
    hints: {
      level1: () => 'Review the flag condition associated with this jump mnemonic.',
      level2: () => 'Inspect the Zero Flag (ZF) or boundary flag condition for this mnemonic; verify whether it tests for equality or inequality.',
      level3: (ctx) => `Evaluating the correct branch condition produces next IP: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-push-order',
    title: 'Incorrect PUSH/POP Stack Pointer Operation Sequence',
    description:
      'The student assumes memory write occurs at the old SP before decrementing (or forgets to decrement SP entirely on PUSH). For POP, assumes SP is incremented before reading the stack top.',
    affectedModules: ['cpu8086', 'interrupt-controller'],
    example: 'Executing PUSH AX with SP = 0xFFFE; student predicts data is written to 0xFFFE instead of 0xFFFC.',
    hints: {
      level1: () => 'Remember the exact order of stack pointer adjustment and memory access in 8086 architecture.',
      level2: () => 'On PUSH, 8086 decrements SP first, then writes to the new address. On POP, it reads first, then increments SP.',
      level3: (ctx) => `Following the proper stack sequence yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-stack-direction',
    title: 'Inverted Stack Growth Direction',
    description:
      'The student assumes the stack grows upward toward higher memory addresses (incrementing SP on PUSH, decrementing on POP) rather than downward toward lower addresses.',
    affectedModules: ['cpu8086', 'interrupt-controller'],
    example: 'Executing PUSH with SP = 0x1000; student predicts SP becomes 0x1002 instead of 0x0FFE.',
    hints: {
      level1: () => 'Consider the direction in which the x86/8086 call and data stack grows in memory.',
      level2: () => 'In 8086 architecture, the stack grows downward toward address 0x0000, so PUSH subtracts from SP.',
      level3: (ctx) => `Stack grows downward; adjusting SP toward lower memory yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'confused-mov-direction',
    title: 'Inverted MOV Operand Direction (Source vs Destination)',
    description:
      'The student confuses the Intel 8086 destination-first operand ordering (MOV dest, src) with AT&T syntax or natural reading order, assigning the destination value to the source register. This misconception is detected when predicting the post-instruction value of the source register.',
    affectedModules: ['cpu8086'],
    example: 'Executing MOV AX, BX; student assumes BX receives AX\'s value instead of AX receiving BX.',
    hints: {
      level1: () => 'Check the direction of data flow in standard Intel syntax: destination comes first.',
      level2: () => 'In MOV dest, src, the second operand (src) is read and copied into the first operand (dest).',
      level3: (ctx) => `Copying source to destination gives: ${ctx.expected}.`,
    },
  },
  {
    tag: 'cmp-stores-result',
    title: 'Assumed CMP Updates Destination Register',
    description:
      'The student expects the CMP instruction to store the arithmetic difference (A - B) into the destination register, failing to recognize that CMP strictly modifies status flags while leaving both operands unchanged.',
    affectedModules: ['cpu8086'],
    example: 'Executing CMP AX, BX with AX=5, BX=3; student predicts AX becomes 2 instead of retaining 5.',
    hints: {
      level1: () => 'Remember the primary functional difference between SUB and CMP instructions.',
      level2: () => 'CMP performs subtraction internally to update flags, but discards the result without writing back to the destination.',
      level3: (ctx) => `Since CMP preserves its operands, the register value remains: ${ctx.expected}.`,
    },
  },
  {
    tag: 'mov-affects-flags',
    title: 'Assumed MOV Alters Status Flags',
    description:
      'The student expects data movement instructions (MOV, PUSH, POP) to update arithmetic and logic status flags (ZF, SF, CF, OF). This error is diagnosed when an unchanged flag is predicted to take on the value that a result-based flag update would produce.',
    affectedModules: ['cpu8086'],
    example: 'Executing MOV AX, 0; student sets ZF = 1 assuming transferring zero sets the Zero Flag.',
    hints: {
      level1: () => 'Review which instruction classes update the status flags in 8086 architecture.',
      level2: () => 'Data movement instructions (MOV, PUSH, POP) do not alter ZF, SF, CF, or OF; only arithmetic/logic operations update them.',
      level3: (ctx) => `Flags remain untouched across data movement; flag value is: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-call-return-address',
    title: 'Incorrect CALL Return Address on Stack',
    description:
      'The student expects CALL to push the target routine address, the current instruction pointer, or zero onto the stack instead of the address of the immediately following sequential instruction.',
    affectedModules: ['cpu8086', 'interrupt-controller'],
    example: 'Executing CALL at IP=2 targeting IP=10; student predicts return address 10 or 2 pushed instead of 3.',
    hints: {
      level1: () => 'Consider what instruction execution must resume at when a subroutine completes with RET.',
      level2: () => 'CALL must save the address of the next instruction (IP + 1) onto the stack so RET can resume caller execution.',
      level3: (ctx) => `The address pushed to the stack is the next sequential instruction: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-byte-order',
    title: 'Big-Endian Byte Layout in Little-Endian Memory',
    description:
      'The student places the high-order byte at the lower memory address or reads memory words using big-endian ordering rather than 8086 little-endian byte ordering (least significant byte at the lower address).',
    affectedModules: ['cpu8086', 'interrupt-controller'],
    example: 'Writing 0x1234 to memory; student expects byte 0x12 at base address and 0x34 at base+1.',
    hints: {
      level1: () => 'Remember the byte ordering convention used by 8086 memory architecture.',
      level2: () => '8086 is strictly little-endian: the least significant byte (low byte) is stored at the lowest address.',
      level3: (ctx) => `Applying little-endian byte ordering yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-address-vs-value',
    title: 'Immediate Address vs Dereferenced Memory Value',
    description:
      'The student confuses an immediate address literal (e.g. MOV AX, label) with the dereferenced memory content stored at that address (e.g. MOV AX, [label]), or vice versa.',
    affectedModules: ['cpu8086'],
    example: 'Executing MOV AX, table; student loads memory contents stored at table instead of table\'s offset address.',
    hints: {
      level1: () => 'Check whether the instruction uses square brackets around the operand.',
      level2: () => 'Square brackets [label] indicate memory dereferencing; bare label indicates the immediate offset address.',
      level3: (ctx) => `Evaluating the correct addressing mode yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-partial-register',
    title: 'Ignored Partial Register Overlap (AL/AH and AX)',
    description:
      'The student fails to account for 8-bit sub-registers (AL or AH) modifying the corresponding low or high byte of their enclosing 16-bit register (AX), assuming zero-extension or independent storage.',
    affectedModules: ['cpu8086'],
    example: 'AX holds 0x1234; executing MOV AL, 0x56; student assumes AX becomes 0x0056 instead of 0x1256.',
    hints: {
      level1: () => 'Recall how 8-bit registers map into their 16-bit parent registers in 8086 architecture.',
      level2: () => 'AL occupies the low byte (bits 0..7) and AH occupies the high byte (bits 8..15); the opposite byte is preserved.',
      level3: (ctx) => `Combining the modified byte with the preserved byte yields: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-ip-after-jump',
    title: 'Incorrect Instruction Pointer Following Branch',
    description:
      'The student predicts that execution advances sequentially when a branch condition is satisfied, or jumps to the target address when the condition evaluates to false, without a specific condition code error.',
    affectedModules: ['cpu8086'],
    example: 'Condition is met for JMP or Jcc; student predicts fallthrough to IP+1 instead of jumping to the target label.',
    hints: {
      level1: () => 'Check whether the jump condition evaluated to true or false.',
      level2: () => 'If the branch condition is met, IP updates to the target address; if false, execution falls through to IP + 1.',
      level3: (ctx) => `Following the branch decision sets next IP to: ${ctx.expected}.`,
    },
  },
];
