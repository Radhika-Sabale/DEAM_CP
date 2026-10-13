/**
 * @file loader.ts
 * Deterministic client-side loader for curated laboratory seed problems (Stage 12A).
 * Uses static Vite JSON imports to support 100% offline client-side execution.
 */

import booleanJson from '../../../../seed-problems/boolean.json';
import circuitsJson from '../../../../seed-problems/circuits.json';
import countersJson from '../../../../seed-problems/counters.json';
import flipflopsJson from '../../../../seed-problems/flipflops.json';
import kmapJson from '../../../../seed-problems/kmap.json';
import numberSystemsJson from '../../../../seed-problems/number-systems.json';
import sequenceDetectorsJson from '../../../../seed-problems/sequence-detectors.json';
import { parse } from '../../boolean/parser';
import type { CircuitGraph } from '../../../types/circuit';
import type { ModuleId, ProjectPatch } from '../../../types/designProject';
import { isRecord, validateSeedProblem } from './guards';
import type {
  SeedLoadError,
  SeedLoadResult,
  SeedProblem,
  SeedProblemFilter,
  SeedProjectPayload,
} from './types';

interface RawSeedFile {
  readonly moduleId?: unknown;
  readonly problems?: unknown;
}

const STATIC_SEED_FILES: readonly { readonly name: string; readonly raw: RawSeedFile }[] = [
  { name: 'number-systems.json', raw: numberSystemsJson },
  { name: 'boolean.json', raw: booleanJson },
  { name: 'kmap.json', raw: kmapJson },
  { name: 'circuits.json', raw: circuitsJson },
  { name: 'flipflops.json', raw: flipflopsJson },
  { name: 'counters.json', raw: countersJson },
  { name: 'sequence-detectors.json', raw: sequenceDetectorsJson },
];

/**
 * Loads and validates all seed problems across static JSON files.
 * Reports malformed entries and duplicate IDs without throwing exceptions.
 */
export function loadSeedProblems(): SeedLoadResult {
  const problems: SeedProblem[] = [];
  const errors: SeedLoadError[] = [];
  const seenIds = new Set<string>();

  const byModule: Record<ModuleId, SeedProblem[]> = {
    'number-systems': [],
    'boolean-tool': [],
    'kmap-solver': [],
    'circuit-simulator': [],
    'flipflop-simulator': [],
    'sequential-designer': [],
    practice: [],
    quiz: [],
    'prepost-test': [],
    'sus-survey': [],
    'teacher-dashboard': [],
    alu: [],
    '8086-cpu': [],
    'interrupt-controller': [],
  };

  for (const file of STATIC_SEED_FILES) {
    if (!isRecord(file.raw) || !Array.isArray(file.raw.problems)) {
      errors.push({
        id: 'file-error',
        reason: `Seed file "${file.name}" missing root "problems" array`,
        file: file.name,
      });
      continue;
    }

    for (let idx = 0; idx < file.raw.problems.length; idx++) {
      const candidate: unknown = file.raw.problems[idx];
      const validation = validateSeedProblem(candidate);

      if (!validation.ok) {
        errors.push({
          id: validation.id,
          reason: `${validation.reason} in ${file.name}[${idx}]`,
          file: file.name,
        });
        continue;
      }

      const problem = validation.problem;
      if (seenIds.has(problem.id)) {
        errors.push({
          id: problem.id,
          reason: `Duplicate seed problem ID "${problem.id}" across seed files`,
          file: file.name,
        });
        continue;
      }

      seenIds.add(problem.id);
      problems.push(problem);

      const targetList = byModule[problem.moduleId];
      if (targetList) {
        targetList.push(problem);
      }
    }
  }

  return {
    problems: Object.freeze(problems),
    byModule: Object.freeze(byModule) as Readonly<Record<ModuleId, readonly SeedProblem[]>>,
    errors: Object.freeze(errors),
  };
}

/** Cached instance of loaded seed problems for high-performance synchronous lookups. */
let cachedLoadResult: SeedLoadResult | null = null;

