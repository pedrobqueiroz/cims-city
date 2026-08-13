import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITIES } from '../data/entities';
import type { NeighborhoodEntity, RelationshipKind } from '../data/schema';
import { DISTRICT_LAYOUT, scopeBounds } from './atlasLayout';
import { createCampus, type AtlasCampusVisual } from './campus';
import { LAYOUT_BY_ID, type LayoutNode } from './layout';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';

const campuses: AtlasCampusVisual[] = [];
const palettes: MaterialPalette[] = [];

function build(
  options: {
    entities?: readonly NeighborhoodEntity[];
    layout?: ReadonlyMap<string, LayoutNode>;
    contextDensity?: number;
    palette?: MaterialPalette;
  } = {},
): AtlasCampusVisual {
  const palette = options.palette ?? createMaterialPalette();
  if (!palettes.includes(palette)) palettes.push(palette);
  const campus = createCampus({
    entities: options.entities ?? ENTITIES,
    layout: options.layout ?? LAYOUT_BY_ID,
    palette,
    ...(options.contextDensity === undefined ? {} : { contextDensity: options.contextDensity }),
  });
  campuses.push(campus);
  return campus;
}

function directGroup(campus: AtlasCampusVisual, name: string): THREE.Group {
  const child = campus.root.children.find((candidate) => candidate.name === name);
  expect(child, name).toBeInstanceOf(THREE.Group);
  return child as THREE.Group;
}

function routeGroups(campus: AtlasCampusVisual, kind: Exclude<RelationshipKind, 'contains'>): THREE.Group[] {
  return directGroup(campus, `routes:${kind}`).children.filter(
    (child): child is THREE.Group => child instanceof THREE.Group,
  );
}

function contextCounts(campus: AtlasCampusVisual): Record<string, number> {
  return Object.fromEntries(directGroup(campus, 'context').children.map((child) => [child.name, (child as THREE.InstancedMesh).count]));
}

function instanceWorldBox(instances: THREE.InstancedMesh, index: number): THREE.Box3 {
  instances.geometry.computeBoundingBox();
  const bounds = instances.geometry.boundingBox;
  if (!bounds) throw new Error('Missing context geometry bounds');
  const matrix = new THREE.Matrix4();
  instances.getMatrixAt(index, matrix);
  matrix.premultiply(instances.matrixWorld);
  return bounds.clone().applyMatrix4(matrix);
}

afterEach(() => {
  for (const campus of campuses.splice(0)) campus.dispose();
  for (const palette of palettes.splice(0)) disposeMaterialPalette(palette);
  vi.restoreAllMocks();
});

