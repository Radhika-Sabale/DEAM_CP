/**
 * @file registry.ts
 * Central registry of laboratory modules, pipeline handoff rules, capabilities metadata,
 * and lazy-loaded page component references.
 */

import {
  type ComponentType,
  lazy,
  type LazyExoticComponent,
} from 'react';
import type { DesignProject, ModuleId } from '../types/designProject';
import {
  COMBINATIONAL_PIPELINE_ORDER,
  SEQUENTIAL_PIPELINE_ORDER,
} from '../types/designProject';
import type { ModuleDefinition } from '../types/moduleInterface';
import { programFromAluOperation } from '../engine/cpu8086/aluProgram';

/**
 * Enhanced module catalog entry combining architectural definition with React component slot.
 */
export interface ModuleEntry extends ModuleDefinition {
  readonly phase: 1 | 2;
  readonly isAvailable: boolean;
  readonly component: LazyExoticComponent<ComponentType>;
}


const flipflopPagePromise = import('./flipflop').then((m) => ({
  default: m.FlipFlopPage,
}));

/**
 * Pre-warmed dynamic import promise for Sequential Designer page component.
 */
const sequentialPagePromise = import('./sequential').then((m) => ({
  default: m.SequentialPage,
}));

/**
 * Registered list of all Phase 1 and Phase 2 modules in the virtual lab.
 */
