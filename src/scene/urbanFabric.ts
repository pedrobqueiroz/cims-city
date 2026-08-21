import * as THREE from 'three';
import type { MaterialPalette } from './materials';

interface ContextBuilding {
  position: readonly [number, number, number];
  scale: number;
  hasChimney: boolean;
  hasPlanter: boolean;
  hasSign: boolean;
}

const CONTEXT_BUILDINGS: readonly ContextBuilding[] = [
  // North of CiMS
  { position: [-30, 0, -38], scale: 0.8, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [-18, 0, -38], scale: 0.9, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [-8, 0, -38], scale: 1.0, hasChimney: true, hasPlanter: false, hasSign: true },
  { position: [5, 0, -38], scale: 0.85, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [18, 0, -38], scale: 0.95, hasChimney: true, hasPlanter: true, hasSign: true },

  // East of HyCatt/New ZeMA
  { position: [55, 0, -10], scale: 0.8, hasChimney: true, hasPlanter: false, hasSign: true },
  { position: [55, 0, 5], scale: 0.9, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [55, 0, 20], scale: 0.85, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [55, 0, 35], scale: 0.95, hasChimney: false, hasPlanter: false, hasSign: false },

  // South of htw saar
  { position: [-15, 0, 50], scale: 0.8, hasChimney: true, hasPlanter: true, hasSign: false },
  { position: [0, 0, 50], scale: 0.9, hasChimney: false, hasPlanter: true, hasSign: true },
  { position: [15, 0, 50], scale: 1.0, hasChimney: true, hasPlanter: false, hasSign: false },
  { position: [30, 0, 50], scale: 0.85, hasChimney: false, hasPlanter: true, hasSign: true },

  // West of UdS
  { position: [-58, 0, 20], scale: 0.8, hasChimney: true, hasPlanter: true, hasSign: false },
  { position: [-58, 0, 35], scale: 0.9, hasChimney: false, hasPlanter: false, hasSign: true },
  { position: [-58, 0, 48], scale: 0.85, hasChimney: true, hasPlanter: true, hasSign: false },

  // Between districts
  { position: [0, 0, -25], scale: 0.8, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [15, 0, -20], scale: 0.85, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [-15, 0, 15], scale: 0.9, hasChimney: true, hasPlanter: false, hasSign: true },
  { position: [20, 0, 25], scale: 0.8, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [-25, 0, 25], scale: 0.85, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [35, 0, -15], scale: 0.9, hasChimney: false, hasPlanter: false, hasSign: false },
  { position: [-35, 0, -15], scale: 0.8, hasChimney: true, hasPlanter: true, hasSign: true },

  // Far context
  { position: [-65, 0, -20], scale: 0.9, hasChimney: true, hasPlanter: false, hasSign: true },
  { position: [-65, 0, 0], scale: 0.8, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [62, 0, -25], scale: 1.0, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [62, 0, 10], scale: 0.85, hasChimney: false, hasPlanter: false, hasSign: false },
  { position: [0, 0, -48], scale: 0.9, hasChimney: true, hasPlanter: true, hasSign: true },
  { position: [20, 0, -48], scale: 0.8, hasChimney: false, hasPlanter: true, hasSign: false },
  { position: [40, 0, 55], scale: 0.85, hasChimney: true, hasPlanter: false, hasSign: true },
  { position: [-20, 0, 55], scale: 0.9, hasChimney: false, hasPlanter: true, hasSign: false },
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

  const buildingsToShow = Math.round(CONTEXT_BUILDINGS.length * density);
  for (let i = 0; i < buildingsToShow; i++) {
    const def = CONTEXT_BUILDINGS[i]!;
    const house = createContextHouse(i, palette, def);
    house.position.set(def.position[0], 0, def.position[2]);
    house.scale.set(def.scale, def.scale, def.scale);
    root.add(house);
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

function createContextHouse(index: number, palette: MaterialPalette, options: ContextBuilding): THREE.Group {
  const house = new THREE.Group();
  house.name = `context-house:${index}`;

  // Foundation
  house.add(
    createMesh(new THREE.CylinderGeometry(2.8, 3.0, 0.5, 8), palette.context, 'house:foundation', [0, 0.25, 0]),
  );

  // Main walls (cylinder body)
  house.add(
    createMesh(new THREE.CylinderGeometry(2.6, 2.6, 3.5, 8), palette.groupShell, 'house:walls', [0, 2.0, 0]),
  );

  // Roof (cone)
  house.add(
    createMesh(new THREE.ConeGeometry(3.2, 2.0, 8), palette.textile, 'house:roof', [0, 5.0, 0]),
  );

  // Door
  house.add(
    createMesh(new THREE.BoxGeometry(1.0, 1.8, 0.12), palette.darkMetal, 'house:door', [0, 1.5, 2.55]),
  );

  // Windows (2)
  for (let i = 0; i < 2; i++) {
    const angle = (i * Math.PI) / 2;
    const x = Math.cos(angle) * 2.5;
    const z = Math.sin(angle) * 2.5;
    house.add(
      createMesh(new THREE.BoxGeometry(0.6, 0.8, 0.08), palette.glass, `house:window:${i}`, [x, 2.5, z]),
    );
  }

  // Chimney (optional)
  if (options.hasChimney) {
    house.add(
      createMesh(new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6), palette.context, 'house:chimney', [1.8, 5.0, 0]),
    );
  }

  // Planter (optional)
  if (options.hasPlanter) {
    house.add(
      createMesh(new THREE.CylinderGeometry(0.35, 0.3, 0.4, 6), palette.textile, 'house:planter', [2.2, 0.8, 2.0]),
      createMesh(new THREE.SphereGeometry(0.25, 6, 4), palette.thermalWarm, 'house:flower', [2.2, 1.2, 2.0]),
    );
  }

  // Sign (optional)
  if (options.hasSign) {
    house.add(
      createMesh(new THREE.BoxGeometry(0.8, 0.3, 0.04), palette.selectionEdge, 'house:sign', [0, 3.5, 2.7]),
    );
  }

  return house;
}

function createMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  position: readonly [number, number, number],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
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
