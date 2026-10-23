/**
 * Cell-local Karnaugh map group outlines and the matching group legend.
 * Each fragment is mounted inside its member cell so wrap geometry never
 * depends on measuring or positioning a separate overlay canvas.
 */

import { type CSSProperties, type FC } from 'react';
import type { Cube } from '../../engine/kmap/layout';
import { cellAt, colHeaderLabels, rowHeaderLabels } from '../../engine/kmap/layout';

export interface VisualGroup {
  readonly id: string;
  readonly cube?: Cube;
  readonly cellIndices: readonly number[];
  readonly termString: string;
  readonly isEssential?: boolean;
}

export interface GroupOverlayProps {
  readonly groups: readonly VisualGroup[];
  readonly variableCount: number;
  readonly layerFilter?: number;
  readonly cellIndex?: number;
  readonly showLegend?: boolean;
  readonly onGroupHover?: (cellIndices: readonly number[] | null) => void;
}

export interface CellOutline {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
  readonly extendTop: boolean;
  readonly extendRight: boolean;
  readonly extendBottom: boolean;
  readonly extendLeft: boolean;
  readonly radiusTopLeft: boolean;
  readonly radiusTopRight: boolean;
  readonly radiusBottomRight: boolean;
  readonly radiusBottomLeft: boolean;
}

export const GROUP_COLORS = ['var(--group-1)', 'var(--group-2)', 'var(--group-3)', 'var(--group-4)', 'var(--group-5)', 'var(--group-6)'] as const;

export function groupsWithCareCells(
  groups: readonly VisualGroup[],
  values: readonly (0 | 1 | 'X')[],
  requiredValue: 0 | 1 = 1,
): VisualGroup[] {
  return groups.filter((group) => group.cellIndices.some((index) => values[index] === requiredValue));
}

export function getGroupStyle(index: number) {
  const color = GROUP_COLORS[index % GROUP_COLORS.length] ?? GROUP_COLORS[0];
  return {
    label: `G${index + 1}`,
    stroke: color,
    fill: `color-mix(in srgb, ${color} 9%, transparent)`,
    dashArray: 'none',
    strokeStyleName: 'solid',
  } as const;
}

const GROUP_COLOR_TOKENS = ['var(--group-1)', 'var(--group-2)', 'var(--group-3)', 'var(--group-4)', 'var(--group-5)', 'var(--group-6)'] as const;

export function getCellGroupIndices(groups: readonly VisualGroup[], cellIndex: number): number[] {
  return groups.flatMap((group, index) => group.cellIndices.includes(cellIndex) ? [index] : []);
}

export function getCellGroupShadows(groups: readonly VisualGroup[], cellIndex: number): string {
  return getCellGroupIndices(groups, cellIndex)
    .map((index) => `inset 0 0 0 3px ${GROUP_COLOR_TOKENS[index % GROUP_COLOR_TOKENS.length]}`)
    .join(', ');
}

/** Group ring is a separate layer so only its opacity animates when membership changes. */
export function CellGroupOutline({ groups, cellIndex }: { groups: readonly VisualGroup[]; cellIndex: number }) {
  const memberships = getCellGroupIndices(groups, cellIndex);
  if (memberships.length === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="kmap-cell-group-outline"
      style={{ '--group-shadows': getCellGroupShadows(groups, cellIndex) } as CSSProperties}
    />
  );
}

export function GroupBadges({ groups, cellIndex }: { groups: readonly VisualGroup[]; cellIndex: number }) {
  const memberships = getCellGroupIndices(groups, cellIndex);
  if (memberships.length === 0) return null;
  return (
    <span className="kmap-group-badges" aria-hidden="true">
      {memberships.map((index) => (
        <span key={`${groups[index]?.id}-${cellIndex}`} className="kmap-group-badge" style={{ '--kgroup': GROUP_COLOR_TOKENS[index % GROUP_COLOR_TOKENS.length] } as CSSProperties}>{index + 1}</span>
      ))}
    </span>
  );
}

interface Position { readonly row: number; readonly col: number; readonly layer: number; }

function positionOf(index: number, variableCount: number): Position | null {
  const rows = rowHeaderLabels(variableCount);
  const cols = colHeaderLabels(variableCount);
  const layers = variableCount === 5 ? 2 : 1;
  for (let layer = 0; layer < layers; layer += 1) {
    for (let row = 0; row < rows.length; row += 1) {
      for (let col = 0; col < cols.length; col += 1) {
        if (cellAt(row, col, layer, variableCount) === index) return { row, col, layer };
      }
    }
  }
  return null;
}

