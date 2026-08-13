import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RelationshipKind } from '../data/schema';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';
import { createRoute, disposeRoute, routeStyleFor } from './routes';

const palettes: MaterialPalette[] = [];
const routes: THREE.Group[] = [];

function palette(): MaterialPalette {
  const result = createMaterialPalette();
  palettes.push(result);
  return result;
}

function route(kind: RelationshipKind, points: readonly (readonly [number, number, number])[], materialPalette = palette()): THREE.Group {
  const result = createRoute(kind, points, materialPalette);
  routes.push(result);
  return result;
}

function descendants(root: THREE.Object3D): THREE.Object3D[] {
  const result: THREE.Object3D[] = [];
  root.traverse((child) => result.push(child));
  return result;
}

function meshMaterial(mesh: THREE.Mesh): THREE.Material {
  if (Array.isArray(mesh.material)) throw new Error('Expected one material');
  return mesh.material;
}

afterEach(() => {
  for (const created of routes.splice(0)) disposeRoute(created);
  for (const created of palettes.splice(0)) disposeMaterialPalette(created);
  vi.restoreAllMocks();
});

describe('semantic relationship routes', () => {
  it.each<readonly [RelationshipKind, { dashed: boolean; width: number; elevation: number }]>([
    ['coordinates', { dashed: false, width: 0.48, elevation: 0.035 }],
    ['contains', { dashed: false, width: 0.34, elevation: 0.035 }],
    ['adjacent', { dashed: true, width: 0.26, elevation: 0.04 }],
    ['collaborates', { dashed: true, width: 0.18, elevation: 0.045 }],
  ])('uses the prescribed semantic style for %s', (kind, expected) => {
    expect(routeStyleFor(kind)).toEqual(expected);
  });

  it.each<unknown>([
    [],
    [[0, 0, 0]],
    [[0, 0, 0], [Number.NaN, 0, 1]],
    [[0, 0, 0], [0, Number.POSITIVE_INFINITY, 1]],
    [[0, 0, 0], [0, 0, Number.NEGATIVE_INFINITY]],
  ])('rejects malformed route points', (points) => {
    expect(() => createRoute('coordinates', points as readonly (readonly [number, number, number])[], palette())).toThrow(TypeError);
  });

  it('names a route and exposes its relationship metadata', () => {
    const created = route('contains', [[-2, 3, 4], [6, -1, 4]]);

    expect(created.name).toBe('route:contains');
    expect(created.userData).toEqual({
      kind: 'contains',
      style: { dashed: false, width: 0.34, elevation: 0.035 },
      emphasis: 'normal',
    });
  });

  it('places solid segments on the x/z endpoints with continuous total coverage and heading', () => {
    const created = route('coordinates', [[0, 7, 0], [3, -2, 4], [3, 9, 9]]);
    const segments = descendants(created).filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);

    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.position.toArray())).toEqual([
      [1.5, 0.035, 2],
      [3, 0.035, 6.5],
    ]);
    expect(segments[0]?.rotation.y).toBeCloseTo(-Math.atan2(4, 3));
    expect(segments[1]?.rotation.y).toBeCloseTo(-Math.PI / 2);
    const lengths = segments.map((segment) => (segment.geometry as THREE.BoxGeometry).parameters.width);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBeCloseTo(10);
    for (const segment of segments) expect(meshMaterial(segment)).toBe(palettes[0]?.path);
  });

  it('uses separated instanced dashes with the adjacent selection-edge material', () => {
    const materialPalette = palette();
    const created = route('adjacent', [[0, 0, 0], [4, 0, 0]], materialPalette);
    const dashes = descendants(created).filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);

    expect(dashes).toHaveLength(1);
    expect(dashes[0]?.count).toBeGreaterThan(1);
    expect(meshMaterial(dashes[0]!)).toBe(materialPalette.selectionEdge);
    const matrix = new THREE.Matrix4();
    dashes[0]?.getMatrixAt(0, matrix);
    const firstX = new THREE.Vector3().setFromMatrixPosition(matrix).x;
    dashes[0]?.getMatrixAt(1, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).x - firstX).toBeGreaterThan(0.4);
  });

  it('uses the context material for collaboration dashes and no shader material anywhere in a route', () => {
    const materialPalette = palette();
    const created = route('collaborates', [[0, 0, 0], [0, 0, 3]], materialPalette);
    const meshes = descendants(created).filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);

    expect(meshes).toHaveLength(1);
    expect(meshMaterial(meshes[0]!)).toBe(materialPalette.context);
    for (const mesh of meshes) expect(meshMaterial(mesh)).not.toBeInstanceOf(THREE.ShaderMaterial);
  });

  it('disposes owned geometries once while preserving every shared palette material', () => {
    const materialPalette = palette();
    const created = route('adjacent', [[0, 0, 0], [5, 0, 0]], materialPalette);
    const geometries = new Set<THREE.BufferGeometry>();
    created.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.add(child.geometry);
    });
    const geometryDisposes = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const paletteDisposes = Object.values(materialPalette).map((material) => vi.spyOn(material, 'dispose'));

    disposeRoute(created);
    disposeRoute(created);

    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledTimes(1);
    for (const dispose of paletteDisposes) expect(dispose).not.toHaveBeenCalled();
  });
});
