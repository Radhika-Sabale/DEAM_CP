/**
 * @file registers.ts
 * 8086 Architectural Registers and 8-bit / 16-bit register view projections.
 *
 * ============================================================================
 * DESIGN PRINCIPLES:
 * 1. 16-bit registers AX, BX, CX, DX, SI, DI, SP, IP form the canonical state.
 * 2. 8-bit registers AL, AH, BL, BH, CL, CH, DL, DH are deterministic views
 *    projected directly onto the low (bits 0..7) and high (bits 8..15) bytes of
 *    their respective 16-bit registers (AX, BX, CX, DX).
 * 3. By computing 8-bit register reads and writes directly from/to the 16-bit
 *    backing values, desynchronization between 16-bit and 8-bit registers is
 *    structurally impossible.
 * 4. All register writes strictly mask input values to the register's bit width:
 *    - 16-bit registers: value & 0xFFFF
 *    - 8-bit registers: value & 0xFF
 * ============================================================================
 */

import type { Register16, Register8, RegisterName } from './types';

/**
 * Backing storage for the 16-bit architectural registers.
 */
export interface Registers {
  readonly AX: number;
  readonly BX: number;
  readonly CX: number;
  readonly DX: number;
  readonly SI: number;
  readonly DI: number;
  readonly SP: number;
  readonly IP: number;
}

/**
 * Configuration options for register initialization.
 */
export interface RegisterOptions {
  /** Initial stack pointer value (default: 0xFFFE) */
  readonly initialSp?: number;
  /** Initial instruction pointer / entry point (default: 0) */
  readonly entryPoint?: number;
}

/**
 * Creates a new Registers state object initialized to default values.
 *
 * All registers initialize to 0, except SP which defaults to 0xFFFE (top of 64 KB memory)
 * and IP which defaults to the specified entry point (0).
 *
 * @param options Optional overrides for SP and IP.
 * @returns Immutable Registers state.
 */
export function createRegisters(options: RegisterOptions = {}): Registers {
  return {
    AX: 0,
    BX: 0,
    CX: 0,
    DX: 0,
    SI: 0,
    DI: 0,
    SP: (options.initialSp ?? 0xfffe) & 0xffff,
    IP: (options.entryPoint ?? 0) & 0xffff,
  };
}

/**
 * Reads the current value of a register (16-bit or 8-bit view).
 * Accepts either a Registers object or any state containing a registers property.
 *
 * @param target The Registers object or state with a registers property.
 * @param name The target register name.
 * @returns Unsigned value of the register (0..255 for 8-bit, 0..65535 for 16-bit).
 */
export function getReg(target: Registers | { readonly registers: Registers }, name: RegisterName): number {
  const regs = 'registers' in target ? target.registers : target;
  switch (name) {
    case 'AX': return regs.AX;
    case 'BX': return regs.BX;
    case 'CX': return regs.CX;
    case 'DX': return regs.DX;
    case 'SI': return regs.SI;
    case 'DI': return regs.DI;
    case 'SP': return regs.SP;
    case 'IP': return regs.IP;
    case 'AL': return regs.AX & 0xff;
    case 'AH': return (regs.AX >>> 8) & 0xff;
    case 'BL': return regs.BX & 0xff;
    case 'BH': return (regs.BX >>> 8) & 0xff;
    case 'CL': return regs.CX & 0xff;
    case 'CH': return (regs.CX >>> 8) & 0xff;
    case 'DL': return regs.DX & 0xff;
    case 'DH': return (regs.DX >>> 8) & 0xff;
  }
}

function updateRawRegs(registers: Registers, name: RegisterName, value: number): Registers {
  switch (name) {
    case 'AX': return { ...registers, AX: value & 0xffff };
    case 'BX': return { ...registers, BX: value & 0xffff };
    case 'CX': return { ...registers, CX: value & 0xffff };
    case 'DX': return { ...registers, DX: value & 0xffff };
    case 'SI': return { ...registers, SI: value & 0xffff };
    case 'DI': return { ...registers, DI: value & 0xffff };
    case 'SP': return { ...registers, SP: value & 0xffff };
    case 'IP': return { ...registers, IP: value & 0xffff };
    case 'AL': return { ...registers, AX: (registers.AX & 0xff00) | (value & 0xff) };
    case 'AH': return { ...registers, AX: (registers.AX & 0x00ff) | ((value & 0xff) << 8) };
    case 'BL': return { ...registers, BX: (registers.BX & 0xff00) | (value & 0xff) };
    case 'BH': return { ...registers, BX: (registers.BX & 0x00ff) | ((value & 0xff) << 8) };
    case 'CL': return { ...registers, CX: (registers.CX & 0xff00) | (value & 0xff) };
    case 'CH': return { ...registers, CX: (registers.CX & 0x00ff) | ((value & 0xff) << 8) };
    case 'DL': return { ...registers, DX: (registers.DX & 0xff00) | (value & 0xff) };
    case 'DH': return { ...registers, DX: (registers.DX & 0x00ff) | ((value & 0xff) << 8) };
  }
}

/**
 * Returns a new state or Registers with the specified register updated.
 *
 * @param target Either a Registers object or an object containing a registers property.
 * @param name The target register name (16-bit or 8-bit).
 * @param value The value to write.
 * @returns A brand-new state or Registers object with the update applied.
 */
export function setReg<T extends Registers | { readonly registers: Registers }>(
  target: T,
  name: RegisterName,
  value: number
): T {
  if ('registers' in target) {
    const nextRegs = updateRawRegs(target.registers, name, value);
    return { ...target, registers: nextRegs };
  }
  return updateRawRegs(target as Registers, name, value) as T;
}

/**
 * Checks whether the given register name refers to an 8-bit half register.
 */
export function is8BitRegister(name: RegisterName): name is Register8 {
  return name.length === 2 && (name.endsWith('L') || name.endsWith('H'));
}

/**
 * Checks whether the given register name refers to a 16-bit register.
 */
export function is16BitRegister(name: RegisterName): name is Register16 {
  return !is8BitRegister(name);
}
