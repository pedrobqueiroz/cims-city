import * as THREE from 'three';
import type { Motif, NeighborhoodEntity } from '../data/schema';
import { DISTRICT_LAYOUT, SEI_LAND_POINTS, scopeBounds } from './atlasLayout';
import type { LayoutNode } from './layout';
import type { MaterialPalette } from './materials';

export interface EntityVisual {
  root: THREE.Group;
  visible: THREE.Group;
  proxy: THREE.Mesh;
  labelAnchor: THREE.Object3D;
  focusAnchor: THREE.Object3D;
}

interface OwnedResources {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  disposed: boolean;
}

const resourcesByVisual = new WeakMap<EntityVisual, OwnedResources>();

function mesh(
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

function motifGroup(motif: Motif): THREE.Group {
  const group = new THREE.Group();
  group.name = `motif:${motif}`;
  group.userData.motif = motif;
  return group;
}

function createResearchShell(id: string, palette: MaterialPalette): THREE.Group {
  const shell = new THREE.Group();
  shell.name = `shell:${id}`;
  shell.userData = { footprint: '10x7', wallHeight: 4.8, plan: 'L-plan' };

  // Main volume (shifted left)
  shell.add(
    mesh(new THREE.BoxGeometry(7, 0.3, 7), palette.darkMetal, 'shell:plinth-main', [-1.5, 0.15, 0]),
    mesh(new THREE.BoxGeometry(7, 4.5, 7), palette.groupShell, 'shell:walls-main', [-1.5, 2.55, 0]),
    mesh(new THREE.BoxGeometry(6.9, 0.72, 7), palette.glass, 'shell:glazing-main', [-1.5, 3.25, 0]),
  );

  // Wing (shifted right and back)
  shell.add(
    mesh(new THREE.BoxGeometry(4, 0.3, 5), palette.darkMetal, 'shell:plinth-wing', [3, 0.15, -1]),
    mesh(new THREE.BoxGeometry(4, 3.2, 5), palette.groupShell, 'shell:walls-wing', [3, 1.9, -1]),
    mesh(new THREE.BoxGeometry(3.9, 0.6, 5), palette.glass, 'shell:glazing-wing', [3, 2.5, -1]),
  );

  // Entrance canopy at the L corner
  shell.add(
    mesh(new THREE.BoxGeometry(2.4, 0.15, 1.0), palette.darkMetal, 'shell:canopy', [0.5, 3.1, 2.9]),
    mesh(new THREE.BoxGeometry(0.2, 3.1, 0.2), palette.darkMetal, 'shell:column:0', [-0.4, 1.55, 3.2]),
    mesh(new THREE.BoxGeometry(0.2, 3.1, 0.2), palette.darkMetal, 'shell:column:1', [1.4, 1.55, 3.2]),
  );

  // Entrance door
  shell.add(
    mesh(new THREE.BoxGeometry(1.6, 2.4, 0.16), palette.darkMetal, 'shell:entrance', [0.5, 1.5, 3.42]),
  );

  return shell;
}

function createThermalMotif(palette: MaterialPalette): THREE.Group {
  const group = motifGroup('thermal');
  group.userData.finCount = 6;
  const geometry = new THREE.BoxGeometry(0.18, 1.6, 2.8);

  for (let index = 0; index < 6; index += 1) {
    const fin = mesh(
      geometry,
      index % 2 === 0 ? palette.thermalWarm : palette.thermalCool,
      `thermal:fin:${index}`,
      [-3.75 + index * 1.5, 5.6, 0],
    );
    group.add(fin);
  }
  return group;
}

function createPolymerMotif(palette: MaterialPalette): THREE.Group {
  const group = motifGroup('polymer');
  group.userData.ribCount = 3;

  for (const [index, z] of [-2, 0, 2].entries()) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.25, 4.92, z),
      new THREE.Vector3(-2.2, 5.6, z),
      new THREE.Vector3(0, 6.15, z),
      new THREE.Vector3(2.2, 5.6, z),
      new THREE.Vector3(4.25, 4.92, z),
    ]);
    const rib = mesh(
      new THREE.TubeGeometry(curve, 10, 0.09, 4, false),
      palette.polymer,
      `polymer:canopy-rib:${index}`,
      [0, 0, 0],
    );
    group.add(rib);
  }
  return group;
}

