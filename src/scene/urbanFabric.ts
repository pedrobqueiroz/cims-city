import * as THREE from 'three';
import type { MaterialPalette } from './materials';

interface ContextBuilding {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  material: 'context' | 'groupShell' | 'civicHub';
}

const CONTEXT_BUILDINGS: readonly ContextBuilding[] = [
  // North of CiMS
  { position: [-30, 0, -38], size: [6, 2.4, 4], material: 'context' },
  { position: [-18, 0, -38], size: [5, 3.1, 4.5], material: 'groupShell' },
  { position: [-8, 0, -38], size: [7, 2.8, 5], material: 'context' },
  { position: [5, 0, -38], size: [5.5, 2.2, 4], material: 'groupShell' },
  { position: [18, 0, -38], size: [6, 3.5, 4.5], material: 'context' },

  // East of HyCatt/New ZeMA
  { position: [55, 0, -10], size: [5, 2.6, 4], material: 'context' },
  { position: [55, 0, 5], size: [6, 3.2, 5], material: 'groupShell' },
  { position: [55, 0, 20], size: [5, 2.4, 4], material: 'context' },
  { position: [55, 0, 35], size: [7, 2.8, 4.5], material: 'groupShell' },

  // South of htw saar
  { position: [-15, 0, 50], size: [6, 2.4, 4], material: 'context' },
  { position: [0, 0, 50], size: [5, 3.0, 4.5], material: 'groupShell' },
  { position: [15, 0, 50], size: [7, 2.6, 5], material: 'context' },
  { position: [30, 0, 50], size: [5.5, 2.2, 4], material: 'groupShell' },

  // West of UdS
  { position: [-58, 0, 20], size: [5, 2.8, 4], material: 'context' },
  { position: [-58, 0, 35], size: [6, 3.4, 4.5], material: 'groupShell' },
  { position: [-58, 0, 48], size: [5, 2.2, 4], material: 'context' },

  // Between districts
  { position: [10, 0, -10], size: [4, 2.0, 3.5], material: 'context' },
  { position: [20, 0, 5], size: [4.5, 2.6, 4], material: 'groupShell' },
  { position: [-10, 0, 20], size: [5, 2.4, 4], material: 'context' },
  { position: [15, 0, 30], size: [4, 2.2, 3.5], material: 'groupShell' },
  { position: [-30, 0, 15], size: [5, 2.8, 4.5], material: 'context' },

  // Far context (beyond SEI land)
  { position: [-65, 0, -20], size: [6, 3.0, 5], material: 'context' },
  { position: [-65, 0, 0], size: [5, 2.4, 4], material: 'groupShell' },
  { position: [62, 0, -25], size: [7, 2.8, 5], material: 'context' },
  { position: [62, 0, 10], size: [5, 3.2, 4.5], material: 'groupShell' },
  { position: [0, 0, -48], size: [6, 2.6, 5], material: 'context' },
  { position: [20, 0, -48], size: [5, 3.0, 4], material: 'groupShell' },
  { position: [40, 0, 55], size: [6, 2.4, 5], material: 'context' },
  { position: [-20, 0, 55], size: [5, 2.8, 4.5], material: 'groupShell' },
];

interface StreetSegment {
  from: readonly [number, number];
  to: readonly [number, number];
  width: number;
}

const STREET_SEGMENTS: readonly StreetSegment[] = [
  // Main east-west road south of CiMS
  { from: [-50, 22], to: [55, 22], width: 3 },
  // North-south road east of CiMS
  { from: [8, -35], to: [8, 48], width: 2.5 },
  // Road connecting HyCatt to New ZeMA
  { from: [15, -5], to: [40, -5], width: 2 },
  // Road north of CiMS
  { from: [-45, -28], to: [20, -28], width: 2.5 },
  // Road south of htw saar
  { from: [-20, 45], to: [35, 45], width: 2 },
  // Road west of UdS
  { from: [-48, 25], to: [-48, 45], width: 2 },
];

const disposedFabric = new WeakSet<THREE.Group>();

export function createUrbanFabric(
  palette: MaterialPalette,
  density: number,
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'urban-fabric';
  if (density <= 0) return root;

  const materialMap: Record<string, THREE.MeshStandardMaterial> = {
    context: palette.context,
    groupShell: palette.groupShell,
    civicHub: palette.civicHub,
  };

  const buildingsToShow = Math.round(CONTEXT_BUILDINGS.length * density);
  for (let i = 0; i < buildingsToShow; i++) {
    const def = CONTEXT_BUILDINGS[i]!;
    const material = materialMap[def.material] ?? palette.context;

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(def.size[0], 0.2, def.size[2]),
      palette.darkMetal,
    );
    plinth.position.set(def.position[0], 0.1, def.position[2]);
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(def.size[0] * 0.94, def.size[1], def.size[2] * 0.94),
      material,
    );
    walls.position.set(def.position[0], 0.2 + def.size[1] / 2, def.position[2]);
    walls.castShadow = true;
    walls.receiveShadow = true;

    const group = new THREE.Group();
    group.name = `context-building:${i}`;
    group.add(plinth, walls);
    root.add(group);
  }

  // Street segments
  for (let i = 0; i < STREET_SEGMENTS.length; i++) {
    const seg = STREET_SEGMENTS[i]!;
    const dx = seg.to[0] - seg.from[0];
    const dz = seg.to[1] - seg.from[1];
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const street = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.08, seg.width),
      palette.road,
    );
    street.position.set(
      (seg.from[0] + seg.to[0]) / 2,
      0.04,
      (seg.from[1] + seg.to[1]) / 2,
    );
    street.rotation.y = -Math.atan2(dz, dx);
    street.receiveShadow = true;
    street.name = `street:${i}`;
    root.add(street);
  }

  const fabric: THREE.Group = root;
  disposedFabric.add(fabric);
  return fabric;
}

export function disposeUrbanFabric(fabric: THREE.Group): void {
  if (!disposedFabric.has(fabric)) return;
  disposedFabric.delete(fabric);
  fabric.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
  fabric.removeFromParent();
}