export const MODULE_REGISTRY: readonly ModuleEntry[] = [
  // --- Phase 1 Modules ---
  {
    id: 'number-systems',
    title: 'Number Systems & Radix Arithmetic',
    description:
      'Interactive conversions across binary, octal, decimal, hexadecimal, and signed two-complement representations.',
    icon: 'binary',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./numberSystems').then((m) => ({ default: m.NumberSystemsPage }))
    ),
  },
  {
    id: 'boolean-tool',
    title: 'Boolean Expression Analysis',
    description:
      'Symbolic AST parsing, step-by-step algebraic simplification, and truth table generation.',
    icon: 'code',
    reads: ['variables', 'expression', 'truthTable'],
    writes: ['variables', 'expression', 'truthTable'],
    nextModules: ['kmap-solver'],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./boolean').then((m) => ({ default: m.BooleanPage }))
    ),
  },
  {
    id: 'kmap-solver',
    title: 'Karnaugh Map Minimizer',
    description:
      '2 to 5 variable K-Maps with prime implicant grouping and Quine-McCluskey minimization.',
    icon: 'grid',
    reads: ['variables', 'expression', 'truthTable', 'kmap'],
    writes: ['kmap', 'minimizedExpression'],
    nextModules: ['circuit-simulator'],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./kmap').then((m) => ({ default: m.KMapPage }))
    ),
  },
  {
    id: 'circuit-simulator',
    title: 'Digital Circuit Schematic Simulator',
    description:
      'Gate-level interactive canvas with discrete-event propagation, timing diagrams, and probe analysis.',
    icon: 'cpu',
    reads: ['circuit', 'minimizedExpression'],
    writes: ['circuit', 'simulationTrace'],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./circuit').then((m) => ({ default: m.CircuitPage }))
    ),
  },
  {
    id: 'flipflop-simulator',
    title: 'Flip-Flop & Latch Workbench',
    description:
      'Bistable multivibrator analysis for SR, JK, D, and T flip-flops with clock timing traces.',
    icon: 'toggle',
    reads: ['flipFlopType'],
    writes: ['flipFlopType', 'simulationTrace'],
    nextModules: ['sequential-designer'],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      flipflopPagePromise
    ),
  },
  {
    id: 'sequential-designer',
    title: 'Synchronous Sequential Circuit Designer',
    description:
      'Finite State Machine design, state transition diagrams, excitation tables, and lockout verification.',
    icon: 'git-commit',
    reads: ['flipFlopType', 'stateDiagram', 'stateTable', 'excitationTable'],
    writes: [
      'stateDiagram',
      'stateTable',
      'excitationTable',
      'nextStateEquations',
    ],
    nextModules: ['kmap-solver', 'circuit-simulator'],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      sequentialPagePromise
    ),
  },

  // --- Research, Practice & Analytics Modules ---
  {
    id: 'practice',
    title: 'Adaptive Practice Workbench',
    description:
      'Targeted multi-step practice problems with intelligent hints and misconception diagnosis.',
    icon: 'activity',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./practice/PracticePage').then((m) => ({ default: m.PracticePage }))
    ),
  },
  {
    id: 'quiz',
    title: 'Conceptual Diagnostic Quizzes',
    description:
      'Topic-based formative multiple-choice quizzes with distractor misconception feedback.',
    icon: 'code',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./practice/QuizPage').then((m) => ({ default: m.QuizPage }))
    ),
  },
  {
    id: 'prepost-test',
    title: 'Pre/Post Diagnostic Assessment',
    description:
      'Form A/B diagnostic assessment for research evaluation of student learning gains.',
    icon: 'layers',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./research/PrePostTestPage').then((m) => ({ default: m.PrePostTestPage }))
    ),
  },
  {
    id: 'sus-survey',
    title: 'System Usability Scale (SUS)',
    description:
      'Standardized 10-item instrument measuring system usability and subjective learnability.',
    icon: 'activity',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./research/SusPage').then((m) => ({ default: m.SusPage }))
    ),
  },
  {
    id: 'teacher-dashboard',
    title: 'Teacher & Researcher Dashboard',
    description:
      'Local multi-student telemetry analysis, error pattern diagnostics, and learning metrics.',
    icon: 'grid',
    reads: [],
    writes: [],
    nextModules: [],
    phase: 1,
    isAvailable: true,
    component: lazy(() =>
      import('./research/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard }))
    ),
  },

  // --- Phase 2 Modules (Reserved Slots) ---
  {
    id: 'alu',
    title: 'Arithmetic Logic Unit (ALU)',
    description:
      'Modular 4-bit and 8-bit multi-function arithmetic and logic processor slice.',
    icon: 'layers',
    reads: ['alu'],
    writes: ['alu', 'circuit'],
    nextModules: ['circuit-simulator', '8086-cpu'],
    phase: 2,
    isAvailable: true,
    component: lazy(() =>
      import('./alu/AluPage').then((m) => ({ default: m.AluPage }))
    ),
  },
  {
    id: '8086-cpu',
    title: 'Intel 8086 Microprocessor Architecture',
    description:
      'Internal register files, EU/BIU pipelines, and 16-bit segmented memory simulation.',
    icon: 'box',
    reads: ['alu', 'cpu8086'],
    writes: ['cpu8086'],
    nextModules: ['interrupt-controller'],
    phase: 2,
    isAvailable: true,
    component: lazy(() =>
      import('./cpu8086').then((m) => ({ default: m.Cpu8086Page }))
    ),
  },
  {
    id: 'interrupt-controller',
    title: 'Interrupt Controller & Subsystem (8086 / 8259A)',
    description:
      'IVT vector table, NMI & INTR lines, STI delay shadow, 5-step hardware sequence, and labeled stack frames.',
    icon: 'activity',
    reads: ['cpu8086', 'interrupts'],
    writes: ['interrupts'],
    nextModules: ['8086-cpu'],
    phase: 2,
    isAvailable: true,
    component: lazy(() =>
      import('./interrupts').then((m) => ({ default: m.InterruptPage }))
    ),
  },
];

/**
 * Retrieves a module definition by ID.
 */
export function getModule(id: ModuleId): ModuleEntry | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

/**
 * Retrieves the list of next available modules for a given module.
 */
export function getNextModules(id: ModuleId): readonly ModuleEntry[] {
  const current = getModule(id);
  if (!current) return [];
  return current.nextModules
    .map((nextId) => getModule(nextId))
    .filter((m): m is ModuleEntry => m !== undefined);
}