function createElectronicsMotif(palette: MaterialPalette): THREE.Group {
  const group = motifGroup('electronics');
  const cellGeometry = new THREE.BoxGeometry(0.62, 0.34, 0.08);
  const grid = new THREE.InstancedMesh(cellGeometry, palette.electronics, 12);
  grid.name = 'electronics:facade-grid';
  grid.castShadow = true;
  const matrix = new THREE.Matrix4();
  let instance = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      matrix.makeTranslation(-1.65 + column * 1.1, 1.15 + row * 0.72, 3.46);
      grid.setMatrixAt(instance, matrix);
      instance += 1;
    }
  }
  grid.instanceMatrix.needsUpdate = true;

  const rooftop = mesh(
    new THREE.BoxGeometry(2.2, 0.9, 1.6),
    palette.electronics,
    'electronics:rooftop-box',
    [0, 5.25, 0],
  );
  group.userData = { motif: 'electronics', facadeCells: 12, rooftopBoxes: 1 };
  group.add(grid, rooftop);
  return group;
}

function createTextileMotif(palette: MaterialPalette): THREE.Group {
  const group = motifGroup('textile');
  const slatGeometry = new THREE.BoxGeometry(5.5, 0.12, 0.16);

  for (const [index, rotation] of [Math.PI / 4, -Math.PI / 4].entries()) {
    const array = new THREE.InstancedMesh(slatGeometry, palette.textile, 5);
    array.name = `textile:slat-array:${index}`;
    array.rotation.y = rotation;
    array.castShadow = true;
    const matrix = new THREE.Matrix4();
    for (let slat = 0; slat < 5; slat += 1) {
      matrix.makeTranslation(0, 5.08 + Math.abs(slat - 2) * 0.08, (slat - 2) * 0.65);
      array.setMatrixAt(slat, matrix);
    }
    array.instanceMatrix.needsUpdate = true;
    group.add(array);
  }
  group.userData = { motif: 'textile', arrays: 2, slatsPerArray: 5 };
  return group;
}

function createFoldedRoofGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    -4.5, 4.85, -2.8, -4.5, 6.05, 0, 4.5, 4.85, -2.8,
    4.5, 4.85, -2.8, -4.5, 6.05, 0, 4.5, 6.05, 0,
    -4.5, 6.05, 0, -4.5, 4.85, 2.8, 4.5, 6.05, 0,
    4.5, 6.05, 0, -4.5, 4.85, 2.8, 4.5, 4.85, 2.8,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createSmaMotif(palette: MaterialPalette): THREE.Group {
  const group = motifGroup('sma');
  const roof = mesh(createFoldedRoofGeometry(), palette.sma, 'sma:folded-roof', [0, 0, 0]);
  group.add(roof);

  for (const [index, x] of [-2, 2].entries()) {
    const loop = mesh(
      new THREE.TorusGeometry(0.55, 0.08, 4, 12),
      palette.sma,
      `sma:loop:${index}`,
      [x, 5.58, 1.15],
    );
    group.add(loop);
  }
  group.userData = { motif: 'sma', loops: 2, foldedRoof: true };
  return group;
}

function createResearchMotif(motif: Motif | undefined, palette: MaterialPalette): THREE.Group | undefined {
  switch (motif) {
    case 'thermal': return createThermalMotif(palette);
    case 'polymer': return createPolymerMotif(palette);
    case 'electronics': return createElectronicsMotif(palette);
    case 'textile': return createTextileMotif(palette);
    case 'sma': return createSmaMotif(palette);
    default: return undefined;
  }
}

function populateResearchGroup(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = {
    visualFamily: 'research-group',
    footprint: '10x7',
    motif: entity.motif,
  };
  visible.add(createResearchShell(entity.id, palette));
  const motif = createResearchMotif(entity.motif, palette);
  if (motif) visible.add(motif);
  return 7;
}

