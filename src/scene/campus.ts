import * as THREE from 'three';
import type { AtlasScopeId } from '../data/schema';
import type { NeighborhoodEntity, RelationshipKind } from '../data/schema';
import { DISTRICT_LAYOUT, scopeBounds as atlasScopeBounds, type DistrictId } from './atlasLayout';
import { createEntityBuilding, disposeEntityVisual, type EntityVisual } from './buildings';
import type { LayoutNode } from './layout';
import type { MaterialPalette } from './materials';
import { createRoute, disposeRoute } from './routes';

export interface CampusVisual {
  root: THREE.Group;
  entityVisuals: ReadonlyMap<string, EntityVisual>;
  selectionProxies: readonly THREE.Mesh[];
  dispose(): void;
}

export interface AtlasCampusVisual extends CampusVisual {
  districtGroups: ReadonlyMap<DistrictId, THREE.Group>;
  scopeBounds: ReadonlyMap<AtlasScopeId, THREE.Box3>;
}

type VisibleRelationshipKind = Exclude<RelationshipKind, 'contains'>;
type Point = readonly [number, number];

const contextPoints: Readonly<Record<'trees' | 'lamps' | 'bollards', readonly Point[]>> = {
  trees: [
    [-36, -18], [34, 18], [-21, -31], [16, 31], [2, -34], [-9, 32],
    [25, -27], [-31, 20], [37, -7], [8, 25], [14, -31], [-21, 28],
    [37, 6], [-31, -26], [27, 27], [-10, -34], [34, -18], [4, 33],
  ],
  lamps: [
    [-29, -16], [28, 16], [-17, -27], [16, 27], [0, -29], [0, 29],
    [20, -23], [-21, 23], [30, -3], [5, 24], [27, -14], [-27, 14],
  ],
  bollards: [
    [-52, -12], [27, 11], [-48, -26], [20, 21], [-9, -27], [9, 27],
    [4, -28], [-4, 28], [16, -24], [-16, 24], [24, -17], [-24, 17],
    [28, -5], [-52, 8], [28, 6], [-50, -3], [23, 18], [-44, -21],
    [13, 25], [-13, -25],
  ],
};

function group(name: string): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  return result;
}

function validateArgs(
  entities: readonly NeighborhoodEntity[],
  layout: ReadonlyMap<string, LayoutNode>,
  contextDensity: number,
): void {
  if (!Number.isFinite(contextDensity) || contextDensity < 0 || contextDensity > 1) {
    throw new TypeError('contextDensity must be finite and between 0 and 1');
  }
  const entityIds = new Set<string>();
  for (const entity of entities) {
    if (entityIds.has(entity.id)) throw new TypeError(`Duplicate entity id: ${entity.id}`);
    entityIds.add(entity.id);
    if (!layout.has(entity.id)) throw new TypeError(`Missing layout for entity: ${entity.id}`);
  }
}

function addInstances(
  root: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  points: readonly Point[],
  density: number,
  elevation: number,
  owned: Set<THREE.BufferGeometry>,
): void {
  const count = Math.round(points.length * density);
  owned.add(geometry);
  if (count === 0) return;
  const instances = new THREE.InstancedMesh(geometry, material, count);
  instances.name = name;
  instances.castShadow = true;
  instances.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index += 1) {
    const point = points[index]!;
    matrix.makeTranslation(point[0], elevation, point[1]);
    instances.setMatrixAt(index, matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  root.add(instances);
}

function createContext(
  palette: MaterialPalette,
  density: number,
  owned: Set<THREE.BufferGeometry>,
): THREE.Group {
  const root = group('context');
  if (density === 0) return root;
  addInstances(
    root,
    'context:trees',
    new THREE.ConeGeometry(0.9, 3.8, 6),
    palette.context,
    contextPoints.trees,
    density,
    1.9,
    owned,
  );
  addInstances(
    root,
    'context:lamps',
    new THREE.CylinderGeometry(0.12, 0.18, 3.2, 6),
    palette.darkMetal,
    contextPoints.lamps,
    density,
    1.6,
    owned,
  );
  addInstances(
    root,
    'context:bollards',
    new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8),
    palette.sma,
    contextPoints.bollards,
    density,
    0.45,
    owned,
  );
  return root;
}

