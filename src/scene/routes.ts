import * as THREE from 'three';
import type { RelationshipKind } from '../data/schema';
import type { MaterialPalette } from './materials';

export interface RouteStyle {
  dashed: boolean;
  width: number;
  elevation: number;
}

const styles: Readonly<Record<RelationshipKind, RouteStyle>> = {
  coordinates: { dashed: false, width: 0.48, elevation: 0.035 },
  contains: { dashed: false, width: 0.34, elevation: 0.035 },
  adjacent: { dashed: true, width: 0.26, elevation: 0.04 },
  collaborates: { dashed: true, width: 0.18, elevation: 0.045 },
};

const geometriesByRoute = new WeakMap<THREE.Group, Set<THREE.BufferGeometry>>();
const disposedRoutes = new WeakSet<THREE.Group>();

export function routeStyleFor(kind: RelationshipKind): RouteStyle {
  return { ...styles[kind] };
}

function assertPoints(points: readonly (readonly [number, number, number])[]): void {
  if (points.length < 2 || points.some((point) => !Array.isArray(point)
    || point.length !== 3 || point.some((coordinate) => !Number.isFinite(coordinate)))) {
    throw new TypeError('Routes require at least two finite [x, y, z] points');
  }
}

function addSolidSegment(
  route: THREE.Group,
  geometries: Set<THREE.BufferGeometry>,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  style: RouteStyle,
  material: THREE.Material,
): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  if (length === 0) return;
  const geometry = new THREE.BoxGeometry(length, style.width, style.width);
  const segment = new THREE.Mesh(geometry, material);
  segment.name = 'route:solid-segment';
  segment.position.set((from[0] + to[0]) / 2, style.elevation, (from[2] + to[2]) / 2);
  segment.rotation.y = -Math.atan2(dz, dx);
  route.add(segment);
  geometries.add(geometry);
}

function addDashedSegment(
  route: THREE.Group,
  geometries: Set<THREE.BufferGeometry>,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  style: RouteStyle,
  material: THREE.Material,
): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  if (length === 0) return;

  const count = Math.max(1, Math.ceil(length / 0.62));
  const spacing = length / count;
  const dashLength = Math.min(0.38, spacing * 0.65);
  const geometry = new THREE.BoxGeometry(1, style.width, style.width);
  const dashes = new THREE.InstancedMesh(geometry, material, count);
  dashes.name = 'route:dashes';
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
  const scale = new THREE.Vector3(dashLength, 1, 1);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index += 1) {
    const distance = (index + 0.5) * spacing;
    matrix.compose(
      new THREE.Vector3(from[0] + dx * distance / length, style.elevation, from[2] + dz * distance / length),
      rotation,
      scale,
    );
    dashes.setMatrixAt(index, matrix);
  }
  dashes.instanceMatrix.needsUpdate = true;
  route.add(dashes);
  geometries.add(geometry);
}

export function createRoute(
  kind: RelationshipKind,
  points: readonly (readonly [number, number, number])[],
  palette: MaterialPalette,
): THREE.Group {
  assertPoints(points);
  const style = routeStyleFor(kind);
  const route = new THREE.Group();
  route.name = `route:${kind}`;
  route.userData = { kind, style, emphasis: 'normal' };
  const geometries = new Set<THREE.BufferGeometry>();
  const material = kind === 'adjacent' ? palette.selectionEdge
    : kind === 'collaborates' ? palette.context
      : palette.path;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    if (style.dashed) addDashedSegment(route, geometries, from, to, style, material);
    else addSolidSegment(route, geometries, from, to, style, material);
  }
  geometriesByRoute.set(route, geometries);
  return route;
}

export function disposeRoute(route: THREE.Group): void {
  if (disposedRoutes.has(route)) return;
  disposedRoutes.add(route);
  for (const geometry of geometriesByRoute.get(route) ?? []) geometry.dispose();
}