/**
 * Checks whether the current DesignProject meets all prerequisites for handoff
 * from a source module to a target module.
 *
 * @param project The active project state
 * @param fromId Originating module ID
 * @param toId Target destination module ID
 * @returns Array of human-readable missing prerequisite messages (empty if ready)
 */
export function checkHandoffReadiness(
  project: DesignProject,
  fromId: ModuleId,
  toId: ModuleId
): readonly string[] {
  const errors: string[] = [];

  if (fromId === 'boolean-tool' && toId === 'kmap-solver') {
    const hasExpression = project.expression !== null && project.expression !== undefined;
    const hasTruthTable =
      project.truthTable &&
      project.truthTable.rows &&
      project.truthTable.rows.length > 0;

    if (!hasExpression && !hasTruthTable) {
      errors.push(
        'Please enter and parse a Boolean expression or generate a Truth Table before proceeding to the K-Map solver.'
      );
    } else {
      const varCount =
        project.variables?.length ?? (project.truthTable?.variables.length ?? 0);
      if (varCount < 2 || varCount > 5) {
        errors.push(
          `K-maps support 2 to 5 variables; your expression has ${varCount}.`
        );
      }
    }
  }

  if (fromId === 'kmap-solver' && toId === 'circuit-simulator') {
    const hasMinSop = project.minimizedExpression?.sop !== null && project.minimizedExpression?.sop !== undefined;
    const hasMinPos = project.minimizedExpression?.pos !== null && project.minimizedExpression?.pos !== undefined;

    if (!hasMinSop && !hasMinPos) {
      errors.push(
        'Please complete Karnaugh map grouping to obtain a minimized SOP or POS expression before generating the circuit schematic.'
      );
    }
  }

  if (fromId === 'flipflop-simulator' && toId === 'sequential-designer') {
    if (!project.flipFlopType) {
      errors.push(
        'Please select and verify a flip-flop type (SR, JK, D, or T) before designing the sequential state machine.'
      );
    }
  }

  if (fromId === 'sequential-designer' && toId === 'kmap-solver') {
    const hasExcitation =
      project.excitationTable &&
      project.excitationTable.rows &&
      project.excitationTable.rows.length > 0;

    if (!hasExcitation) {
      errors.push(
        'Please derive the flip-flop Excitation Table in the sequential designer before minimizing input equations in the K-Map solver.'
      );
    }
  }

  if (fromId === 'sequential-designer' && toId === 'circuit-simulator') {
    const hasEquations =
      project.nextStateEquations &&
      Object.keys(project.nextStateEquations).length > 0;

    if (!hasEquations) {
      errors.push(
        'Please derive the next-state input equations before synthesizing the synchronous circuit schematic.'
      );
    }
  }

  if (fromId === 'alu' && toId === 'circuit-simulator') {
    if (!project.circuit || project.circuit.nodes.length === 0) {
      errors.push(
        'Please generate or synthesize an adder circuit in the ALU before exploring it in the Circuit Simulator.'
      );
    }
  }

  if (fromId === 'alu' && toId === '8086-cpu') {
    const res = programFromAluOperation(project.alu);
    if (!res.available) {
      errors.push(res.reason);
    }
  }

  if (fromId === '8086-cpu' && toId === 'interrupt-controller') {
    if (!project.cpu8086?.source || project.cpu8086.source.trim().length === 0) {
      errors.push(
        'Please enter or assemble an 8086 assembly program before transferring it to the Interrupt Simulator.'
      );
    }
  }

  return errors;
}

/**
 * Returns the ordered pipeline list for combinational or sequential flows.
 */
export function getPipelineFor(
  flow: 'combinational' | 'sequential'
): readonly ModuleId[] {
  return flow === 'combinational'
    ? COMBINATIONAL_PIPELINE_ORDER
    : SEQUENTIAL_PIPELINE_ORDER;
}