/** Returns the toroidal outline edges for one member cell. */
export function getCellOutline(
  cellIndices: readonly number[],
  variableCount: number,
  cellIndex: number,
): CellOutline | null {
  const cell = positionOf(cellIndex, variableCount);
  if (!cell || !cellIndices.includes(cellIndex)) return null;
  const positions = cellIndices.map((index) => ({ index, position: positionOf(index, variableCount) }))
    .filter((entry): entry is { index: number; position: Position } => entry.position !== null && entry.position.layer === cell.layer);
  const members = new Set(positions.map((entry) => entry.index));
  const rowCount = rowHeaderLabels(variableCount).length;
  const colCount = colHeaderLabels(variableCount).length;
  const fullRows = new Set(positions.map(({ position }) => position.row)).size === rowCount;
  const fullCols = new Set(positions.map(({ position }) => position.col)).size === colCount;
  const sides = {
    top: { index: cell.row === 0 ? cellAt(rowCount - 1, cell.col, cell.layer, variableCount) : cellAt(cell.row - 1, cell.col, cell.layer, variableCount), wrap: cell.row === 0, full: fullRows },
    right: { index: cellAt(cell.row, (cell.col + 1) % colCount, cell.layer, variableCount), wrap: cell.col === colCount - 1, full: fullCols },
    bottom: { index: cell.row === rowCount - 1 ? cellAt(0, cell.col, cell.layer, variableCount) : cellAt(cell.row + 1, cell.col, cell.layer, variableCount), wrap: cell.row === rowCount - 1, full: fullRows },
    left: { index: cellAt(cell.row, (cell.col + colCount - 1) % colCount, cell.layer, variableCount), wrap: cell.col === 0, full: fullCols },
  };
  const joins = Object.fromEntries(Object.entries(sides).map(([side, neighbor]) => [
    side,
    members.has(neighbor.index) && !(neighbor.wrap && neighbor.full),
  ])) as Record<keyof typeof sides, boolean>;
  const top = !joins.top;
  const right = !joins.right;
  const bottom = !joins.bottom;
  const left = !joins.left;
  return {
    top, right, bottom, left,
    extendTop: joins.top && !sides.top.wrap,
    extendRight: joins.right && !sides.right.wrap,
    extendBottom: joins.bottom && !sides.bottom.wrap,
    extendLeft: joins.left && !sides.left.wrap,
    radiusTopLeft: top && left,
    radiusTopRight: top && right,
    radiusBottomRight: bottom && right,
    radiusBottomLeft: bottom && left,
  };
}

function GroupFragment({
  groupIndex,
  group,
  cellIndex,
  variableCount,
}: {
  groupIndex: number;
  group: VisualGroup;
  cellIndex: number;
  variableCount: number;
}) {
  const outline = getCellOutline(group.cellIndices, variableCount, cellIndex);
  if (!outline) return null;
  const offset = groupIndex * 4 - 3;
  const inset = (extend: boolean) => `${offset - (extend ? 4 : 0)}px`;
  const { stroke, fill } = getGroupStyle(groupIndex);
  const style = {
    top: inset(outline.extendTop), right: inset(outline.extendRight),
    bottom: inset(outline.extendBottom), left: inset(outline.extendLeft),
    borderTop: outline.top ? `2.5px solid ${stroke}` : 0,
    borderRight: outline.right ? `2.5px solid ${stroke}` : 0,
    borderBottom: outline.bottom ? `2.5px solid ${stroke}` : 0,
    borderLeft: outline.left ? `2.5px solid ${stroke}` : 0,
    borderRadius: `${outline.radiusTopLeft ? 12 : 0}px ${outline.radiusTopRight ? 12 : 0}px ${outline.radiusBottomRight ? 12 : 0}px ${outline.radiusBottomLeft ? 12 : 0}px`,
    background: fill,
    zIndex: 2,
  } as CSSProperties;
  return <span aria-hidden="true" className="group-overlay-fragment" data-group={group.id} data-cell-index={cellIndex} style={style} />;
}

export const GroupOverlay: FC<GroupOverlayProps> = ({
  groups,
  variableCount,
  layerFilter,
  cellIndex,
  showLegend = false,
  onGroupHover,
}) => {
  if (cellIndex !== undefined) {
    return (
      <>
        {groups.map((group, index) => {
          const position = positionOf(cellIndex, variableCount);
          if (layerFilter !== undefined && position?.layer !== layerFilter) return null;
          return <GroupFragment key={`${group.id}-${cellIndex}`} groupIndex={index} group={group} cellIndex={cellIndex} variableCount={variableCount} />;
        })}
      </>
    );
  }

  if (!showLegend || groups.length === 0) return null;
  return (
    <div role="region" aria-label="K-Map Groups Legend" className="group-legend">
      <h4>Implicant Groups</h4>
      <div className="group-legend-list">
        {groups.map((group, index) => {
          const { stroke, fill, label } = getGroupStyle(index);
          const crossesLayers = variableCount === 5 && group.cellIndices.some((cell) => cell < 16) && group.cellIndices.some((cell) => cell >= 16);
          return (
            <button
              key={`legend-${group.id}`}
              type="button"
              className="group-legend-item"
              style={{ '--group-color': stroke, '--group-fill': fill } as CSSProperties}
              onMouseEnter={() => onGroupHover?.(group.cellIndices)}
              onMouseLeave={() => onGroupHover?.(null)}
              onFocus={() => onGroupHover?.(group.cellIndices)}
              onBlur={() => onGroupHover?.(null)}
              aria-label={`${label}: ${group.termString}, cells ${group.cellIndices.join(', ')}${group.isEssential ? ', essential implicant' : ''}${crossesLayers ? ', continues across map layers' : ''}`}
            >
              <span className="group-legend-swatch" aria-hidden="true">{label}</span>
              <span className="group-legend-details">
                <span className="group-legend-term">{group.termString}</span>
                <span className="group-legend-cells">Cells: [{group.cellIndices.join(', ')}]</span>
              </span>
              {group.isEssential && <span className="group-essential">Essential PI</span>}
              {crossesLayers && <span className="group-essential">Across layers</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