function populateCivicHub(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'civic-atrium';
  const shell = new THREE.Group();
  shell.name = `shell:${entity.id}`;

  // Main atrium body
  shell.add(
    mesh(new THREE.BoxGeometry(12, 0.3, 8), palette.darkMetal, 'hub:plinth', [0, 0.15, 0]),
    mesh(new THREE.BoxGeometry(11, 2.7, 7), palette.civicHub, 'hub:atrium', [0, 1.65, 0]),
    mesh(new THREE.BoxGeometry(7.5, 1.1, 7.1), palette.glass, 'hub:glazing', [0, 2.42, 0]),
  );

  // Side wing
  shell.add(
    mesh(new THREE.BoxGeometry(5, 2.2, 6), palette.civicHub, 'hub:wing', [7, 1.4, -0.5]),
    mesh(new THREE.BoxGeometry(4.9, 0.5, 6), palette.glass, 'hub:wing-glazing', [7, 2.15, -0.5]),
  );

  // Entrance canopy with columns
  shell.add(
    mesh(new THREE.BoxGeometry(8, 0.18, 3), palette.darkMetal, 'hub:canopy', [0, 3.2, 4.5]),
    mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), palette.darkMetal, 'hub:column:0', [-3, 1.6, 5.5]),
    mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), palette.darkMetal, 'hub:column:1', [3, 1.6, 5.5]),
    mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), palette.darkMetal, 'hub:column:2', [-3, 1.6, 3.5]),
    mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), palette.darkMetal, 'hub:column:3', [3, 1.6, 3.5]),
  );

  // Rooftop mechanical box
  shell.add(
    mesh(new THREE.BoxGeometry(3, 0.8, 2), palette.darkMetal, 'hub:rooftop', [0, 3.6, -2]),
  );

  visible.add(shell);
  return 4.2;
}

function populateSoftLab(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'soft-lab', motif: 'soft-robotics' };
  const shell = new THREE.Group();
  shell.name = `shell:${entity.id}`;
  shell.add(
    mesh(new THREE.BoxGeometry(9, 0.3, 6), palette.darkMetal, 'soft-lab:plinth', [0, 0.15, 0]),
    mesh(new THREE.BoxGeometry(8.5, 2.7, 5.5), palette.groupShell, 'soft-lab:walls', [0, 1.65, 0]),
    mesh(new THREE.BoxGeometry(6, 1.1, 0.12), palette.glass, 'soft-lab:glazing', [0, 1.8, 2.69]),
  );

  const canopy = motifGroup('soft-robotics');
  for (const [index, z] of [-2.35, 0, 2.35].entries()) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-4.15, 3.02, z),
      new THREE.Vector3(0, 4.45, z),
      new THREE.Vector3(4.15, 3.02, z),
    );
    canopy.add(mesh(
      new THREE.TubeGeometry(curve, 8, 0.08, 4, false),
      palette.polymer,
      `soft-lab:canopy-rib:${index}`,
      [0, 0, 0],
    ));
  }
  canopy.userData = { motif: 'soft-robotics', ribCount: 3 };
  visible.add(shell, canopy);
  return 4.2;
}

function populateLand(visible: THREE.Group, layout: LayoutNode, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'institutional-land';
  const shape = new THREE.Shape();
  const first = SEI_LAND_POINTS[0]!;
  shape.moveTo(first[0] - layout.position[0], first[1] - layout.position[2]);
  for (const point of SEI_LAND_POINTS.slice(1)) {
    shape.lineTo(point[0] - layout.position[0], point[1] - layout.position[2]);
  }
  shape.closePath();
  const surfaceGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });
  surfaceGeometry.rotateX(Math.PI / 2);
  visible.add(mesh(surfaceGeometry, palette.ground, 'land:sei:surface', [0, -0.05, 0]));

  for (const district of DISTRICT_LAYOUT.values()) {
    const size = district.bounds.getSize(new THREE.Vector3());
    const clearing = mesh(
      new THREE.BoxGeometry(size.x, 0.12, size.z),
      palette.path,
      `clearing:${district.id}`,
      [
        district.center.x - layout.position[0],
        0.02,
        district.center.z - layout.position[2],
      ],
    );
    clearing.castShadow = false;
    visible.add(clearing);
  }
  return 3;
}

