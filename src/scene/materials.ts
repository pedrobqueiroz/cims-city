import * as THREE from 'three';

export interface MaterialPalette {
  ground: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  groupShell: THREE.MeshStandardMaterial;
  civicHub: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  thermalWarm: THREE.MeshStandardMaterial;
  thermalCool: THREE.MeshStandardMaterial;
  polymer: THREE.MeshStandardMaterial;
  electronics: THREE.MeshStandardMaterial;
  textile: THREE.MeshStandardMaterial;
  sma: THREE.MeshStandardMaterial;
  context: THREE.MeshStandardMaterial;
  selectionEdge: THREE.MeshStandardMaterial;
  land: THREE.MeshStandardMaterial;
  clearing: THREE.MeshStandardMaterial;
  districtAccent: THREE.MeshStandardMaterial;
  routeActive: THREE.MeshStandardMaterial;
  routePreview: THREE.MeshStandardMaterial;
  routeMuted: THREE.MeshStandardMaterial;
}

const disposedPalettes = new WeakSet<MaterialPalette>();

function createMaterial(
  color: string,
  roughness: number,
  metalness = 0,
  options: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

export function createMaterialPalette(): MaterialPalette {
  return {
    ground: createMaterial('#d7ddd8', 0.78),
    path: createMaterial('#b7bcb8', 0.76),
    groupShell: createMaterial('#e5dfd4', 0.78),
    civicHub: createMaterial('#d8c9b4', 0.74),
    darkMetal: createMaterial('#28343b', 0.34, 0.72),
    glass: createMaterial('#6f8994', 0.18, 0, { transparent: true, opacity: 0.42, depthWrite: false }),
    thermalWarm: createMaterial('#d9754f', 0.52, 0.12),
    thermalCool: createMaterial('#4d91a7', 0.52, 0.12),
    polymer: createMaterial('#8a719b', 0.58, 0.08),
    electronics: createMaterial('#4f718e', 0.48, 0.18),
    textile: createMaterial('#a47b5d', 0.62, 0.04),
    sma: createMaterial('#71886d', 0.54, 0.18),
    context: createMaterial('#aeb7b4', 0.76),
    selectionEdge: createMaterial('#f4c45e', 0.5, 0.1),
    land: createMaterial('#c8d7b0', 0.72),
    clearing: createMaterial('#eae8df', 0.76),
    districtAccent: createMaterial('#8b9e6b', 0.58, 0.06),
    routeActive: createMaterial('#d4793b', 0.5, 0.1),
    routePreview: createMaterial('#e8a665', 0.52, 0.08),
    routeMuted: createMaterial('#9e9a90', 0.74),
  };
}

export function disposeMaterialPalette(palette: MaterialPalette): void {
  if (disposedPalettes.has(palette)) return;
  disposedPalettes.add(palette);
  for (const material of new Set(Object.values(palette))) material.dispose();
}