function getCachedResult(): SeedLoadResult {
  if (!cachedLoadResult) {
    cachedLoadResult = loadSeedProblems();
  }
  return cachedLoadResult;
}

/**
 * Retrieves a single seed problem by its globally unique identifier.
 *
 * @param id The seed problem ID
 * @returns The seed problem if found, or undefined
 */
export function getSeedProblem(id: string): SeedProblem | undefined {
  const result = getCachedResult();
  return result.problems.find((p) => p.id === id);
}

/**
 * Lists seed problems matching optional filtering criteria.
 *
 * @param filter Optional module, difficulty, or misconception tag filter
 * @returns Filtered array of matching seed problems
 */
export function listSeedProblems(filter?: SeedProblemFilter): readonly SeedProblem[] {
  const result = getCachedResult();
  if (!filter) return result.problems;

  return result.problems.filter((p) => {
    if (filter.moduleId && p.moduleId !== filter.moduleId) return false;
    if (filter.difficulty && p.difficulty !== filter.difficulty) return false;
    if (filter.tag && !p.tags.includes(filter.tag)) return false;
    return true;
  });
}

/**
 * Converts a seed problem into a ready-to-load DesignProject patch and navigation payload.
 *
 * @param problem The seed problem to instantiate into a project
 * @returns SeedProjectPayload containing patch, name, and target home module
 */
export function seedToProject(problem: SeedProblem): SeedProjectPayload {
  const patch: ProjectPatch = {
    ...problem.projectSeed,
    pipelineProgress: {
      completedModules: [],
      activeModule: problem.moduleId,
    },
  };

  if (typeof patch.expression === 'string') {
    const parseRes = parse(patch.expression);
    patch.expression = parseRes.ok && parseRes.ast ? parseRes.ast : null;
  }

  if (problem.moduleId === 'kmap-solver' && !patch.truthTable) {
    const vars = (patch.variables as string[] | undefined) ?? ['A', 'B', 'C', 'D'];
    const n = vars.length;
    const rawSeed = problem.projectSeed as Record<string, unknown>;
    const rawParams = problem.parameters as Record<string, unknown>;
    const minterms = new Set<number>((rawSeed['minterms'] ?? rawParams['minterms'] ?? []) as number[]);
    const dontCares = new Set<number>((rawSeed['dontCares'] ?? rawParams['dontCares'] ?? []) as number[]);
    const rowCount = 1 << n;
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      const inputs: (0 | 1)[] = [];
      for (let bit = n - 1; bit >= 0; bit--) {
        inputs.push(((i >> bit) & 1) as 0 | 1);
      }
      const output = dontCares.has(i) ? ('X' as const) : minterms.has(i) ? (1 as const) : (0 as const);
      rows.push({ index: i, inputs, output });
    }
    patch.truthTable = {
      variables: vars,
      rows,
    };
  }

  if (patch.circuit) {
    const c = patch.circuit as unknown as Record<string, unknown>;
    const nodes = (c['nodes'] ?? c['components'] ?? []) as unknown[];
    patch.circuit = {
      ...c,
      nodes,
      components: nodes,
      wires: (c['wires'] ?? []) as unknown[],
    } as unknown as CircuitGraph;
  }

  if (problem.moduleId === 'circuit-simulator' && !patch.minimizedExpression) {
    const text = String(problem.finalAnswer || '1');
    const parsed = parse(text);
    const ast = parsed.ok && parsed.ast ? parsed.ast : { type: 'constant' as const, value: 1 as const };
    patch.minimizedExpression = {
      sop: { ast, text },
      pos: null,
    };
  }

  if (problem.moduleId === 'sequential-designer' && !patch.flipFlopType) {
    const rawParams = problem.parameters as Record<string, unknown>;
    const rawSpec = (patch.sequentialSpec ?? rawParams['sequentialSpec']) as
      | { flipFlopType?: 'SR' | 'JK' | 'D' | 'T' }
      | undefined;
    patch.flipFlopType = rawSpec?.flipFlopType ?? 'JK';
  }

  return {
    patch,
    name: problem.title,
    targetModule: problem.moduleId,
  };
}


