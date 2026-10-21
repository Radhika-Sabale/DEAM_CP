import { describe, expect, it } from 'vitest';
import { buildTruthTable, parse } from '../boolean';
import { solveSOP } from './solver';

describe('Boolean expression to Karnaugh solver handoff', () => {
  const expressions = [
    "A'B + AB", 'A+AB', '(A+B)(A+C)', 'A^B', 'A XOR B', '!A', '~A', 'NOT A',
    'A.B', 'A*B', 'A&B', 'AB', 'A+B', 'A|B', 'A OR B', '1', '0', 'A!',
  ];

  it.each(expressions)('parses, solves, and preserves the truth table for %s', (expression) => {
    const parsed = parse(expression);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const variables = [...parsed.variables];
    for (const name of ['A', 'B', 'C', 'D', 'E']) if (variables.length < 2 && !variables.includes(name)) variables.push(name);
    expect(variables.length).toBeLessThanOrEqual(5);
    const tableResult = buildTruthTable(parsed.ast, variables);
    expect(tableResult.ok).toBe(true);
    if (!tableResult.ok) return;
    const minterms = tableResult.table.rows.filter((row) => row.output === 1).map((row) => row.index);
    const solution = solveSOP(variables.length, minterms, [], variables);
    expect(solution.ok).toBe(true);
    if (!solution.ok) return;
    const minimized = buildTruthTable(solution.solution.expression, variables);
    expect(minimized.ok).toBe(true);
    if (minimized.ok) expect(minimized.table.rows.map((row) => row.output)).toEqual(tableResult.table.rows.map((row) => row.output));
  });

  it('reports invalid syntax instead of sending partial input to the solver', () => {
    expect(parse('A +')).toMatchObject({ ok: false });
  });
});
