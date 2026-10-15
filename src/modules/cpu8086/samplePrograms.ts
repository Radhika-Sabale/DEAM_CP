/**
 * @file samplePrograms.ts
 * Curated sample 8086 assembly programs for the code editor sample menu.
 * Each sample teaches a specific architectural concept and is verified by an engine test.
 */

export interface SampleProgram {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
}

export const SAMPLE_PROGRAMS: readonly SampleProgram[] = [
  {
    id: 'sum-loop',
    title: 'Sum Loop (1 to 10)',
    description: 'CX-counted loop computing the sum 1 + 2 + … + 10 in AX.',
    source: `; Sum of 1 to 10 using CX counter
MOV AX, 0
MOV CX, 10
sum_loop:
ADD AX, CX
DEC CX
JNZ sum_loop
HLT`,
  },
  {
    id: 'array-max',
    title: 'Array Maximum',
    description: 'Finds the maximum byte in an array stored in .data.',
    source: `.data
arr: DB 23, 89, 12, 104, 55, 9, 78, 42
.code
MOV BX, arr
MOV CX, 8
MOV AL, [BX]
INC BX
DEC CX
find_max:
MOV DL, [BX]
CMP DL, AL
JBE skip_max
MOV AL, DL
skip_max:
INC BX
DEC CX
JNZ find_max
HLT`,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci Sequence',
    description: 'Computes Fibonacci sequence values in memory.',
    source: `.data
fib: DB 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
.code
MOV BX, fib
MOV BYTE PTR [BX], 0
INC BX
MOV BYTE PTR [BX], 1
MOV CX, 10
fib_loop:
MOV AL, [BX-1]
ADD AL, [BX]
INC BX
MOV [BX], AL
DEC CX
JNZ fib_loop
HLT`,
  },
  {
    id: 'reverse-stack',
    title: 'Reverse Array via Stack',
    description: 'Reverses an array of 16-bit words using PUSH and POP LIFO semantics.',
    source: `.data
arr: DW 11, 22, 33, 44, 55
.code
MOV BX, arr
MOV CX, 5
push_loop:
PUSH WORD PTR [BX]
ADD BX, 2
DEC CX
JNZ push_loop

MOV BX, arr
MOV CX, 5
pop_loop:
POP WORD PTR [BX]
ADD BX, 2
DEC CX
JNZ pop_loop
HLT`,
  },
  {
    id: 'subroutine-call',
    title: 'Subroutine Call & Return',
    description: 'Subroutine invocation via CALL and RET with stack frame unwinding.',
    source: `MOV AX, 1
CALL double_and_inc
CALL double_and_inc
CALL double_and_inc
HLT

double_and_inc:
INC AX
SHL AX, 1
RET`,
  },
  {
    id: 'bubble-sort',
    title: 'Bubble Sort',
    description: 'In-place ascending bubble sort of bytes in memory.',
    source: `.data
arr: DB 64, 25, 12, 22, 11, 90, 88, 34
.code
MOV CX, 7
outer:
MOV BX, arr
MOV DX, CX
inner:
MOV AL, [BX]
MOV AH, [BX+1]
CMP AL, AH
JBE no_swap
MOV [BX], AH
MOV [BX+1], AL
no_swap:
INC BX
DEC DX
JNZ inner
DEC CX
JNZ outer
HLT`,
  },
  {
    id: 'signed-vs-unsigned',
    title: 'Signed (JL) vs Unsigned (JB) Compare',
    description: 'Compares 0xFFFF (-1 signed, 65535 unsigned) with 0x0001 to show signed vs unsigned branch behavior.',
    source: `; Compare 0xFFFF with 0x0001
MOV AX, 0xFFFF
MOV BX, 0x0001
CMP AX, BX
; Signed comparison: -1 < 1 is true (JL taken -> CX = 1)
JL signed_less
MOV CX, 0
JMP check_unsigned
signed_less:
MOV CX, 1

check_unsigned:
; Unsigned comparison: 65535 < 1 is false (JB not taken -> DX = 0)
JB unsigned_below
MOV DX, 0
JMP done
unsigned_below:
MOV DX, 1

done:
HLT`,
  },
  {
    id: 'shift-carry-count',
    title: 'Shift & Carry Counting',
    description: 'Counts set bits (population count) of a byte using SHR and CF.',
    source: `; Count set bits in 0xB5 (binary 10110101 = 5 bits)
MOV AL, 0xB5
MOV CX, 8
MOV BL, 0
count_loop:
SHR AL, 1
JNC skip_inc
INC BL
skip_inc:
DEC CX
JNZ count_loop
HLT`,
  },
];
