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
  [-58, -20], [-54, -39], [47, -38], [55, -21], [55, 35],
  [38, 50], [-25, 50], [-58, 44],
]);

const SEI_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-58, -1, -39),
  new THREE.Vector3(55, 10, 50),
);

const ENTITY_POSITIONS: ReadonlyMap<string, Position> = new Map([
  ['sei', [0, 0, 2]],
  ['cims-hub', [-24, 0, -6]],
  ['elastocalorics', [-24, 0, -21]],
  ['electroactive-polymers', [-9.734152255572695, 0, -10.635254915624213]],
  ['smart-material-electronics', [-15.183221215612903, 0, 6.135254915624211]],
  ['smart-textiles', [-32.8167787843871, 0, 6.135254915624213]],
  ['shape-memory-alloys', [-38.265847744427305, 0, -10.63525491562421]],
  ['soft-robotics-lab', [4, 0, 12]],
  ['new-zema', [26, 0, -20]],
  ['hycatt', [31, 0, 15]],
  ['uds', [-42, 0, 35]],
  ['htw-saar', [-6, 0, 37]],
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
  ['cims', district('cims', [-47, -1, -30], [1, 8, 19], [
    'cims-hub',
    'elastocalorics',
    'electroactive-polymers',
    'smart-material-electronics',
    'smart-textiles',
    'shape-memory-alloys',
  ])],
  ['new-zema', district('new-zema', [8, -1, -34], [46, 8, -7], ['new-zema'])],
  ['hycatt', district('hycatt', [11, -1, 0], [52, 10, 31], ['hycatt'])],
  ['uds', district('uds', [-55, -1, 27], [-31, 8, 44], ['uds'])],
  ['htw-saar', district('htw-saar', [-20, -1, 28], [9, 9, 47], ['htw-saar'])],
]);

export function scopeBounds(scopeId: AtlasScopeId): THREE.Box3 {
  return (scopeId === 'sei' ? SEI_BOUNDS : DISTRICT_LAYOUT.get('cims')!.bounds).clone();
}

export function worldPositionFor(entityId: string): THREE.Vector3 {
  const position = ENTITY_POSITIONS.get(entityId);
  if (!position) throw new Error(`Missing atlas position: ${entityId}`);
  return new THREE.Vector3(...position);
}
