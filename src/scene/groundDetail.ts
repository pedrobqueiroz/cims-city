import * as THREE from 'three';
import type { MaterialPalette } from './materials';

interface SidewalkSegment {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
}

const SIDEWALK_SEGMENTS: readonly SidewalkSegment[] = [
  // Along CiMS district south edge
  { position: [-24, 0.08, 16], size: [48, 0.15, 1.5] },
  // Along CiMS district east edge
  { position: [-1, 0.08, -6], size: [1.5, 0.15, 50] },
  // Along HyCatt district west edge
  { position: [12, 0.08, 15], size: [1.5, 0.15, 30] },
  // Along New ZeMA district south edge
  { position: [27, 0.08, -7], size: [38, 0.15, 1.5] },
  // Along UdS district east edge
  { position: [-31, 0.08, 35], size: [1.5, 0.15, 17] },
  // Along htw saar district north edge
  { position: [-6, 0.08, 28], size: [29, 0.15, 1.5] },
  // Plaza in front of CiMS hub
  { position: [-24, 0.06, 0], size: [14, 0.12, 8] },
  // Plaza between HyCatt and New ZeMA
  { position: [28, 0.06, -5], size: [8, 0.12, 6] },
];

interface PlantedArea {
  position: readonly [number, number, number];
  size: readonly [number, number];
}

const PLANTED_AREAS: readonly PlantedArea[] = [
  // Between CiMS and htw saar
  { position: [-15, 0, 24], size: [8, 6] },
  // North of New ZeMA
  { position: [30, 0, -30], size: [10, 5] },
  // East of HyCatt
  { position: [48, 0, 20], size: [6, 8] },
  // West of UdS
  { position: [-52, 0, 35], size: [5, 8] },
  // Central green area
  { position: [5, 0, 10], size: [12, 8] },
  // South of CiMS
  { position: [-20, 0, -32], size: [15, 5] },
];

const disposedDetail = new WeakSet<THREE.Group>();

export function createGroundDetail(palette: MaterialPalette): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ground-detail';

  // Sidewalks
  for (let i = 0; i < SIDEWALK_SEGMENTS.length; i++) {
    const seg = SIDEWALK_SEGMENTS[i]!;
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(seg.size[0], seg.size[1], seg.size[2]),
      palette.sidewalk,
    );
    sidewalk.position.set(seg.position[0], seg.position[1], seg.position[2]);
    sidewalk.receiveShadow = true;
    sidewalk.name = `sidewalk:${i}`;
    root.add(sidewalk);

    // Curb on one side
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(seg.size[0], 0.08, 0.15),
      palette.curb,
    );
    curb.position.set(seg.position[0], seg.position[1] + 0.04, seg.position[2] + seg.size[2] / 2);
    curb.receiveShadow = true;
    curb.name = `curb:${i}`;
    root.add(curb);
  }

  // Road markings (center lines on streets)
  const markingPositions: Array<{ position: readonly [number, number, number]; length: number; rotation: number }> = [
    { position: [-24, 0.06, 22], length: 48, rotation: 0 },
    { position: [8, 0.06, -6], length: 50, rotation: Math.PI / 2 },
    { position: [28, 0.06, -5], length: 25, rotation: 0 },
  ];

  for (let i = 0; i < markingPositions.length; i++) {
    const mk = markingPositions[i]!;
    const marking = new THREE.Mesh(
      new THREE.BoxGeometry(mk.length, 0.02, 0.15),
      palette.selectionEdge,
    );
    marking.position.set(mk.position[0], mk.position[1], mk.position[2]);
    marking.rotation.y = mk.rotation;
    marking.receiveShadow = true;
    marking.name = `road-marking:${i}`;
    root.add(marking);
  }

  // Planted areas
  for (let i = 0; i < PLANTED_AREAS.length; i++) {
    const area = PLANTED_AREAS[i]!;
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(area.size[0], 0.06, area.size[1]),
      palette.grass,
    );
    patch.position.set(area.position[0], 0.03, area.position[2]);
    patch.receiveShadow = true;
    patch.name = `planted:${i}`;
    root.add(patch);
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
