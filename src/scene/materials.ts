import * as THREE from 'three';

export interface MaterialPalette {
  ground: THREE.MeshToonMaterial;
  path: THREE.MeshToonMaterial;
  groupShell: THREE.MeshToonMaterial;
  civicHub: THREE.MeshToonMaterial;
  darkMetal: THREE.MeshToonMaterial;
  glass: THREE.MeshToonMaterial;
  thermalWarm: THREE.MeshToonMaterial;
  thermalCool: THREE.MeshToonMaterial;
  polymer: THREE.MeshToonMaterial;
  electronics: THREE.MeshToonMaterial;
  textile: THREE.MeshToonMaterial;
  sma: THREE.MeshToonMaterial;
  context: THREE.MeshToonMaterial;
  selectionEdge: THREE.MeshToonMaterial;
  land: THREE.MeshToonMaterial;
  clearing: THREE.MeshToonMaterial;
  districtAccent: THREE.MeshToonMaterial;
  routeActive: THREE.MeshToonMaterial;
  routePreview: THREE.MeshToonMaterial;
  routeMuted: THREE.MeshToonMaterial;
  pavement: THREE.MeshToonMaterial;
  sidewalk: THREE.MeshToonMaterial;
  curb: THREE.MeshToonMaterial;
  grass: THREE.MeshToonMaterial;
  road: THREE.MeshToonMaterial;
  landDark: THREE.MeshToonMaterial;
}

const disposedPalettes = new WeakSet<MaterialPalette>();

function createMaterial(
  color: string,
  options: Partial<THREE.MeshToonMaterialParameters> = {},
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, ...options });
}

export function createMaterialPalette(): MaterialPalette {
  return {
    // Neutral palette with engineering accent colors
    ground: createMaterial('#899c76'),           // neutral grey-green ground
    path: createMaterial('#b8bcb4'),             // neutral path
    groupShell: createMaterial('#e0ddd5'),       // neutral light grey buildings
    civicHub: createMaterial('#d8d4cc'),         // neutral grey hub
    darkMetal: createMaterial('#3a3a3a'),        // neutral dark grey metal
    glass: createMaterial('#a0c0d0', { transparent: true, opacity: 0.55, depthWrite: false }),  // neutral blue-grey glass
    thermalWarm: createMaterial('#e87840'),      // warm orange (accent)
    thermalCool: createMaterial('#60b0c0'),      // teal (accent)
    polymer: createMaterial('#c890d0'),          // purple (accent)
    electronics: createMaterial('#7090b0'),      // blue-grey (accent)
    textile: createMaterial('#c89060'),          // brown (accent)
    sma: createMaterial('#90b080'),              // sage green (accent)
    context: createMaterial('#c0bdb5'),          // neutral grey context
    selectionEdge: createMaterial('#f0a050'),    // warm orange selection
    land: createMaterial('#b8c8a0'),             // neutral green land
    clearing: createMaterial('#e0dcd4'),         // neutral cream clearing
    districtAccent: createMaterial('#8b9e6b'),   // green accent
    routeActive: createMaterial('#e08040'),      // orange route
    routePreview: createMaterial('#f0b060'),     // golden preview
    routeMuted: createMaterial('#a0a098'),       // neutral grey muted
    pavement: createMaterial('#c0bdb5'),         // neutral pavement
    sidewalk: createMaterial('#d8d4cc'),         // neutral light sidewalk
    curb: createMaterial('#a0a098'),             // neutral curb
    grass: createMaterial('#90b870'),            // green grass
    road: createMaterial('#8a8a82'),             // neutral road
    landDark: createMaterial('#80a060'),         // dark green
  };
}

export function disposeMaterialPalette(palette: MaterialPalette): void {
  if (disposedPalettes.has(palette)) return;
  disposedPalettes.add(palette);
  for (const material of new Set(Object.values(palette))) material.dispose();
}
