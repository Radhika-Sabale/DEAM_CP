/**
 * @file ivt.ts
 * Interrupt Vector Table (IVT) layout, vector resolution, and inspection for the 8086 CPU.
 *
 * DESIGN DECISIONS:
 * 1. The IVT occupies memory addresses 0x0000 - 0x03FF (256 vectors x 4 bytes at address n*4).
 * 2. Each entry consists of two little-endian 16-bit words:
 *    - Word 0 (address n*4): Handler instruction address (IP).
 *    - Word 1 (address n*4 + 2): Code segment (CS), fixed to 0x0000 in this single-segment teaching model.
 * 3. All-zero entries (all 4 bytes 0x00) are treated as "unset / not installed".
 * 4. Vectors 0-4 follow Intel canonical architectural names.
 */

export const IVT_BASE_ADDRESS = 0x0000;
export const IVT_LIMIT_ADDRESS = 0x03ff; // inclusive
export const IVT_TOTAL_VECTORS = 256;
export const BYTES_PER_VECTOR = 4;

/** Names of Intel reserved interrupt vectors 0 through 4 */
export const RESERVED_VECTOR_NAMES: Readonly<Record<number, string>> = {
  0: 'Divide Error',
  1: 'Single Step',
  2: 'NMI',
  3: 'Breakpoint',
  4: 'Overflow',
};

export interface IvtEntry {
  readonly vector: number;
  readonly address: number;
  readonly ip: number;
  readonly cs: number;
  readonly isInstalled: boolean;
  readonly name?: string;
}

/**
 * Calculates the memory start address for a given interrupt vector number (n * 4).
 *
 * @param vector Vector index in range 0..255
 * @returns 16-bit memory address (0x0000..0x03FC)
 */
export function vectorAddress(vector: number): number {
  if (!Number.isInteger(vector) || vector < 0 || vector > 255) {
    throw new RangeError(`Vector number must be an integer in 0..255. Received: ${vector}`);
  }
  return vector * BYTES_PER_VECTOR;
}

/**
 * Reads an interrupt vector entry from memory.
 *
 * @param readByteFn Memory reader function taking a 16-bit address and returning an 8-bit byte
 * @param vector Vector index in range 0..255
 * @returns Decoded IvtEntry
 */
export function readVector(
  readByteFn: (address: number) => number,
  vector: number
): IvtEntry {
  const addr = vectorAddress(vector);
  const b0 = readByteFn(addr) & 0xff;
  const b1 = readByteFn((addr + 1) & 0xffff) & 0xff;
  const b2 = readByteFn((addr + 2) & 0xffff) & 0xff;
  const b3 = readByteFn((addr + 3) & 0xffff) & 0xff;

  const ip = (b0 | (b1 << 8)) & 0xffff;
  const cs = (b2 | (b3 << 8)) & 0xffff;
  const isInstalled = b0 !== 0 || b1 !== 0 || b2 !== 0 || b3 !== 0;

  return {
    vector,
    address: addr,
    ip,
    cs,
    isInstalled,
    name: RESERVED_VECTOR_NAMES[vector],
  };
}

/**
 * Writes an interrupt vector entry into memory in little-endian format.
 *
 * @param writeByteFn Memory byte writer function taking address and byte value
 * @param vector Vector index in range 0..255
 * @param ip Handler instruction address (IP)
 * @param cs Code segment word (defaults to 0x0000)
 */
export function writeVector(
  writeByteFn: (address: number, val: number) => void,
  vector: number,
  ip: number,
  cs = 0x0000
): void {
  const addr = vectorAddress(vector);
  writeByteFn(addr, ip & 0xff);
  writeByteFn((addr + 1) & 0xffff, (ip >> 8) & 0xff);
  writeByteFn((addr + 2) & 0xffff, cs & 0xff);
  writeByteFn((addr + 3) & 0xffff, (cs >> 8) & 0xff);
}

/**
 * Enumerates all 256 interrupt vector table entries.
 *
 * @param readByteFn Memory reader function
 * @returns Array of all 256 IvtEntry objects
 */
export function listVectors(
  readByteFn: (address: number) => number
): readonly IvtEntry[] {
  const result: IvtEntry[] = [];
  for (let v = 0; v < IVT_TOTAL_VECTORS; v++) {
    result.push(readVector(readByteFn, v));
  }
  return result;
}
