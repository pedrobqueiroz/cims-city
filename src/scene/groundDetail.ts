import * as THREE from 'three';
import type { MaterialPalette } from './materials';

// European city block grid layout
// Main avenues run east-west and north-south
// Side streets create rectangular blocks

interface StreetSegment {
  from: readonly [number, number];
  to: readonly [number, number];
  width: number;
  name: string;
}

// Main avenues (wide, 4-6 units)
const MAIN_AVENUES: readonly StreetSegment[] = [
  // East-West main avenue through CiMS
  { from: [-80, -20], to: [40, -20], width: 5, name: 'CiMS Avenue' },
  // North-South main avenue through CiMS
  { from: [-30, -60], to: [-30, 40], width: 5, name: 'Research Boulevard' },
  // East-West avenue south of CiMS
  { from: [-80, 15], to: [40, 15], width: 4, name: 'Innovation Street' },
  // North-South avenue east of CiMS
  { from: [10, -60], to: [10, 40], width: 4, name: 'Technology Drive' },
];

// Side streets (narrower, 2-3 units)
const SIDE_STREETS: readonly StreetSegment[] = [
  // Horizontal side streets creating blocks
  { from: [-60, -40], to: [20, -40], width: 2.5, name: 'Block Street 1' },
  { from: [-60, -5], to: [20, -5], width: 2.5, name: 'Block Street 2' },
  { from: [-60, 30], to: [20, 30], width: 2.5, name: 'Block Street 3' },
  // Vertical side streets creating blocks
  { from: [-55, -50], to: [-55, 30], width: 2.5, name: 'Block Street 4' },
  { from: [-10, -50], to: [-10, 30], width: 2.5, name: 'Block Street 5' },
  { from: [25, -50], to: [25, 30], width: 2.5, name: 'Block Street 6' },
];

// Plazas at key intersections
interface Plaza {
  position: readonly [number, number];
  size: readonly [number, number];
  name: string;
}

const PLAZAS: readonly Plaza[] = [
  { position: [-30, -20], size: [20, 16], name: 'Central Plaza' },
  { position: [10, -20], size: [14, 12], name: 'East Plaza' },
  { position: [-30, 15], size: [16, 12], name: 'South Plaza' },
  { position: [10, 15], size: [12, 10], name: 'Technology Plaza' },
];

const disposedDetail = new WeakSet<THREE.Group>();

