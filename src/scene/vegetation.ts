import * as THREE from 'three';
import type { MaterialPalette } from './materials';

export type TreeType = 'deciduous' | 'conifer';

const disposedVegetation = new WeakSet<THREE.Group>();

export function createTree(type: TreeType, palette: MaterialPalette): THREE.Group {
  const tree = new THREE.Group();
  tree.name = `tree:${type}`;

  // Trunk
  const trunkHeight = type === 'deciduous' ? 4.0 : 5.0;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 6),
    palette.darkMetal,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.name = 'trunk';
  tree.add(trunk);

  // Branches (2-3 small cylinders)
  for (let i = 0; i < 2; i++) {
    const angle = (i * Math.PI * 0.8) + Math.PI * 0.2;
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 1.2, 4),
      palette.darkMetal,
    );
    branch.position.set(
      Math.cos(angle) * 0.4,
      trunkHeight * 0.6 + i * 0.5,
      Math.sin(angle) * 0.4,
    );
    branch.rotation.z = Math.cos(angle) * 0.5;
    branch.rotation.x = Math.sin(angle) * 0.3;
    branch.castShadow = true;
    branch.name = `branch:${i}`;
    tree.add(branch);
  }

  if (type === 'deciduous') {
    // Spherical crown (icosahedron for low-poly look)
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.5, 1),
      palette.context,
    );
    crown.position.y = trunkHeight + 2.0;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = 'crown';
    tree.add(crown);

    // Fruits (small spheres on crown)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 4),
        palette.thermalWarm,
      );
      fruit.position.set(
        Math.cos(angle) * 2.5,
        trunkHeight + 3.5,
        Math.sin(angle) * 2.5,
      );
      fruit.castShadow = true;
      fruit.name = `fruit:${i}`;
      tree.add(fruit);
    }
  } else {
    // Conical crown (cone)
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 6.0, 6),
      palette.sma,
    );
    crown.position.y = trunkHeight + 3.0;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = 'crown';
    tree.add(crown);

    // Pine cones (small spheres)
    for (let i = 0; i < 2; i++) {
      const angle = (i * Math.PI) + Math.PI * 0.5;
      const pineCone = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        palette.textile,
      );
      pineCone.position.set(
        Math.cos(angle) * 1.5,
        trunkHeight + 1.5,
        Math.sin(angle) * 1.5,
      );
      pineCone.castShadow = true;
      pineCone.name = `pinecone:${i}`;
      tree.add(pineCone);
    }
  }

  disposedVegetation.add(tree);
  return tree;
}

export function createBush(palette: MaterialPalette): THREE.Group {
  const bush = new THREE.Group();
  bush.name = 'bush';

  // Main bush body (three spheres clustered together)
  const positions: Array<[number, number, number]> = [
    [0, 0.8, 0],
    [0.8, 0.6, 0.6],
    [-0.6, 0.6, -0.5],
  ];

  for (let i = 0; i < positions.length; i++) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.8 + i * 0.12, 6, 4),
      palette.context,
    );
    sphere.position.set(positions[i]![0], positions[i]![1], positions[i]![2]);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.name = `bush:lobe:${i}`;
    bush.add(sphere);
  }

  // Flowers (small colored spheres)
  const flowerPositions: Array<[number, number, number, THREE.Material]> = [
    [0.5, 1.2, 0.3, palette.thermalWarm],
    [-0.3, 1.1, 0.6, palette.thermalCool],
    [0.1, 1.3, -0.4, palette.polymer],
  ];

  for (let i = 0; i < flowerPositions.length; i++) {
    const [x, y, z, material] = flowerPositions[i]!;
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 4),
      material,
    );
    flower.position.set(x, y, z);
    flower.castShadow = true;
    flower.name = `flower:${i}`;
    bush.add(flower);
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
