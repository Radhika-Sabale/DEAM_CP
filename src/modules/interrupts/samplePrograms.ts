/**
 * @file samplePrograms.ts
 * Curated 8086 assembly programs demonstrating interrupt concepts:
 * software interrupts, RET vs IRET stack corruption, STI shadow, NMI preemption,
 * nested interrupts, TF single-step debugging, timer tick counter, and HLT wake-up.
 */

import type { InterruptScenario } from '../../engine/interrupts';

export interface InterruptSampleProgram {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly defaultScenario?: InterruptScenario;
}

export const INTERRUPT_SAMPLE_PROGRAMS: readonly InterruptSampleProgram[] = [
  {
    id: 'software-int',
    title: '1. Software INT with Handler',
    description: 'Installs vector 0x20 in IVT, triggers INT 0x20, runs ISR, and returns via IRET.',
    source: `; 1. Software Interrupt INT 20H
VECTOR 0x20, isr_20
MOV AX, 5
INT 0x20
ADD AX, 10
HLT

isr_20:
ADD AX, 100
IRET`,
  },
  {
    id: 'ret-vs-iret',
    title: '2. RET vs IRET Stack Pitfall',
    description: 'Demonstrates stack corruption when a handler incorrectly uses RET (pops 2 bytes) instead of IRET (pops 6 bytes).',
    source: `; 2. RET vs IRET Stack Corruption Demonstration
VECTOR 0x21, faulty_isr
MOV AX, 1
INT 0x21
HLT

faulty_isr:
MOV BX, 42
; RET pops only Return IP (2 bytes), leaving CS and FLAGS stranded on stack!
RET`,
  },
  {
    id: 'intr-blocked-sti',
    title: '3. INTR Masked & STI Delay Shadow',
    description: 'Shows INTR held pending while IF=0 (CLI), then serviced after the 1-instruction STI shadow delay.',
    source: `; 3. Maskable INTR & STI Shadow Delay
VECTOR 0x30, timer_isr
CLI
MOV AX, 1
MOV BX, 2
STI
MOV CX, 3
HLT

timer_isr:
ADD DX, 1
IRET`,
    defaultScenario: {
      events: [{ atTick: 2, kind: 'intr', vector: 0x30 }],
    },
  },
  {
    id: 'nmi-during-handler',
    title: '4. NMI Preempts Maskable Handler',
    description: 'Edge-triggered NMI arrives while CPU is inside an INTR handler, preempting it with higher priority.',
    source: `; 4. NMI Preempting an INTR Handler
VECTOR 0x40, intr_isr
VECTOR 2, nmi_isr
STI
MOV AX, 1
HLT

intr_isr:
MOV BX, 10
MOV CX, 20
IRET

nmi_isr:
MOV DX, 99
IRET`,
    defaultScenario: {
      events: [
        { atTick: 1, kind: 'intr', vector: 0x40 },
        { atTick: 3, kind: 'nmi' },
      ],
    },
  },
  {
    id: 'nested-interrupts',
    title: '5. Nested Interrupts (STI in ISR)',
    description: 'Handler 1 executes STI to re-enable interrupts, allowing a subsequent INTR to nest cleanly inside it.',
    source: `; 5. Nested Interrupts
VECTOR 0x50, isr_outer
VECTOR 0x60, isr_inner
STI
MOV AX, 1
HLT

isr_outer:
MOV BX, 100
STI
MOV BX, 200
IRET

isr_inner:
MOV CX, 999
IRET`,
    defaultScenario: {
      events: [
        { atTick: 2, kind: 'intr', vector: 0x50 },
        { atTick: 4, kind: 'intr', vector: 0x60 },
      ],
    },
  },
  {
    id: 'single-step-trap',
    title: '6. Single-Step TF Trap (PUSHF/POPF)',
    description: 'Sets Trap Flag (TF) via PUSHF/POPF, triggering Vector 1 debug trap after each instruction.',
    source: `; 6. Single-Step TF Trap
VECTOR 1, step_trap
PUSHF
POP AX
OR AX, 0x0100
PUSH AX
POPF
MOV BX, 10
MOV CX, 20
HLT

step_trap:
INC DX
IRET`,
  },
  {
    id: 'timer-tick-counter',
    title: '7. Periodic Timer Counter',
    description: 'Hardware timer INTR (Vector 8) periodically interrupts main loop to increment memory counter.',
    source: `; 7. Periodic Timer Counter
VECTOR 0x08, timer_tick
MOV AX, 0
STI
loop_forever:
INC AX
CMP AX, 20
JNE loop_forever
HLT

timer_tick:
INC WORD PTR [0x0500]
IRET`,
    defaultScenario: {
      events: [
        { atTick: 4, kind: 'intr', vector: 0x08 },
        { atTick: 10, kind: 'intr', vector: 0x08 },
        { atTick: 16, kind: 'intr', vector: 0x08 },
      ],
    },
  },
  {
    id: 'hlt-woken-by-intr',
    title: '8. HLT Woken by Incoming INTR',
    description: 'CPU executes HLT and halts until an external hardware INTR wakes it up to continue.',
    source: `; 8. HLT Woken by INTR
VECTOR 0x09, wake_isr
STI
MOV AX, 0x1111
HLT
MOV BX, 0x2222
HLT

wake_isr:
MOV DX, 0x7777
IRET`,
    defaultScenario: {
      events: [{ atTick: 4, kind: 'intr', vector: 0x09 }],
    },
  },
];