describe('campus assembly', () => {
  it('uses SEi as land and assembles entities under semantic district groups', () => {
    const campus = build();

    expect(campus.root.name).toBe('campus');
    expect(campus.root.children.map((child) => child.name)).toEqual(expect.arrayContaining([
      'land:sei',
      'district:cims',
      'district:new-zema',
      'district:hycatt',
      'district:uds',
      'district:htw-saar',
      'adjacent:cims',
      'routes:coordinates',
      'routes:adjacent',
      'routes:collaborates',
      'context',
    ]));
    expect([...campus.districtGroups.keys()]).toEqual([...DISTRICT_LAYOUT.keys()]);
    expect(campus.root.getObjectByName('district:cims')?.getObjectByName('entity:cims-hub')).toBeDefined();
    expect(campus.root.getObjectByName('district:cims')?.getObjectByName('entity:elastocalorics')).toBeDefined();
    expect(campus.root.getObjectByName('adjacent:cims')?.getObjectByName('entity:soft-robotics-lab')).toBeDefined();
    expect(campus.root.getObjectByName('entity:sei')).toBeUndefined();
    expect(campus.root.getObjectByName('boundary:sei')).toBeUndefined();
    expect(campus.scopeBounds.get('sei')?.equals(scopeBounds('sei'))).toBe(true);
    expect(campus.scopeBounds.get('cims')?.equals(scopeBounds('cims'))).toBe(true);
  });

  it('builds every supplied entity visual and selection proxy in input order at its layout position', () => {
    const entities = [ENTITIES[5]!, ENTITIES[1]!, ENTITIES[8]!];
    const campus = build({ entities, contextDensity: 0 });

    expect([...campus.entityVisuals.keys()]).toEqual(entities.map((entity) => entity.id));
    expect(campus.selectionProxies).toEqual(entities.map((entity) => campus.entityVisuals.get(entity.id)?.proxy));
    expect(campus.districtGroups.get('cims')?.children.map((child) => child.name)).toEqual([
      'entity:smart-textiles',
      'entity:cims-hub',
    ]);
    expect(campus.districtGroups.get('hycatt')?.children.map((child) => child.name)).toEqual(['entity:hycatt']);
    for (const entity of entities) {
      const visual = campus.entityVisuals.get(entity.id)!;
      expect(visual).toBeDefined();
      expect(visual.root.position.toArray()).toEqual([...LAYOUT_BY_ID.get(entity.id)!.position]);
      expect(visual.proxy.userData.entityId).toBe(entity.id);
    }
  });

  it('derives only unique visible relationship routes under their semantic parents', () => {
    const campus = build({ contextDensity: 0 });

    expect(routeGroups(campus, 'coordinates')).toHaveLength(5);
    expect(routeGroups(campus, 'adjacent')).toHaveLength(1);
    expect(routeGroups(campus, 'collaborates')).toHaveLength(2);
    expect(campus.root.getObjectByName('route:contains')).toBeUndefined();

    const pairs = (kind: Exclude<RelationshipKind, 'contains'>) => routeGroups(campus, kind).map((route) => [
      route.userData.sourceId,
      route.userData.targetId,
    ]);
    expect(pairs('coordinates')).toEqual([
      ['cims-hub', 'elastocalorics'],
      ['cims-hub', 'electroactive-polymers'],
      ['cims-hub', 'smart-material-electronics'],
      ['cims-hub', 'smart-textiles'],
      ['cims-hub', 'shape-memory-alloys'],
    ]);
    expect(pairs('adjacent')).toEqual([['cims-hub', 'soft-robotics-lab']]);
    expect(pairs('collaborates')).toEqual([
      ['cims-hub', 'uds'],
      ['cims-hub', 'htw-saar'],
    ]);
  });

  it('records route endpoints at the related layout x/z positions with ground-level input y', () => {
    const campus = build({ contextDensity: 0 });

    for (const kind of ['coordinates', 'adjacent', 'collaborates'] as const) {
      for (const route of routeGroups(campus, kind)) {
        const source = LAYOUT_BY_ID.get(route.userData.sourceId as string)!;
        const target = LAYOUT_BY_ID.get(route.userData.targetId as string)!;
        expect(route.userData.points).toEqual([
          [source.position[0], 0, source.position[2]],
          [target.position[0], 0, target.position[2]],
        ]);
      }
    }
  });

  it('keeps reciprocal adjacent and collaboration routes oriented from the hub when input order changes', () => {
    const orderedIds = [
      'uds',
      'htw-saar',
      'soft-robotics-lab',
      'cims-hub',
      'elastocalorics',
      'electroactive-polymers',
      'smart-material-electronics',
      'smart-textiles',
      'shape-memory-alloys',
    ];
    const entities = orderedIds.map((id) => ENTITIES.find((entity) => entity.id === id)!);
    const campus = build({ entities, contextDensity: 0 });

    expect(routeGroups(campus, 'adjacent').map((route) => [route.userData.sourceId, route.userData.targetId])).toEqual([
      ['cims-hub', 'soft-robotics-lab'],
    ]);
    expect(routeGroups(campus, 'collaborates').map((route) => [route.userData.sourceId, route.userData.targetId])).toEqual([
      ['cims-hub', 'uds'],
      ['cims-hub', 'htw-saar'],
    ]);
  });

  it('rejects a missing layout for any supplied entity before creating a campus', () => {
    const layout = new Map(LAYOUT_BY_ID);
    layout.delete('smart-textiles');
    const palette = createMaterialPalette();
    palettes.push(palette);

    expect(() => createCampus({ entities: ENTITIES, layout, palette })).toThrowError(
      new TypeError('Missing layout for entity: smart-textiles'),
    );
  });

  it('rejects duplicate entity ids before any visual can be overwritten', () => {
    const hub = ENTITIES.find((entity) => entity.id === 'cims-hub')!;
    const palette = createMaterialPalette();
    palettes.push(palette);

    expect(() => createCampus({ entities: [hub, hub], layout: LAYOUT_BY_ID, palette })).toThrowError(
      new TypeError('Duplicate entity id: cims-hub'),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])('rejects invalid context density %s', (contextDensity) => {
    const palette = createMaterialPalette();
    palettes.push(palette);

    expect(() => createCampus({ entities: ENTITIES, layout: LAYOUT_BY_ID, palette, contextDensity })).toThrow(TypeError);
  });

  it('creates one irregular extruded SEi land visual with five lighter district clearings', () => {
    const palette = createMaterialPalette();
    const campus = build({ palette, contextDensity: 0 });
    const land = campus.entityVisuals.get('sei')!;
    const surface = land.visible.getObjectByName('land:sei:surface') as THREE.Mesh;
    const clearings = land.visible.children.filter((child) => child.name.startsWith('clearing:')) as THREE.Mesh[];

    expect(land.root.name).toBe('land:sei');
    expect(surface.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(surface.material).toBe(palette.ground);
    expect(clearings.map((clearing) => clearing.name)).toEqual([
      'clearing:cims',
      'clearing:new-zema',
      'clearing:hycatt',
      'clearing:uds',
      'clearing:htw-saar',
    ]);
    for (const clearing of clearings) expect(clearing.material).toBe(palette.path);
    expect(land.proxy.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((land.proxy.geometry as THREE.BoxGeometry).parameters).toMatchObject({ width: 113, height: 1, depth: 89 });
  });

  it('uses deterministic instanced context counts at full, half, and zero density', () => {
    const full = build({ contextDensity: 1 });
    const secondFull = build({ contextDensity: 1 });
    const half = build({ contextDensity: 0.5 });
    const secondHalf = build({ contextDensity: 0.5 });
    const zero = build({ contextDensity: 0 });

    expect(contextCounts(full)).toEqual({
      'context:trees': 18,
      'context:lamps': 12,
      'context:bollards': 20,
    });
    expect(contextCounts(secondFull)).toEqual(contextCounts(full));
    expect(contextCounts(half)).toEqual({
      'context:trees': 9,
      'context:lamps': 6,
      'context:bollards': 10,
    });
    expect(directGroup(zero, 'context').children).toEqual([]);

    for (const child of directGroup(full, 'context').children) expect(child).toBeInstanceOf(THREE.InstancedMesh);
    for (let index = 0; index < directGroup(full, 'context').children.length; index += 1) {
      const first = directGroup(full, 'context').children[index] as THREE.InstancedMesh;
      const second = directGroup(secondFull, 'context').children[index] as THREE.InstancedMesh;
      expect([...first.instanceMatrix.array]).toEqual([...second.instanceMatrix.array]);
      const firstHalf = directGroup(half, 'context').children[index] as THREE.InstancedMesh;
      const secondHalfMesh = directGroup(secondHalf, 'context').children[index] as THREE.InstancedMesh;
      expect([...firstHalf.instanceMatrix.array]).toEqual([...secondHalfMesh.instanceMatrix.array]);
    }
  });

  it('keeps every context instance outside the central hub and research-group pads', () => {
    const campus = build();
    const context = directGroup(campus, 'context');
    const protectedNodes = ENTITIES.filter((entity) => entity.category === 'hub' || entity.category === 'research-group')
      .map((entity) => LAYOUT_BY_ID.get(entity.id)!);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    for (const child of context.children as THREE.InstancedMesh[]) {
      for (let index = 0; index < child.count; index += 1) {
        child.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        for (const node of protectedNodes) {
          const outsideX = Math.abs(position.x - node.position[0]) > node.footprint[0] / 2 + 0.5;
          const outsideZ = Math.abs(position.z - node.position[2]) > node.footprint[1] / 2 + 0.5;
          expect(outsideX || outsideZ, `${child.name}:${index} overlaps ${node.entityId}`).toBe(true);
        }
      }
    }
  });

  it('keeps every context instance outside every non-land entity visual', () => {
    const campus = build();
    campus.root.updateMatrixWorld(true);
    const protectedMeshes = [...campus.entityVisuals]
      .filter(([id]) => id !== 'sei')
      .flatMap(([id, visual]) => {
        const meshes: Array<readonly [string, THREE.Box3]> = [];
        visual.visible.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshes.push([id + '/' + child.name, new THREE.Box3().setFromObject(child)]);
          }
        });
        return meshes;
      });

    for (const child of directGroup(campus, 'context').children as THREE.InstancedMesh[]) {
      for (let index = 0; index < child.count; index += 1) {
        const contextBounds = instanceWorldBox(child, index);
        for (const [entityMesh, visualBounds] of protectedMeshes) {
          const label = child.name + ':' + index + ' overlaps ' + entityMesh;
          expect(contextBounds.intersectsBox(visualBounds), label).toBe(false);
        }
      }
    }
  });

  it('uses the context, dark-metal, and SMA palette roles for context furniture', () => {
    const palette = createMaterialPalette();
    const campus = build({ palette });
    const context = directGroup(campus, 'context');

    expect((context.getObjectByName('context:trees') as THREE.InstancedMesh).material).toBe(palette.context);
    expect((context.getObjectByName('context:lamps') as THREE.InstancedMesh).material).toBe(palette.darkMetal);
    expect((context.getObjectByName('context:bollards') as THREE.InstancedMesh).material).toBe(palette.sma);
  });

  it('disposes context geometry allocated for categories that round to zero instances', () => {
    const campus = build({ entities: [], contextDensity: 0.03 });
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    campus.dispose();
    campus.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(3);
  });

  it('disposes entity visuals in reverse creation order and remains idempotent', () => {
    const entities = [ENTITIES[1]!, ENTITIES[2]!, ENTITIES[3]!];
    const campus = build({ entities, contextDensity: 0 });
    const disposes = entities.map((entity) => vi.spyOn(campus.entityVisuals.get(entity.id)!.proxy.geometry, 'dispose'));

    campus.dispose();
    campus.dispose();

    for (const dispose of disposes) expect(dispose).toHaveBeenCalledTimes(1);
    expect(disposes[2]!.mock.invocationCallOrder[0]).toBeLessThan(disposes[1]!.mock.invocationCallOrder[0]!);
    expect(disposes[1]!.mock.invocationCallOrder[0]).toBeLessThan(disposes[0]!.mock.invocationCallOrder[0]!);
  });

  it('disposes context, routes, and entities in reverse global creation order', () => {
    const campus = build();
    const contextGeometry = (directGroup(campus, 'context').children.at(-1) as THREE.InstancedMesh).geometry;
    const routeMesh = routeGroups(campus, 'coordinates')[0]!.children[0] as THREE.Mesh;
    const entityGeometry = campus.entityVisuals.get('sei')!.proxy.geometry;
    const contextDispose = vi.spyOn(contextGeometry, 'dispose');
    const routeDispose = vi.spyOn(routeMesh.geometry, 'dispose');
    const entityDispose = vi.spyOn(entityGeometry, 'dispose');

    campus.dispose();

    expect(contextDispose.mock.invocationCallOrder[0]).toBeLessThan(routeDispose.mock.invocationCallOrder[0]!);
    expect(routeDispose.mock.invocationCallOrder[0]).toBeLessThan(entityDispose.mock.invocationCallOrder[0]!);
  });

  it('disposes all owned geometry once, preserves palette materials, and detaches the root', () => {
    const palette = createMaterialPalette();
    const campus = build({ palette });
    const parent = new THREE.Group();
    parent.add(campus.root);
    const geometries = new Set<THREE.BufferGeometry>();
    campus.root.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.add(child.geometry);
    });
    const geometryDisposes = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const paletteDisposes = Object.values(palette).map((material) => vi.spyOn(material, 'dispose'));

    campus.dispose();
    campus.dispose();

    expect(parent.children).not.toContain(campus.root);
    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledTimes(1);
    for (const dispose of paletteDisposes) expect(dispose).not.toHaveBeenCalled();
  });
});
