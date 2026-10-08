import { describe, it, expect } from 'vitest';
import type { BoolNode } from './ast';
import { createEmptyDesignProject } from './designProject';

/**
 * Exhaustive evaluation verifying that all BoolNode variants are handled.
 * The default case uses a `never` assignment to guarantee compile-time exhaustiveness.
 */
function formatNodeType(node: BoolNode): string {
  switch (node.type) {
    case 'constant':
      return `const:${node.value}`;
    case 'variable':
      return `var:${node.name}`;
    case 'not':
      return `not(${formatNodeType(node.child)})`;
    case 'and':
      return `and(${node.children.map(formatNodeType).join(',')})`;
    case 'or':
      return `or(${node.children.map(formatNodeType).join(',')})`;
    case 'xor':
      return `xor(${formatNodeType(node.left)},${formatNodeType(node.right)})`;
    case 'nand':
      return `nand(${formatNodeType(node.left)},${formatNodeType(node.right)})`;
    case 'nor':
      return `nor(${formatNodeType(node.left)},${formatNodeType(node.right)})`;
    case 'xnor':
      return `xnor(${formatNodeType(node.left)},${formatNodeType(node.right)})`;
    default: {
      const _exhaustiveCheck: never = node;
      return _exhaustiveCheck;
    }
  }
}

describe('Stage 1 Type System Verification', () => {
  it('creates empty design project and round-trips with BoolNode via JSON', () => {
    const project = createEmptyDesignProject(
      'proj-101',
      'Test Combinational Circuit'
    );

    const sampleExpression: BoolNode = {
      type: 'and',
      children: [
        { type: 'variable', name: 'A' },
        {
          type: 'not',
          child: { type: 'variable', name: 'B' },
        },
      ],
    };

    project.variables = ['A', 'B'];
    project.expression = sampleExpression;

    const serialized = JSON.stringify(project);
    const parsed = JSON.parse(serialized);

    expect(parsed).toEqual(project);
  });

  it('compiles and executes exhaustive switch over all BoolNode discriminator kinds', () => {
    const nodes: readonly BoolNode[] = [
      { type: 'constant', value: 1 },
      { type: 'variable', name: 'X' },
      { type: 'not', child: { type: 'constant', value: 0 } },
      { type: 'and', children: [{ type: 'variable', name: 'A' }] },
      { type: 'or', children: [{ type: 'variable', name: 'B' }] },
      {
        type: 'xor',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      },
      {
        type: 'nand',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      },
      {
        type: 'nor',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      },
      {
        type: 'xnor',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      },
    ];

    for (const node of nodes) {
      expect(typeof formatNodeType(node)).toBe('string');
    }
  });
});