function populateHycatt(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'hycatt-campus';

  // Main research block
  visible.add(
    mesh(new THREE.BoxGeometry(8, 3.2, 6), palette.context, 'hycatt:mass:0', [-4.5, 1.6, 0]),
    mesh(new THREE.BoxGeometry(7, 4.2, 6), palette.groupShell, 'hycatt:mass:1', [4.5, 2.1, 0]),
  );

  // Glass link between masses
  visible.add(
    mesh(new THREE.BoxGeometry(3, 1.1, 2.4), palette.glass, 'hycatt:link', [0, 2.4, 0]),
  );

  // Landmark tower (octagonal)
  visible.add(
    mesh(new THREE.CylinderGeometry(1.1, 1.4, 8, 8), palette.darkMetal, 'hycatt:landmark', [8.5, 4, -1]),
  );

  // Side wing
  visible.add(
    mesh(new THREE.BoxGeometry(4, 2.8, 4), palette.context, 'hycatt:wing', [-8, 1.4, 2]),
    mesh(new THREE.BoxGeometry(3.9, 0.6, 4), palette.glass, 'hycatt:wing-glazing', [-8, 2.5, 2]),
  );

  // Entrance canopy
  visible.add(
    mesh(new THREE.BoxGeometry(4, 0.15, 2), palette.darkMetal, 'hycatt:canopy', [0, 3.5, 4]),
  );

  return 9;
}

function populateNewZema(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'new-zema-campus';

  // Four volumes in an asymmetric cluster
  visible.add(
    mesh(new THREE.BoxGeometry(7, 2.4, 5), palette.context, 'new-zema:volume:0', [-6, 1.2, 1]),
    mesh(new THREE.BoxGeometry(6, 3.1, 5), palette.groupShell, 'new-zema:volume:1', [0.5, 1.55, -1]),
    mesh(new THREE.BoxGeometry(5, 2, 4), palette.context, 'new-zema:volume:2', [6, 1, 1.5]),
    mesh(new THREE.BoxGeometry(3.5, 2.8, 3), palette.groupShell, 'new-zema:volume:3', [4, 1.4, -4]),
  );

  // Folded roof landmark
  const roof = mesh(createFoldedRoofGeometry(), palette.sma, 'new-zema:folded-roof', [0.5, -0.3, -1]);
  roof.scale.set(0.72, 0.72, 0.72);
  roof.rotation.y = -0.12;
  visible.add(roof);

  // Glass link between volumes
  visible.add(
    mesh(new THREE.BoxGeometry(2.5, 1.2, 2), palette.glass, 'new-zema:link', [-2.5, 1.8, 0]),
  );

  return 5.2;
}

function populateUds(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'academic-pair';

  // Three volumes for academic campus feel
  visible.add(
    mesh(new THREE.BoxGeometry(7, 3.8, 5), palette.context, 'uds:academic:0', [-4, 1.9, 0]),
    mesh(new THREE.BoxGeometry(6, 5, 5), palette.groupShell, 'uds:academic:1', [4, 2.5, 0]),
    mesh(new THREE.BoxGeometry(3.5, 2.6, 3.5), palette.context, 'uds:academic:2', [0, 1.3, -4]),
  );

  // Glass connector
  visible.add(
    mesh(new THREE.BoxGeometry(2, 1.2, 2), palette.glass, 'uds:connector', [0, 1.8, -0.5]),
  );

  return 6;
}

function populateHtwSaar(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'workshop-tower-pair';

  // Workshop + tower + small annex
  visible.add(
    mesh(new THREE.BoxGeometry(9, 2.8, 6), palette.context, 'htw-saar:workshop', [-3, 1.4, 0]),
    mesh(new THREE.BoxGeometry(3.5, 7, 3.5), palette.darkMetal, 'htw-saar:tower', [5, 3.5, 0]),
    mesh(new THREE.BoxGeometry(3, 2, 3), palette.groupShell, 'htw-saar:annex', [5, 1, -4]),
  );

  // Entrance canopy
  visible.add(
    mesh(new THREE.BoxGeometry(3, 0.12, 1.5), palette.darkMetal, 'htw-saar:canopy', [-3, 2.9, 3.5]),
  );

  return 7.8;
}

function contextDimensions(entity: NeighborhoodEntity): readonly [number, number, number] {
  if (entity.category === 'umbrella') return [16, 2.2, 10];
  if (entity.category === 'sei-pillar') return [10, 2.6, 6.5];
  return [8, 2.1, 5.5];
}

