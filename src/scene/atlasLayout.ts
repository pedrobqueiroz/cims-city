import * as THREE from 'three';
import type { AtlasScopeId } from '../data/schema';

export type DistrictId = 'cims' | 'new-zema' | 'hycatt' | 'uds' | 'htw-saar';

export interface DistrictLayout {
  readonly id: DistrictId;
  readonly center: THREE.Vector3;
  readonly bounds: THREE.Box3;
  readonly entityIds: readonly string[];
}

type Point = readonly [number, number];
type Position = readonly [number, number, number];

export const SEI_LAND_POINTS: readonly Point[] = Object.freeze([
  [-200, -200], [-200, 200], [200, 200], [200, -200],
]);

const SEI_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-200, -1, -200),
  new THREE.Vector3(200, 10, 200),
);

const ENTITY_POSITIONS: ReadonlyMap<string, Position> = new Map([
  ['sei', [0, 0, 2]],
  ['cims-hub', [-60, 0, -20]],
  ['elastocalorics', [-60, 0, -60]],
  ['electroactive-polymers', [-20, 0, -40]],
  ['smart-material-electronics', [-40, 0, 20]],
  ['smart-textiles', [-80, 0, 20]],
  ['shape-memory-alloys', [-80, 0, -40]],
  ['soft-robotics-lab', [10, 0, 30]],
  ['new-zema', [60, 0, -50]],
  ['hycatt', [70, 0, 30]],
  ['uds', [-100, 0, 80]],
  ['htw-saar', [-10, 0, 80]],
]);

function district(
  id: DistrictId,
  min: Position,
  max: Position,
  entityIds: readonly string[],
): DistrictLayout {
  const bounds = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
  return Object.freeze({
    id,
    center: bounds.getCenter(new THREE.Vector3()),
    bounds,
    entityIds: Object.freeze([...entityIds]),
  });
}

export const DISTRICT_LAYOUT: ReadonlyMap<DistrictId, DistrictLayout> = new Map([
  ['cims', district('cims', [-90, -1, -70], [20, 10, 40], [
    'cims-hub',
    'elastocalorics',
    'electroactive-polymers',
    'smart-material-electronics',
    'smart-textiles',
    'shape-memory-alloys',
  ])],
  ['new-zema', district('new-zema', [40, -1, -70], [90, 10, -30], ['new-zema'])],
  ['hycatt', district('hycatt', [50, -1, 10], [100, 10, 60], ['hycatt'])],
  ['uds', district('uds', [-120, -1, 60], [-80, 10, 110], ['uds'])],
  ['htw-saar', district('htw-saar', [-30, -1, 60], [20, 10, 110], ['htw-saar'])],
]);

export function scopeBounds(scopeId: AtlasScopeId): THREE.Box3 {
  return (scopeId === 'sei' ? SEI_BOUNDS : DISTRICT_LAYOUT.get('cims')!.bounds).clone();
}

export function worldPositionFor(entityId: string): THREE.Vector3 {
  const position = ENTITY_POSITIONS.get(entityId);
  if (!position) throw new Error(`Missing atlas position: ${entityId}`);
  return new THREE.Vector3(...position);
}
