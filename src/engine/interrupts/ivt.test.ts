import { describe, it, expect } from 'vitest';
import {
  vectorAddress,
  readVector,
  writeVector,
  listVectors,
  RESERVED_VECTOR_NAMES,
  IVT_TOTAL_VECTORS,
} from './ivt';

describe('Interrupt Vector Table (IVT)', () => {
  it('computes exact memory addresses (n * 4) for all 256 vectors', () => {
    for (let v = 0; v < 256; v++) {
      expect(vectorAddress(v)).toBe(v * 4);
    }
  });

  it('throws RangeError for vectors outside 0..255 or non-integers', () => {
    expect(() => vectorAddress(-1)).toThrow(RangeError);
    expect(() => vectorAddress(256)).toThrow(RangeError);
    expect(() => vectorAddress(3.5)).toThrow(RangeError);
  });

  it('correctly maps reserved vector names for 0 through 4', () => {
    expect(RESERVED_VECTOR_NAMES[0]).toBe('Divide Error');
    expect(RESERVED_VECTOR_NAMES[1]).toBe('Single Step');
    expect(RESERVED_VECTOR_NAMES[2]).toBe('NMI');
    expect(RESERVED_VECTOR_NAMES[3]).toBe('Breakpoint');
    expect(RESERVED_VECTOR_NAMES[4]).toBe('Overflow');
  });

  it('asserts little-endian layout byte-by-byte for written vectors', () => {
    const mem = new Uint8Array(1024);
    const readByte = (addr: number) => mem[addr] ?? 0;
    const writeByte = (addr: number, val: number) => {
      mem[addr] = val & 0xff;
    };

    // Vector 21h (decimal 33): handler address 0x1234, CS 0x5678
    writeVector(writeByte, 0x21, 0x1234, 0x5678);

    const base = 0x21 * 4; // 132 = 0x84
    expect(mem[base]).toBe(0x34); // IP low
    expect(mem[base + 1]).toBe(0x12); // IP high
    expect(mem[base + 2]).toBe(0x78); // CS low
    expect(mem[base + 3]).toBe(0x56); // CS high

    const entry = readVector(readByte, 0x21);
    expect(entry.ip).toBe(0x1234);
    expect(entry.cs).toBe(0x5678);
    expect(entry.isInstalled).toBe(true);
  });

  it('detects unset vectors when all four bytes are 0x00', () => {
    const mem = new Uint8Array(1024);
    const readByte = (addr: number) => mem[addr] ?? 0;

    const entry = readVector(readByte, 5);
    expect(entry.ip).toBe(0);
    expect(entry.cs).toBe(0);
    expect(entry.isInstalled).toBe(false);
  });

  it('reads and writes all 256 vectors accurately and lists them via listVectors', () => {
    const mem = new Uint8Array(1024);
    const readByte = (addr: number) => mem[addr] ?? 0;
    const writeByte = (addr: number, val: number) => {
      mem[addr] = val & 0xff;
    };

    for (let v = 0; v < IVT_TOTAL_VECTORS; v++) {
      const handlerIp = (v * 17 + 1) & 0xffff; // non-zero deterministic IP
      writeVector(writeByte, v, handlerIp, 0x0000);
    }

    const all = listVectors(readByte);
    expect(all.length).toBe(256);

    for (let v = 0; v < IVT_TOTAL_VECTORS; v++) {
      const entry = all[v];
      expect(entry).toBeDefined();
      if (!entry) continue;
      expect(entry.vector).toBe(v);
      expect(entry.address).toBe(v * 4);
      expect(entry.ip).toBe((v * 17 + 1) & 0xffff);
      expect(entry.cs).toBe(0x0000);
      expect(entry.isInstalled).toBe(true);
    }
  });
});