function populateContextBlock(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'context-block';
  const [width, height, depth] = contextDimensions(entity);
  visible.add(
    mesh(new THREE.BoxGeometry(width, 0.24, depth), palette.darkMetal, 'context:plinth', [0, 0.12, 0]),
    mesh(new THREE.BoxGeometry(width * 0.94, height, depth * 0.94), palette.context, 'context:block', [0, 0.24 + height / 2, 0]),
  );
  return height + 0.65;
}

function populateVisible(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  switch (entity.category) {
    case 'umbrella': return 0;
    case 'research-group': return populateResearchGroup(visible, entity, palette);
    case 'hub': return populateCivicHub(visible, entity, palette);
    case 'adjacent-lab': return populateSoftLab(visible, entity, palette);
    case 'sei-pillar': return entity.id === 'hycatt'
      ? populateHycatt(visible, palette)
      : populateNewZema(visible, palette);
    case 'external-partner': return entity.id === 'uds'
      ? populateUds(visible, palette)
      : populateHtwSaar(visible, palette);
    default: return populateContextBlock(visible, entity, palette);
  }
}

function collectOwnedGeometries(root: THREE.Object3D): Set<THREE.BufferGeometry> {
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) geometries.add(child.geometry);
  });
  return geometries;
}

export function createEntityBuilding(
  entity: NeighborhoodEntity,
  layout: LayoutNode,
  palette: MaterialPalette,
): EntityVisual {
  const root = new THREE.Group();
  root.name = entity.id === 'sei' ? 'land:sei' : `entity:${entity.id}`;
  root.position.set(...layout.position);
  root.userData = { entityId: entity.id, category: entity.category };

  const visible = new THREE.Group();
  visible.name = `visible:${entity.id}`;
  const labelHeight = entity.id === 'sei'
    ? populateLand(visible, layout, palette)
    : populateVisible(visible, entity, palette);

  const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  proxyMaterial.visible = false;
  const district = DISTRICT_LAYOUT.get(entity.id as 'new-zema' | 'hycatt' | 'uds' | 'htw-saar');
  const districtSize = district?.bounds.getSize(new THREE.Vector3());
  const landBounds = entity.id === 'sei' ? scopeBounds('sei') : undefined;
  const landSize = landBounds?.getSize(new THREE.Vector3());
  visible.updateMatrixWorld(true);
  const visualBounds = new THREE.Box3().setFromObject(visible);
  const visualSize = visualBounds.getSize(new THREE.Vector3());
  const proxySize = landSize
    ? [landSize.x, 1, landSize.z] as const
    : districtSize
      ? [districtSize.x, districtSize.y, districtSize.z] as const
      : [visualSize.x, visualSize.y, visualSize.z] as const;
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(...proxySize), proxyMaterial);
  proxy.name = `proxy:${entity.id}`;
  if (landBounds) {
    const center = landBounds.getCenter(new THREE.Vector3());
    proxy.position.set(
      center.x - layout.position[0],
      0.5,
      center.z - layout.position[2],
    );
  } else if (district) {
    proxy.position.set(
      district.center.x - layout.position[0],
      district.center.y - layout.position[1],
      district.center.z - layout.position[2],
    );
  } else proxy.position.copy(visualBounds.getCenter(new THREE.Vector3()));
  proxy.visible = false;
  proxy.userData.entityId = entity.id;

  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = `label:${entity.id}`;
  labelAnchor.position.set(0, labelHeight, 0);

  const focusAnchor = new THREE.Object3D();
  focusAnchor.name = `focus:${entity.id}`;
  focusAnchor.position.set(
    layout.focus.target[0] - layout.position[0],
    layout.focus.target[1] - layout.position[1],
    layout.focus.target[2] - layout.position[2],
  );

  root.add(visible, proxy, labelAnchor, focusAnchor);
  const visual = { root, visible, proxy, labelAnchor, focusAnchor };
  resourcesByVisual.set(visual, {
    geometries: collectOwnedGeometries(root),
    materials: new Set([proxyMaterial]),
    disposed: false,
  });
  return visual;
}

export function disposeEntityVisual(visual: EntityVisual): void {
  const resources = resourcesByVisual.get(visual);
  if (!resources || resources.disposed) return;
  resources.disposed = true;
  for (const geometry of [...resources.geometries].reverse()) geometry.dispose();
  for (const material of [...resources.materials].reverse()) material.dispose();
}
