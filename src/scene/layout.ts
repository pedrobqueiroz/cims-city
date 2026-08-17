import { ENTITY_BY_ID } from '../data/entities';
import { worldPositionFor } from './atlasLayout';

export interface LayoutNode {
  entityId: string;
  position: readonly [number, number, number];
  footprint: readonly [number, number];
  focus: { target: readonly [number, number, number]; distance: number };
}

export const GROUP_IDS: readonly string[] = [
  'elastocalorics',
  'electroactive-polymers',
  'smart-material-electronics',
  'smart-textiles',
  'shape-memory-alloys',
];
export const GROUP_RADIUS = 30;
export const GROUP_FOOTPRINT: readonly [number, number] = [14, 10];
export const OVERVIEW_FOCUS: { target: readonly [number, number, number]; distance: 120 } = {
  target: [0, 3, 0],
  distance: 120,
};

function campusNode(entityId: string, position: readonly [number, number, number], footprint: readonly [number, number], distance: number): LayoutNode {
  return { entityId, position, footprint, focus: { target: [position[0], 3, position[2]], distance } };
}

const cimsHubPosition = worldPositionFor('cims-hub');
const groupNodes = GROUP_IDS.map((entityId, index) => {
  const angle = ([-90, -18, 54, 126, 198][index]! * Math.PI) / 180;
  return campusNode(entityId, [
    cimsHubPosition.x + Math.cos(angle) * GROUP_RADIUS,
    0,
    cimsHubPosition.z + Math.sin(angle) * GROUP_RADIUS,
  ], GROUP_FOOTPRINT, 25);
});

const seiNode: LayoutNode = {
  entityId: 'sei',
  position: [0, 0, 2],
  footprint: [8, 5],
  focus: OVERVIEW_FOCUS,
};

export const LAYOUT_BY_ID: ReadonlyMap<string, LayoutNode> = new Map([
  seiNode,
  campusNode('cims-hub', [-60, 0, -20], [20, 14], 30),
  ...groupNodes,
  campusNode('soft-robotics-lab', [10, 0, 30], [14, 10], 25),
  campusNode('hycatt', [70, 0, 30], [16, 12], 30),
  campusNode('new-zema', [60, 0, -50], [16, 12], 30),
  campusNode('uds', [-100, 0, 80], [12, 8], 25),
  campusNode('htw-saar', [-10, 0, 80], [12, 8], 25),
].map((node) => [node.entityId, node]));

export function validateLayout(entityIds: readonly string[], layout: ReadonlyMap<string, LayoutNode>): string[] {
  const errors: string[] = [];
  const primaryPositions = new Map<string, string>();
  for (const entityId of entityIds) {
    const node = layout.get(entityId);
    if (!node) {
      errors.push(`Missing layout entity: ${entityId}`);
      continue;
    }
    if (![...node.position, ...node.focus.target, node.focus.distance].every(Number.isFinite)) errors.push(`Non-finite layout coordinate: ${entityId}`);
    if (ENTITY_BY_ID.get(entityId)?.detailLevel === 'primary') {
      const key = node.position.join(',');
      const duplicate = primaryPositions.get(key);
      if (duplicate) errors.push(`Duplicate primary layout position: ${duplicate} and ${entityId}`);
      else primaryPositions.set(key, entityId);
    }
  }

  const groups = GROUP_IDS.map((entityId) => layout.get(entityId)).filter((node): node is LayoutNode => Boolean(node));
  const firstGroup = groups[0];
  if (firstGroup) {
    const hubPosition = layout.get('cims-hub')?.position ?? [0, 0, 0];
    const expectedRadius = horizontalRadius(firstGroup.position, hubPosition);
    for (const node of groups.slice(1)) {
      if (!samePair(node.footprint, firstGroup.footprint)) errors.push(`Research-group footprint mismatch: ${node.entityId}`);
      if (node.position[1] !== firstGroup.position[1]) errors.push(`Research-group elevation mismatch: ${node.entityId}`);
      if (Math.abs(horizontalRadius(node.position, hubPosition) - expectedRadius) > 1e-6) errors.push(`Research-group ring radius mismatch: ${node.entityId}`);
      if (node.focus.distance !== firstGroup.focus.distance) errors.push(`Research-group focus distance mismatch: ${node.entityId}`);
    }
  }
  return errors;
}

export function assertLayout(entityIds: readonly string[]): string[] {
  return validateLayout(entityIds, LAYOUT_BY_ID);
}

function horizontalRadius(
  position: readonly [number, number, number],
  origin: readonly [number, number, number],
): number {
  return Math.hypot(position[0] - origin[0], position[2] - origin[2]);
}

function samePair(left: readonly [number, number], right: readonly [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}
