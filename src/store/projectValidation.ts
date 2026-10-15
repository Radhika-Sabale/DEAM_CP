/**
 * @file projectValidation.ts
 * Hand-written type guards and field validation checks for imported DesignProject schemas.
 */

import type { ValidationError } from './projectIO';

const VALID_ALU_OPS = [
  'ADD',
  'SUB',
  'CMP',
  'AND',
  'OR',
  'XOR',
  'NOT',
  'INC',
  'DEC',
  'SHL',
  'SHR',
  'SAR',
  'ROL',
  'ROR',
] as const;

/**
 * Validates raw JSON object fields against the DesignProject schema.
 */
export function validateProjectFields(raw: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field: 'root', message: 'Project must be a JSON object.' });
    return errors;
  }

  const obj = raw as Record<string, unknown>;

  // Required identity & metadata
  if (typeof obj['schemaVersion'] !== 'number') {
    errors.push({ field: 'schemaVersion', message: 'Missing or non-numeric schemaVersion.' });
  }

  if (typeof obj['id'] !== 'string' || obj['id'].trim().length === 0) {
    errors.push({ field: 'id', message: 'Project id must be a non-empty string.' });
  }

  if (typeof obj['name'] !== 'string') {
    errors.push({ field: 'name', message: 'Project name must be a string.' });
  }

  if (typeof obj['createdAt'] !== 'string' || isNaN(Date.parse(obj['createdAt']))) {
    errors.push({ field: 'createdAt', message: 'createdAt must be a valid ISO timestamp string.' });
  }

  if (typeof obj['updatedAt'] !== 'string' || isNaN(Date.parse(obj['updatedAt']))) {
    errors.push({ field: 'updatedAt', message: 'updatedAt must be a valid ISO timestamp string.' });
  }

  // Optional arrays and objects
  if (obj['variables'] !== undefined) {
    if (!Array.isArray(obj['variables']) || !obj['variables'].every((v) => typeof v === 'string')) {
      errors.push({ field: 'variables', message: 'variables must be an array of strings.' });
    }
  }

  if (obj['expression'] !== undefined && obj['expression'] !== null) {
    if (typeof obj['expression'] !== 'object' || typeof (obj['expression'] as Record<string, unknown>)['type'] !== 'string') {
      errors.push({ field: 'expression', message: 'expression must be an AST node object or null.' });
    }
  }

  if (obj['truthTable'] !== undefined && obj['truthTable'] !== null) {
    const tt = obj['truthTable'] as Record<string, unknown>;
    if (typeof tt !== 'object' || !Array.isArray(tt['variables']) || !Array.isArray(tt['rows'])) {
      errors.push({ field: 'truthTable', message: 'truthTable must contain variables array and rows array.' });
    }
  }

  if (obj['circuit'] !== undefined && obj['circuit'] !== null) {
    const circ = obj['circuit'] as Record<string, unknown>;
    const hasNodes = Array.isArray(circ['nodes']) || Array.isArray(circ['components']);
    if (typeof circ !== 'object' || !hasNodes || !Array.isArray(circ['wires'])) {
      errors.push({ field: 'circuit', message: 'circuit must contain nodes array and wires array.' });
    }
  }

  if (obj['kmap'] !== undefined && obj['kmap'] !== null) {
    const kmap = obj['kmap'] as Record<string, unknown>;
    if (typeof kmap !== 'object' || !Array.isArray(kmap['variables']) || !Array.isArray(kmap['cells'])) {
      errors.push({ field: 'kmap', message: 'kmap must contain variables array and cells array.' });
    }
  }

  if (obj['pipelineProgress'] !== undefined && obj['pipelineProgress'] !== null) {
    const pp = obj['pipelineProgress'] as Record<string, unknown>;
    if (typeof pp !== 'object' || !Array.isArray(pp['completedModules'])) {
      errors.push({ field: 'pipelineProgress.completedModules', message: 'pipelineProgress.completedModules must be an array.' });
    }
  }

  if (obj['sequentialSpec'] !== undefined && obj['sequentialSpec'] !== null) {
    if (typeof obj['sequentialSpec'] !== 'object') {
      errors.push({ field: 'sequentialSpec', message: 'sequentialSpec must be an object or null.' });
    }
  }

  // ALU state validation (optional/nullable)
  if (obj['alu'] !== undefined && obj['alu'] !== null) {
    if (typeof obj['alu'] !== 'object') {
      errors.push({ field: 'alu', message: 'alu must be an object or null.' });
    } else {
      const alu = obj['alu'] as Record<string, unknown>;
      if (typeof alu['op'] !== 'string' || !VALID_ALU_OPS.includes(alu['op'] as (typeof VALID_ALU_OPS)[number])) {
        errors.push({ field: 'alu.op', message: `alu.op must be a valid AluOpId (${VALID_ALU_OPS.join(', ')}).` });
      }
      if (typeof alu['width'] !== 'number' || !Number.isInteger(alu['width']) || alu['width'] < 2 || alu['width'] > 16) {
        errors.push({ field: 'alu.width', message: 'alu.width must be an integer between 2 and 16.' });
      }
      if (typeof alu['a'] !== 'number' || !Number.isInteger(alu['a']) || alu['a'] < 0) {
        errors.push({ field: 'alu.a', message: 'alu.a must be a non-negative integer.' });
      }
      if (typeof alu['b'] !== 'number' || !Number.isInteger(alu['b']) || alu['b'] < 0) {
        errors.push({ field: 'alu.b', message: 'alu.b must be a non-negative integer.' });
      }
      if (alu['shiftCount'] !== undefined && (typeof alu['shiftCount'] !== 'number' || !Number.isInteger(alu['shiftCount']) || alu['shiftCount'] < 1)) {
        errors.push({ field: 'alu.shiftCount', message: 'alu.shiftCount must be a positive integer.' });
      }
      if (alu['previousC'] !== undefined && alu['previousC'] !== 0 && alu['previousC'] !== 1) {
        errors.push({ field: 'alu.previousC', message: 'alu.previousC must be 0 or 1.' });
      }
    }
  }

  // CPU 8086 state validation (optional/nullable)
  if (obj['cpu8086'] !== undefined && obj['cpu8086'] !== null) {
    if (typeof obj['cpu8086'] !== 'object') {
      errors.push({ field: 'cpu8086', message: 'cpu8086 must be an object or null.' });
    } else {
      const cpu = obj['cpu8086'] as Record<string, unknown>;
      if (typeof cpu['source'] !== 'string') {
        errors.push({ field: 'cpu8086.source', message: 'cpu8086.source must be a string.' });
      } else if (cpu['source'].length > 200_000) {
        errors.push({
          field: 'cpu8086.source',
          message: 'cpu8086.source exceeds maximum allowed length of 200,000 characters.',
        });
      }

      if (!Array.isArray(cpu['breakpoints'])) {
        errors.push({ field: 'cpu8086.breakpoints', message: 'cpu8086.breakpoints must be an array.' });
      } else if (cpu['breakpoints'].length > 1_000) {
        errors.push({
          field: 'cpu8086.breakpoints',
          message: 'cpu8086.breakpoints exceeds maximum allowed count of 1,000 breakpoints.',
        });
      } else if (
        !cpu['breakpoints'].every((bp) => typeof bp === 'number' && Number.isInteger(bp) && bp >= 1)
      ) {
        errors.push({
          field: 'cpu8086.breakpoints',
          message: 'cpu8086.breakpoints must contain only positive integers (1-based source lines).',
        });
      }
    }
  }

  // Interrupt Controller state validation (optional/nullable)
  if (obj['interrupts'] !== undefined && obj['interrupts'] !== null) {
    if (typeof obj['interrupts'] !== 'object') {
      errors.push({ field: 'interrupts', message: 'interrupts must be an object or null.' });
    } else {
      const intr = obj['interrupts'] as Record<string, unknown>;
      if (typeof intr['source'] !== 'string') {
        errors.push({ field: 'interrupts.source', message: 'interrupts.source must be a string.' });
      } else if (intr['source'].length > 200_000) {
        errors.push({
          field: 'interrupts.source',
          message: 'interrupts.source exceeds maximum allowed length of 200,000 characters.',
        });
      }

      if (!Array.isArray(intr['breakpoints'])) {
        errors.push({ field: 'interrupts.breakpoints', message: 'interrupts.breakpoints must be an array.' });
      } else if (intr['breakpoints'].length > 1_000) {
        errors.push({
          field: 'interrupts.breakpoints',
          message: 'interrupts.breakpoints exceeds maximum allowed count of 1,000 breakpoints.',
        });
      } else if (
        !intr['breakpoints'].every((bp) => typeof bp === 'number' && Number.isInteger(bp) && bp >= 1)
      ) {
        errors.push({
          field: 'interrupts.breakpoints',
          message: 'interrupts.breakpoints must contain only positive integers (1-based source lines).',
        });
      }

      if (!Array.isArray(intr['scenario'])) {
        errors.push({ field: 'interrupts.scenario', message: 'interrupts.scenario must be an array.' });
      } else if (intr['scenario'].length > 1_000) {
        errors.push({
          field: 'interrupts.scenario',
          message: 'interrupts.scenario exceeds maximum allowed count of 1,000 events.',
        });
      } else {
        for (let i = 0; i < intr['scenario'].length; i++) {
          const ev = intr['scenario'][i];
          const prefix = `interrupts.scenario[${i}]`;
          if (!ev || typeof ev !== 'object') {
            errors.push({ field: prefix, message: `${prefix} must be an object.` });
            continue;
          }
          const rec = ev as Record<string, unknown>;
          if (
            typeof rec['atTick'] !== 'number' ||
            !Number.isInteger(rec['atTick']) ||
            rec['atTick'] < 0 ||
            rec['atTick'] > 1_000_000
          ) {
            errors.push({
              field: `${prefix}.atTick`,
              message: `${prefix}.atTick must be an integer between 0 and 1,000,000.`,
            });
          }
          if (rec['kind'] !== 'nmi' && rec['kind'] !== 'intr') {
            errors.push({
              field: `${prefix}.kind`,
              message: `${prefix}.kind must be 'nmi' or 'intr'.`,
            });
          } else if (rec['kind'] === 'intr') {
            if (
              typeof rec['vector'] !== 'number' ||
              !Number.isInteger(rec['vector']) ||
              rec['vector'] < 0 ||
              rec['vector'] > 255
            ) {
              errors.push({
                field: `${prefix}.vector`,
                message: `${prefix}.vector must be an integer between 0 and 255 for INTR events.`,
              });
            }
          } else if (rec['kind'] === 'nmi') {
            if (rec['vector'] !== undefined && rec['vector'] !== 2) {
              errors.push({
                field: `${prefix}.vector`,
                message: `${prefix}.vector must be omitted or 2 for NMI events.`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
}
