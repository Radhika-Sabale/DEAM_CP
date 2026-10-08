/**
 * @file verifyStepCircuit.ts
 * Verifier for synthesized/extracted combinational logic schematics (Stage 10C).
 */

import type { LogicValue } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';
import { extractTruthTable } from '../circuit/extractTruthTable';
import type { SequentialDesign } from './counterDesigner';
import type { CircuitVerificationResult } from './verifyStepTypes';

/**
 * Verifies a student-constructed or generated Circuit graph against a SequentialDesign specification.
 */
export function verifyCircuit(
  graph: CircuitGraph,
  design: SequentialDesign
): CircuitVerificationResult {
  // Collect union of all input variables across all design functions
  const inputVarSet = new Set<string>();
  for (const fn of design.functions) {
    for (const v of fn.variables) {
      inputVarSet.add(v);
    }
  }
  const requiredInputs = Array.from(inputVarSet);

  const extracted = extractTruthTable(graph, {
    inputOrder: requiredInputs,
  });

  if (!extracted.ok) {
    return {
      correct: false,
      missingInputs: [],
      missingOutputs: [],
      mismatches: [],
      message: `Truth table extraction failed: ${extracted.error.message}`,
    };
  }

  const table = extracted.table;
  const missingInputs: string[] = [];
  const missingOutputs: string[] = [];

  const extractedInputSet = new Set(table.inputs);
  const extractedOutputSet = new Set(table.outputs);

  for (const inp of requiredInputs) {
    if (!extractedInputSet.has(inp)) {
      missingInputs.push(inp);
    }
  }

  for (const fn of design.functions) {
    if (!extractedOutputSet.has(fn.name)) {
      missingOutputs.push(fn.name);
    }
  }

  if (missingInputs.length > 0 || missingOutputs.length > 0) {
    const msgs: string[] = [];
    if (missingInputs.length > 0) {
      msgs.push(`Missing primary input pin(s): ${missingInputs.join(', ')}`);
    }
    if (missingOutputs.length > 0) {
      msgs.push(`Missing circuit output pin(s): ${missingOutputs.join(', ')}`);
    }
    return {
      correct: false,
      missingInputs,
      missingOutputs,
      mismatches: [],
      message: msgs.join('; '),
    };
  }

  const mismatches: {
    output: string;
    row: number;
    expected: LogicValue;
    got: LogicValue;
  }[] = [];

  for (const fn of design.functions) {
    const outIdx = table.outputs.indexOf(fn.name);
    if (outIdx === -1) continue;

    for (let r = 0; r < table.rows.length; r++) {
      const rowObj = table.rows[r];
      if (!rowObj) continue;

      // Map circuit input row valuation to the function's specific input variable subset
      let fnRowIndex = 0;
      for (let bi = 0; bi < fn.variables.length; bi++) {
        const vName = fn.variables[bi];
        if (vName !== undefined) {
          const inpIdx = table.inputs.indexOf(vName);
          const rawVal = inpIdx !== -1 ? rowObj.inputs[inpIdx] : 0;
          const bitNum = rawVal === 1 ? 1 : 0;
          fnRowIndex = (fnRowIndex << 1) | bitNum;
        }
      }

      const expectedVal = fn.column[fnRowIndex];
      if (expectedVal === 'X' || expectedVal === undefined) continue;

      const gotNum = rowObj.outputs[outIdx];
      const gotVal: LogicValue = gotNum === 1 ? 1 : 0;

      if (gotVal !== expectedVal) {
        mismatches.push({
          output: fn.name,
          row: r,
          expected: expectedVal,
          got: gotVal,
        });
      }
    }
  }

  const correct = mismatches.length === 0;
  let message: string | undefined = undefined;
  if (!correct) {
    const firstMis = mismatches[0];
    message = `Circuit output '${firstMis?.output}' deviates from truth table on ${mismatches.length} care condition(s) (first mismatch at input index ${firstMis?.row})`;
  }

  return {
    correct,
    missingInputs,
    missingOutputs,
    mismatches,
    message,
  };
}