function createRoutes(
  entities: readonly NeighborhoodEntity[],
  layout: ReadonlyMap<string, LayoutNode>,
  palette: MaterialPalette,
  containers: Readonly<Record<VisibleRelationshipKind, THREE.Group>>,
): THREE.Group[] {
  const routes: THREE.Group[] = [];
  const entityIds = new Set(entities.map((entity) => entity.id));
  const created = new Set<string>();
  for (const entity of entities) {
    for (const relationship of entity.relationships) {
      if (relationship.kind === 'contains' || !entityIds.has(relationship.targetId)) continue;
      const key = `${relationship.kind}:${[entity.id, relationship.targetId].sort().join(':')}`;
      if (created.has(key)) continue;
      created.add(key);
      const hubIsTarget = relationship.targetId === 'cims-hub'
        && (relationship.kind === 'adjacent' || relationship.kind === 'collaborates');
      const sourceId = hubIsTarget ? relationship.targetId : entity.id;
      const targetId = hubIsTarget ? entity.id : relationship.targetId;
      const source = layout.get(sourceId)!;
      const target = layout.get(targetId)!;
      const points = [
        [source.position[0], 0, source.position[2]],
        [target.position[0], 0, target.position[2]],
      ] as const;
      const route = createRoute(relationship.kind, points, palette);
      route.userData = {
        ...route.userData,
        sourceId,
        targetId,
        points,
      };
      containers[relationship.kind].add(route);
      routes.push(route);
    }
  }
  return routes;
}

export function createCampus(args: {
  entities: readonly NeighborhoodEntity[];
  layout: ReadonlyMap<string, LayoutNode>;
  palette: MaterialPalette;
  contextDensity?: number;
}): AtlasCampusVisual {
  const contextDensity = args.contextDensity ?? 1;
  validateArgs(args.entities, args.layout, contextDensity);

  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const root = group('campus');
  const districtGroups = new Map<DistrictId, THREE.Group>(
    [...DISTRICT_LAYOUT.keys()].map((id) => [id, group(`district:${id}`)]),
  );
  const adjacentCims = group('adjacent:cims');
  const routeContainers = {
    coordinates: group('routes:coordinates'),
    adjacent: group('routes:adjacent'),
    collaborates: group('routes:collaborates'),
  } as const;
  const entityVisuals = new Map<string, EntityVisual>();
  const selectionProxies: THREE.Mesh[] = [];
  let landVisual: EntityVisual | undefined;
  for (const entity of args.entities) {
    const visual = createEntityBuilding(entity, args.layout.get(entity.id)!, args.palette);
    entityVisuals.set(entity.id, visual);
    selectionProxies.push(visual.proxy);
    if (entity.id === 'sei') {
      landVisual = visual;
    } else if (entity.id === 'soft-robotics-lab') {
      adjacentCims.add(visual.root);
    } else {
      const district = [...DISTRICT_LAYOUT.values()].find((candidate) => candidate.entityIds.includes(entity.id));
      districtGroups.get(district?.id ?? entity.id as DistrictId)?.add(visual.root);
    }
  }
  const routes = createRoutes(args.entities, args.layout, args.palette, routeContainers);
  if (landVisual) root.add(landVisual.root);
  root.add(
    ...districtGroups.values(),
    adjacentCims,
    routeContainers.coordinates,
    routeContainers.adjacent,
    routeContainers.collaborates,
    createContext(args.palette, contextDensity, ownedGeometries),
  );
  const scopeBounds = new Map<AtlasScopeId, THREE.Box3>([
    ['sei', atlasScopeBounds('sei')],
    ['cims', atlasScopeBounds('cims')],
  ]);

  let disposed = false;
  return {
    root,
    entityVisuals,
    selectionProxies,
    districtGroups,
    scopeBounds,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const visual of [...entityVisuals.values()].reverse()) disposeEntityVisual(visual);
      for (const route of [...routes].reverse()) disposeRoute(route);
      for (const geometry of [...ownedGeometries].reverse()) geometry.dispose();
      root.removeFromParent();
    },
  };
}