export function createGroundDetail(palette: MaterialPalette): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ground-detail';

  // Create main avenues
  for (let i = 0; i < MAIN_AVENUES.length; i++) {
    const avenue = MAIN_AVENUES[i]!;
    const dx = avenue.to[0] - avenue.from[0];
    const dz = avenue.to[1] - avenue.from[1];
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const street = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.12, avenue.width),
      palette.road,
    );
    street.position.set(
      (avenue.from[0] + avenue.to[0]) / 2,
      0.06,
      (avenue.from[1] + avenue.to[1]) / 2,
    );
    street.rotation.y = -Math.atan2(dz, dx);
    street.receiveShadow = true;
    street.name = `avenue:${i}`;
    root.add(street);

    // Sidewalks on both sides
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.18, 2.0),
        palette.sidewalk,
      );
      sidewalk.position.set(
        (avenue.from[0] + avenue.to[0]) / 2,
        0.09,
        (avenue.from[1] + avenue.to[1]) / 2 + (avenue.width / 2 + 1.0) * side,
      );
      sidewalk.rotation.y = -Math.atan2(dz, dx);
      sidewalk.receiveShadow = true;
      sidewalk.name = `sidewalk:avenue:${i}:${side > 0 ? 'right' : 'left'}`;
      root.add(sidewalk);

      // Curb
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.1, 0.15),
        palette.curb,
      );
      curb.position.set(
        (avenue.from[0] + avenue.to[0]) / 2,
        0.15,
        (avenue.from[1] + avenue.to[1]) / 2 + (avenue.width / 2 + 0.075) * side,
      );
      curb.rotation.y = -Math.atan2(dz, dx);
      curb.receiveShadow = true;
      curb.name = `curb:avenue:${i}:${side > 0 ? 'right' : 'left'}`;
      root.add(curb);
    }
  }

  // Create side streets
  for (let i = 0; i < SIDE_STREETS.length; i++) {
    const street = SIDE_STREETS[i]!;
    const dx = street.to[0] - street.from[0];
    const dz = street.to[1] - street.from[1];
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const streetMesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.1, street.width),
      palette.road,
    );
    streetMesh.position.set(
      (street.from[0] + street.to[0]) / 2,
      0.05,
      (street.from[1] + street.to[1]) / 2,
    );
    streetMesh.rotation.y = -Math.atan2(dz, dx);
    streetMesh.receiveShadow = true;
    streetMesh.name = `street:${i}`;
    root.add(streetMesh);
  }

  // Create plazas
  for (let i = 0; i < PLAZAS.length; i++) {
    const plaza = PLAZAS[i]!;
    const plazaMesh = new THREE.Mesh(
      new THREE.BoxGeometry(plaza.size[0], 0.2, plaza.size[1]),
      palette.pavement,
    );
    plazaMesh.position.set(plaza.position[0], 0.1, plaza.position[1]);
    plazaMesh.receiveShadow = true;
    plazaMesh.name = `plaza:${i}`;
    root.add(plazaMesh);
  }

  // Create planted areas in blocks between streets
  const plantedAreas: Array<{ pos: [number, number]; size: [number, number] }> = [
    { pos: [-42, -30], size: [12, 8] },
    { pos: [-42, 5], size: [12, 8] },
    { pos: [-18, -30], size: [12, 8] },
    { pos: [-18, 5], size: [12, 8] },
    { pos: [16, -30], size: [8, 8] },
    { pos: [16, 5], size: [8, 8] },
    { pos: [-42, 22], size: [12, 6] },
    { pos: [-18, 22], size: [12, 6] },
  ];

  for (let i = 0; i < plantedAreas.length; i++) {
    const area = plantedAreas[i]!;
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(area.size[0], 0.12, area.size[1]),
      palette.grass,
    );
    patch.position.set(area.pos[0], 0.06, area.pos[1]);
    patch.receiveShadow = true;
    patch.name = `planted:${i}`;
    root.add(patch);
  }

  // Add benches along streets
  const benchPositions: Array<{ position: readonly [number, number, number]; rotation: number }> = [
    { position: [-30, 0, -22], rotation: 0 },
    { position: [10, 0, -22], rotation: 0 },
    { position: [-30, 0, 20], rotation: 0 },
    { position: [10, 0, 20], rotation: 0 },
  ];

  for (let i = 0; i < benchPositions.length; i++) {
    const bench = benchPositions[i]!;
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.5),
      palette.darkMetal,
    );
    seat.position.set(bench.position[0], 0.5, bench.position[2]);
    seat.rotation.y = bench.rotation;
    seat.castShadow = true;
    seat.name = `bench:seat:${i}`;
    root.add(seat);

    for (let leg = 0; leg < 2; leg++) {
      const legMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.5, 0.08),
        palette.darkMetal,
      );
      legMesh.position.set(
        bench.position[0] + (leg === 0 ? -0.6 : 0.6) * Math.cos(bench.rotation),
        0.25,
        bench.position[2] + (leg === 0 ? -0.6 : 0.6) * Math.sin(bench.rotation),
      );
      legMesh.rotation.y = bench.rotation;
      legMesh.castShadow = true;
      legMesh.name = `bench:leg:${i}:${leg}`;
      root.add(legMesh);
    }
  }

  // Add lampposts along streets
  const lamppostPositions: Array<readonly [number, number, number]> = [
    [-30, 0, -28],
    [10, 0, -28],
    [-30, 0, 22],
    [10, 0, 22],
    [-55, 0, -5],
    [25, 0, -5],
  ];

  for (let i = 0; i < lamppostPositions.length; i++) {
    const pos = lamppostPositions[i]!;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
      palette.darkMetal,
    );
    post.position.set(pos[0], 1.75, pos[2]);
    post.castShadow = true;
    post.name = `lamppost:post:${i}`;
    root.add(post);

    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 4),
      palette.selectionEdge,
    );
    light.position.set(pos[0], 3.6, pos[2]);
    light.name = `lamppost:light:${i}`;
    root.add(light);
  }

  disposedDetail.add(root);
  return root;
}

export function disposeGroundDetail(detail: THREE.Group): void {
  if (!disposedDetail.has(detail)) return;
  disposedDetail.delete(detail);
  detail.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
  detail.removeFromParent();
}
