import * as THREE from 'three';
import type { MaterialPalette } from './materials';

export type TreeType = 'deciduous' | 'conifer';

const disposedVegetation = new WeakSet<THREE.Group>();

export function createTree(type: TreeType, palette: MaterialPalette): THREE.Group {
  const tree = new THREE.Group();
  tree.name = `tree:${type}`;

  // Trunk
  const trunkHeight = type === 'deciduous' ? 2.8 : 3.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, trunkHeight, 6),
    palette.darkMetal,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.name = 'trunk';
  tree.add(trunk);

  if (type === 'deciduous') {
    // Spherical crown (icosahedron for low-poly look)
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 1),
      palette.context,
    );
    crown.position.y = trunkHeight + 1.4;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = 'crown';
    tree.add(crown);
  } else {
    // Conical crown (cone)
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 4.0, 6),
      palette.sma,
    );
    crown.position.y = trunkHeight + 2.0;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = 'crown';
    tree.add(crown);
  }

  disposedVegetation.add(tree);
  return tree;
}

export function createBush(palette: MaterialPalette): THREE.Group {
  const bush = new THREE.Group();
  bush.name = 'bush';

  // Three spheres clustered together
  const positions: Array<[number, number, number]> = [
    [0, 0.5, 0],
    [0.5, 0.4, 0.4],
    [-0.4, 0.4, -0.3],
  ];

  for (let i = 0; i < positions.length; i++) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + i * 0.08, 6, 4),
      palette.context,
    );
    sphere.position.set(positions[i]![0], positions[i]![1], positions[i]![2]);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.name = `bush:lobe:${i}`;
    bush.add(sphere);
  }

  disposedVegetation.add(bush);
  return bush;
}

export function disposeVegetation(vegetation: THREE.Group): void {
  if (!disposedVegetation.has(vegetation)) return;
  disposedVegetation.delete(vegetation);
  vegetation.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
  vegetation.removeFromParent();
}
