/**
 * @file types.ts
 * Type definitions and architectural contracts for the 8086 Assembler.
 *
 * ============================================================================
 * DESIGN DECISIONS (STAGE 14A TEACHING MODEL):
 *
 * 1. TEACHING MODEL, NOT AN 8086 EMULATOR:
 *    The assembler produces a decoded program (an array of instruction records),
 *    NOT real x86 machine-code bytes. Code is NOT stored in the 64 KB data memory,
 *    making self-modifying code impossible by architectural design.
 *
 * 2. INSTRUCTION POINTER (IP) AS INSTRUCTION INDEX:
 *    The first instruction is address 0, and each instruction occupies exactly
 *    one address unit (0, 1, 2, ...). CALL pushes the return instruction address
 *    as a 16-bit value. Every instruction record retains its source line number
 *    so the UI debugger can map IP to source lines.
 *
 * 3. FLAT 64 KB DATA MEMORY (LITTLE-ENDIAN):
 *    Memory is a flat 64 KB byte array (0x0000 - 0xFFFF) storing 16-bit words in
 *    little-endian order (low byte at lower address). Segment registers (CS, DS,
 *    SS, ES) are NOT modeled.
 *
 * 4. REGISTERS MODELED:
 *    - 16-bit general: AX, BX, CX, DX
 *    - 8-bit halves: AH, AL, BH, BL, CH, CL, DH, DL
 *    - 16-bit pointers & index: SI, DI, SP, IP
 *    - BP is NOT modeled.
 *
 * 5. STATUS FLAGS:
 *    - Actively computed flags: ZF, CF, SF, OF (derived from ALU engine).
 *    - Reserved flags: IF and TF (stored for Stage 15 interrupts; no execution effect).
 *    - PF (Parity), AF (Auxiliary Carry), DF (Direction) are NOT modeled.
 *
 * 6. BARE DATA LABEL VS [LABEL]:
 *    - "MOV AX, table" loads the immediate memory address of "table" (immediate value).
 *    - "MOV AX, [table]" dereferences memory at address "table" (loads the stored value).
 * ============================================================================
 */

export type Register16 = 'AX' | 'BX' | 'CX' | 'DX' | 'SI' | 'DI' | 'SP' | 'IP';
export type Register8 = 'AH' | 'AL' | 'BH' | 'BL' | 'CH' | 'CL' | 'DH' | 'DL';
export type RegisterName = Register16 | Register8;

export type BaseRegister = 'BX';
export type IndexRegister = 'SI' | 'DI';

export type CanonicalMnemonic =
  // Data Movement
  | 'MOV'
  | 'PUSH'
  | 'POP'
  // Arithmetic
  | 'ADD'
  | 'SUB'
  | 'INC'
  | 'DEC'
  | 'CMP'
  // Logic
  | 'AND'
  | 'OR'
  | 'XOR'
  // Shifts
  | 'SHL'
  | 'SHR'
  // Unconditional branch & subroutine
  | 'JMP'
  | 'CALL'
  | 'RET'
  // Conditional Jumps
  | 'JE'
  | 'JNE'
  | 'JC'
  | 'JNC'
  | 'JA'
  | 'JBE'
  | 'JG'
  | 'JGE'
  | 'JL'
  | 'JLE'
  | 'JS'
  | 'JNS'
  | 'JO'
  | 'JNO'
  // Control
  | 'HLT'
  | 'NOP'
  // Interrupts (Stage 15A)
  | 'INT'
  | 'IRET'
  | 'CLI'
  | 'STI'
  | 'PUSHF'
  | 'POPF';

export interface RegisterOperand {
  readonly kind: 'reg';
  readonly name: RegisterName;
  readonly size: 8 | 16;
}

export interface ImmediateOperand {
  readonly kind: 'imm';
  readonly value: number;
  readonly size?: 8 | 16;
  readonly label?: string;
}

export interface MemoryOperand {
  readonly kind: 'mem';
  readonly base?: BaseRegister;
  readonly index?: IndexRegister;
  readonly disp: number;
  readonly size?: 8 | 16;
  readonly label?: string;
}

export interface LabelOperand {
  readonly kind: 'label';
  readonly name: string;
}

export type Operand =
  | RegisterOperand
  | ImmediateOperand
  | MemoryOperand
  | LabelOperand;

export interface Instruction {
  readonly address: number;
  readonly mnemonic: CanonicalMnemonic;
  readonly operands: readonly Operand[];
  readonly size?: 8 | 16;
  readonly sourceLine: number;
  readonly sourceText: string;
}

export interface DataSegment {
  readonly address: number;
  readonly bytes: readonly number[];
}

export interface SymbolEntry {
  readonly name: string;
  readonly kind: 'code' | 'data';
  readonly address: number;
  readonly size?: 8 | 16;
}

export interface InstalledVector {
  readonly vector: number;
  readonly handlerAddress: number;
  readonly label: string;
}

export interface Program {
  readonly instructions: readonly Instruction[];
  readonly dataSegments: readonly DataSegment[];
  readonly symbols: Record<string, SymbolEntry>;
  readonly entryPoint: number;
  readonly installedVectors?: readonly InstalledVector[];
  readonly usesInterrupts?: boolean;
}

export interface AssemblerError {
  readonly line: number;
  readonly column: number;
  readonly length: number;
  readonly code: string;
  readonly message: string;
}

export interface AssemblerWarning {
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
}

export type AssemblerResult =
  | {
      readonly ok: true;
      readonly program: Program;
      readonly symbols: Record<string, SymbolEntry>;
      readonly warnings: readonly AssemblerWarning[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly AssemblerError[];
      readonly warnings: readonly AssemblerWarning[];
    };

export type SectionKind = '.data' | '.code';
