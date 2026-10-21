import { useMemo, type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';
import { extractTruthTable } from '../../engine/circuit/extractTruthTable';

export const LiveCircuitTable: FC<{ graph: CircuitGraph; values: Readonly<Record<string, LogicValue>> }> = ({ graph, values }) => {
  const result = useMemo(() => extractTruthTable(graph), [graph]);
  if (!result.ok) return null;
  const { inputs, outputs, rows } = result.table;
  const currentInputNodes = new Map(graph.nodes.filter((node) => node.kind === 'input').map((node) => [node.label, node.id]));
  const activeRow = rows.find((row) => inputs.every((label, index) => {
    const nodeId = currentInputNodes.get(label);
    return nodeId && values[nodeId] === row.inputs[index];
  }));

  return (
    <section className="workflow-card circuit-live-table" aria-label="Live circuit truth table">
      <header className="workflow-card-header"><div className="workflow-step-heading"><h3>Live output table</h3></div></header>
      <div className="workflow-card-body overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>{[...inputs, ...outputs].map((label) => <th key={label} className="border-b border-gray-200 px-3 py-2 font-mono text-xs dark:border-gray-700">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.index} aria-current={activeRow?.index === row.index ? 'true' : undefined} className={activeRow?.index === row.index ? 'bg-blue-50 font-semibold dark:bg-blue-950/40' : ''}>
            {[...row.inputs, ...row.outputs].map((value, index) => <td key={`${row.index}-${index}`} className="border-b border-gray-100 px-3 py-2 font-mono tabular-nums dark:border-gray-800">{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
};
