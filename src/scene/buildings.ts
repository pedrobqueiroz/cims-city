import * as THREE from 'three';
import type { NeighborhoodEntity } from '../data/schema';
import { DISTRICT_LAYOUT, scopeBounds } from './atlasLayout';
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

// ============================================================================
// BUILDING TYPES - Each creates a unique multi-volume structure
// ============================================================================

// ============================================================================
// DIVERSE BUILDING SHAPES - Hateno Village style variety
// ============================================================================

function createRoundHouse(id: string, palette: MaterialPalette, radius: number = 3, height: number = 4): THREE.Group {
  const house = new THREE.Group();
  house.name = `round-house:${id}`;

  // Stone foundation ring
  house.add(mesh(
    new THREE.CylinderGeometry(radius + 0.3, radius + 0.5, 0.6, 12),
    palette.context, 'foundation', [0, 0.3, 0],
  ));

  // Cylindrical walls
  house.add(mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    palette.groupShell, 'walls', [0, 0.6 + height / 2, 0],
  ));

  // Conical thatched roof
  house.add(mesh(
    new THREE.ConeGeometry(radius + 0.8, 2.5, 12),
    palette.textile, 'roof', [0, 0.6 + height + 1.25, 0],
  ));

  // Door
  house.add(mesh(
    new THREE.BoxGeometry(1.0, 2.0, 0.15),
    palette.darkMetal, 'door', [0, 1.6, radius - 0.1],
  ));

  // Round windows (2)
  for (let i = 0; i < 2; i++) {
    const angle = (i * Math.PI) + Math.PI / 2;
    house.add(mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8),
      palette.glass, `window:${i}`,
      [Math.cos(angle) * (radius - 0.05), height * 0.6, Math.sin(angle) * (radius - 0.05)],
    ));
  }

  return house;
}

function createLShapedBuilding(id: string, palette: MaterialPalette): THREE.Group {
  const building = new THREE.Group();
  building.name = `l-shaped:${id}`;

  // Main wing
  building.add(mesh(
    new THREE.BoxGeometry(8, 4, 6),
    palette.groupShell, 'wing-main', [-2, 2.5, 0],
  ));

  // Side wing (perpendicular)
  building.add(mesh(
    new THREE.BoxGeometry(5, 3.5, 8),
    palette.groupShell, 'wing-side', [4, 2.25, -2],
  ));

  // Foundation for both
  building.add(mesh(
    new THREE.BoxGeometry(12, 0.5, 10),
    palette.context, 'foundation', [0, 0.25, -1],
  ));

  // Roof main (pitched)
  const roofMain = new THREE.BufferGeometry();
  const rmPositions = new Float32Array([
    -6, 4.5, -3, 2, 4.5, -3, -2, 6.5, 0,
    2, 4.5, -3, 2, 4.5, 3, -2, 6.5, 0,
    2, 4.5, 3, -6, 4.5, 3, -2, 6.5, 0,
    -6, 4.5, 3, -6, 4.5, -3, -2, 6.5, 0,
  ]);
  roofMain.setAttribute('position', new THREE.BufferAttribute(rmPositions, 3));
  roofMain.computeVertexNormals();
  building.add(mesh(roofMain, palette.textile, 'roof-main', [0, 0, 0]));

  // Roof side (flat)
  building.add(mesh(
    new THREE.BoxGeometry(5.5, 0.2, 8.5),
    palette.darkMetal, 'roof-side', [4, 4.1, -2],
  ));

  // Door
  building.add(mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.15),
    palette.darkMetal, 'door', [-2, 1.6, 3.1],
  ));

  return building;
}

function createTower(id: string, palette: MaterialPalette, floors: number = 4): THREE.Group {
  const tower = new THREE.Group();
  tower.name = `tower:${id}`;

  const radius = 2.5;
  const floorHeight = 3.0;
  const totalHeight = floors * floorHeight;

  // Foundation
  tower.add(mesh(
    new THREE.CylinderGeometry(radius + 0.3, radius + 0.5, 0.6, 8),
    palette.context, 'foundation', [0, 0.3, 0],
  ));

  // Cylindrical tower body
  tower.add(mesh(
    new THREE.CylinderGeometry(radius, radius, totalHeight, 8),
    palette.groupShell, 'body', [0, 0.6 + totalHeight / 2, 0],
  ));

  // Conical roof
  tower.add(mesh(
    new THREE.ConeGeometry(radius + 0.5, 3.0, 8),
    palette.textile, 'roof', [0, 0.6 + totalHeight + 1.5, 0],
  ));

  // Windows on each floor
  for (let floor = 0; floor < floors; floor++) {
    const angle = (floor * Math.PI / 2);
    tower.add(mesh(
      new THREE.BoxGeometry(0.6, 1.0, 0.1),
      palette.glass, `window:${floor}`,
      [Math.cos(angle) * (radius - 0.05), 0.6 + floor * floorHeight + 1.5, Math.sin(angle) * (radius - 0.05)],
    ));
  }

  // Door
  tower.add(mesh(
    new THREE.BoxGeometry(1.0, 2.0, 0.15),
    palette.darkMetal, 'door', [0, 1.6, radius - 0.1],
  ));

  return tower;
}

function createOrganicBuilding(id: string, palette: MaterialPalette): THREE.Group {
  const building = new THREE.Group();
  building.name = `organic:${id}`;

  // Main irregular volume (two intersecting boxes)
  building.add(mesh(
    new THREE.BoxGeometry(7, 4, 5),
    palette.groupShell, 'volume-1', [-1, 2.5, 0],
  ));
  building.add(mesh(
    new THREE.BoxGeometry(5, 3.5, 7),
    palette.groupShell, 'volume-2', [3, 2.25, -1],
  ));

  // Shared foundation
  building.add(mesh(
    new THREE.BoxGeometry(14, 0.5, 10),
    palette.context, 'foundation', [0, 0.25, -0.5],
  ));

  // Roof volume 1 (pitched)
  const roof1 = new THREE.BufferGeometry();
  const r1Positions = new Float32Array([
    -5, 4.5, -3, 3, 4.5, -3, -1, 6.5, 0,
    3, 4.5, -3, 3, 4.5, 3, -1, 6.5, 0,
    3, 4.5, 3, -5, 4.5, 3, -1, 6.5, 0,
    -5, 4.5, 3, -5, 4.5, -3, -1, 6.5, 0,
  ]);
  roof1.setAttribute('position', new THREE.BufferAttribute(r1Positions, 3));
  roof1.computeVertexNormals();
  building.add(mesh(roof1, palette.textile, 'roof-1', [0, 0, 0]));

  // Roof volume 2 (flat)
  building.add(mesh(
    new THREE.BoxGeometry(5.5, 0.2, 7.5),
    palette.darkMetal, 'roof-2', [3, 4.1, -1],
  ));

  // Windows
  building.add(mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.1),
    palette.glass, 'window-1', [-1, 2.5, 2.6],
  ));
  building.add(mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.1),
    palette.glass, 'window-2', [3, 2.0, -4.6],
  ));

  // Door
  building.add(mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.15),
    palette.darkMetal, 'door', [-1, 1.6, 2.6],
  ));

  return building;
}

function createClusteredBuilding(id: string, palette: MaterialPalette): THREE.Group {
  const cluster = new THREE.Group();
  cluster.name = `cluster:${id}`;

  // Three connected volumes at different heights
  const volumes: Array<{ pos: [number, number, number]; size: [number, number, number]; roofH: number }> = [
    { pos: [-4, 0, 0], size: [5, 3.5, 5], roofH: 2.0 },
    { pos: [2, 0, -2], size: [4, 4.5, 4], roofH: 2.5 },
    { pos: [0, 0, 4], size: [3.5, 3.0, 3.5], roofH: 1.8 },
  ];

  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i]!;
    // Foundation
    cluster.add(mesh(
      new THREE.BoxGeometry(v.size[0] + 0.4, 0.5, v.size[2] + 0.4),
      palette.context, `foundation:${i}`, [v.pos[0], 0.25, v.pos[2]],
    ));
    // Walls
    cluster.add(mesh(
      new THREE.BoxGeometry(v.size[0], v.size[1], v.size[2]),
      palette.groupShell, `walls:${i}`, [v.pos[0], 0.5 + v.size[1] / 2, v.pos[2]],
    ));
    // Roof
    const roofGeom = new THREE.BufferGeometry();
    const hw = v.size[0] / 2 + 0.2;
    const hd = v.size[2] / 2 + 0.2;
    const ry = 0.5 + v.size[1];
    const roofPositions = new Float32Array([
      v.pos[0] - hw, ry, v.pos[2] - hd,
      v.pos[0] + hw, ry, v.pos[2] - hd,
      v.pos[0], ry + v.roofH, v.pos[2],
      v.pos[0] + hw, ry, v.pos[2] - hd,
      v.pos[0] + hw, ry, v.pos[2] + hd,
      v.pos[0], ry + v.roofH, v.pos[2],
      v.pos[0] + hw, ry, v.pos[2] + hd,
      v.pos[0] - hw, ry, v.pos[2] + hd,
      v.pos[0], ry + v.roofH, v.pos[2],
      v.pos[0] - hw, ry, v.pos[2] + hd,
      v.pos[0] - hw, ry, v.pos[2] - hd,
      v.pos[0], ry + v.roofH, v.pos[2],
    ]);
    roofGeom.setAttribute('position', new THREE.BufferAttribute(roofPositions, 3));
    roofGeom.computeVertexNormals();
    cluster.add(mesh(roofGeom, palette.textile, `roof:${i}`, [0, 0, 0]));
  }

  // Door on first volume
  cluster.add(mesh(
    new THREE.BoxGeometry(1.0, 2.0, 0.15),
    palette.darkMetal, 'door', [-4, 1.6, 2.6],
  ));

  return cluster;
}

// ============================================================================
// NEIGHBORHOOD BUILDERS - Each creates a unique district
// ============================================================================

function createElastocaloricsDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:elastocalorics';

  // Main round house (thermal research)
  const mainHouse = createRoundHouse('elastocalorics-main', palette, 3.5, 4.5);
  mainHouse.position.set(0, 0, 0);
  district.add(mainHouse);

  // L-shaped workshop
  const workshop = createLShapedBuilding('elastocalorics-workshop', palette);
  workshop.position.set(-10, 0, -4);
  workshop.scale.set(0.8, 0.8, 0.8);
  district.add(workshop);

  // Tower (observation/cooling)
  const tower = createTower('elastocalorics-tower', palette, 3);
  tower.position.set(8, 0, -6);
  district.add(tower);

  // Clustered storage
  const storage = createClusteredBuilding('elastocalorics-storage', palette);
  storage.position.set(-5, 0, 10);
  storage.scale.set(0.7, 0.7, 0.7);
  district.add(storage);

  // Small organic house
  const smallHouse = createOrganicBuilding('elastocalorics-small', palette);
  smallHouse.position.set(6, 0, 8);
  smallHouse.scale.set(0.6, 0.6, 0.6);
  district.add(smallHouse);

  return district;
}

function createElectroactivePolymersDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:electroactive-polymers';

  // Main organic building (polymer research)
  const mainBuilding = createOrganicBuilding('eap-main', palette);
  mainBuilding.position.set(0, 0, 0);
  district.add(mainBuilding);

  // Round lab
  const lab = createRoundHouse('eap-lab', palette, 2.8, 3.5);
  lab.position.set(8, 0, -3);
  district.add(lab);

  // L-shaped office
  const office = createLShapedBuilding('eap-office', palette);
  office.position.set(-8, 0, 5);
  office.scale.set(0.7, 0.7, 0.7);
  district.add(office);

  // Tower storage
  const tower = createTower('eap-tower', palette, 2);
  tower.position.set(4, 0, 10);
  district.add(tower);

  return district;
}

function createSmartMaterialElectronicsDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:smart-material-electronics';

  // Main tower (electronics research)
  const tower = createTower('sme-tower', palette, 4);
  tower.position.set(0, 0, 0);
  district.add(tower);

  // Clustered lab
  const lab = createClusteredBuilding('sme-lab', palette);
  lab.position.set(-8, 0, -4);
  district.add(lab);

  // Round workshop
  const workshop = createRoundHouse('sme-workshop', palette, 3, 3);
  workshop.position.set(7, 0, 5);
  district.add(workshop);

  // L-shaped office
  const office = createLShapedBuilding('sme-office', palette);
  office.position.set(-4, 0, 8);
  office.scale.set(0.6, 0.6, 0.6);
  district.add(office);

  return district;
}

function createSmartTextilesDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:smart-textiles';

  // Main L-shaped building (textile research)
  const mainBuilding = createLShapedBuilding('st-main', palette);
  mainBuilding.position.set(0, 0, 0);
  district.add(mainBuilding);

  // Organic workshop
  const workshop = createOrganicBuilding('st-workshop', palette);
  workshop.position.set(-9, 0, -3);
  workshop.scale.set(0.8, 0.8, 0.8);
  district.add(workshop);

  // Round storage
  const storage = createRoundHouse('st-storage', palette, 2.5, 3);
  storage.position.set(7, 0, -5);
  district.add(storage);

  // Clustered small house
  const smallHouse = createClusteredBuilding('st-small', palette);
  smallHouse.position.set(-4, 0, 9);
  smallHouse.scale.set(0.6, 0.6, 0.6);
  district.add(smallHouse);

  return district;
}

function createShapeMemoryAlloysDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:shape-memory-alloys';

  // Main clustered building (industrial research)
  const mainBuilding = createClusteredBuilding('sma-main', palette);
  mainBuilding.position.set(0, 0, 0);
  district.add(mainBuilding);

  // Tower workshop
  const tower = createTower('sma-tower', palette, 3);
  tower.position.set(-9, 0, -4);
  district.add(tower);

  // Round lab
  const lab = createRoundHouse('sma-lab', palette, 3, 4);
  lab.position.set(8, 0, -3);
  district.add(lab);

  // L-shaped storage
  const storage = createLShapedBuilding('sma-storage', palette);
  storage.position.set(4, 0, 8);
  storage.scale.set(0.6, 0.6, 0.6);
  district.add(storage);

  return district;
}

// ============================================================================
// MAIN BUILDING CREATION FUNCTIONS
// ============================================================================

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

function populateResearchGroup(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'research-group', motif: entity.motif };

  let district: THREE.Group;
  switch (entity.motif) {
    case 'thermal': district = createElastocaloricsDistrict(palette); break;
    case 'polymer': district = createElectroactivePolymersDistrict(palette); break;
    case 'electronics': district = createSmartMaterialElectronicsDistrict(palette); break;
    case 'textile': district = createSmartTextilesDistrict(palette); break;
    case 'sma': district = createShapeMemoryAlloysDistrict(palette); break;
    default: district = createElastocaloricsDistrict(palette);
  }
  visible.add(district);
  return 8;
}

function populateCivicHub(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'civic-atrium' };

  // Main hub - large L-shaped building
  const hub = createLShapedBuilding('cims-hub', palette);
  hub.scale.set(1.3, 1.2, 1.3);
  hub.position.set(0, 0, 0);
  visible.add(hub);

  // Admin - round building
  const admin = createRoundHouse('cims-admin', palette, 3, 4.5);
  admin.position.set(-10, 0, -5);
  visible.add(admin);

  // Meeting hall - organic building
  const meeting = createOrganicBuilding('cims-meeting', palette);
  meeting.position.set(9, 0, 4);
  meeting.scale.set(0.9, 0.9, 0.9);
  visible.add(meeting);

  return 10;
}

function populateSoftLab(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'soft-lab' };

  // Organic lab building
  const lab = createOrganicBuilding('soft-robotics-lab', palette);
  lab.position.set(0, 0, 0);
  visible.add(lab);

  return 6;
}

function populateHycatt(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'hycatt-campus' };

  // Main round house
  const main = createRoundHouse('hycatt-main', palette, 3.5, 5);
  main.position.set(0, 0, 0);
  visible.add(main);

  // L-shaped lab
  const lab = createLShapedBuilding('hycatt-lab', palette);
  lab.position.set(-9, 0, -4);
  lab.scale.set(0.8, 0.8, 0.8);
  visible.add(lab);

  // Tower storage
  const tower = createTower('hycatt-tower', palette, 2);
  tower.position.set(7, 0, -5);
  visible.add(tower);

  return 8;
}

function populateNewZema(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'new-zema-campus' };

  // Main organic building
  const main = createOrganicBuilding('new-zema-main', palette);
  main.position.set(0, 0, 0);
  visible.add(main);

  // Clustered workshop
  const workshop = createClusteredBuilding('new-zema-workshop', palette);
  workshop.position.set(-8, 0, -3);
  workshop.scale.set(0.8, 0.8, 0.8);
  visible.add(workshop);

  // Round office
  const office = createRoundHouse('new-zema-office', palette, 2.5, 3);
  office.position.set(6, 0, 5);
  visible.add(office);

  return 7;
}

function populateUds(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'academic-pair' };

  // Main L-shaped building
  const main = createLShapedBuilding('uds-main', palette);
  main.position.set(0, 0, 0);
  visible.add(main);

  // Tower library
  const library = createTower('uds-library', palette, 3);
  library.position.set(-9, 0, 4);
  visible.add(library);

  return 7;
}

function populateHtwSaar(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'workshop-tower-pair' };

  // Clustered workshop
  const workshop = createClusteredBuilding('htw-saar-workshop', palette);
  workshop.position.set(0, 0, 0);
  visible.add(workshop);

  // Tower
  const tower = createTower('htw-saar-tower', palette, 4);
  tower.position.set(-9, 0, -5);
  visible.add(tower);

  // Organic annex
  const annex = createOrganicBuilding('htw-saar-annex', palette);
  annex.position.set(7, 0, 6);
  annex.scale.set(0.6, 0.6, 0.6);
  visible.add(annex);

  return 8;
}

function populateContextBlock(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'context-block' };

  // Use diverse building types for context blocks
  const buildingTypes = ['round', 'l-shaped', 'tower', 'organic', 'clustered'];
  const typeIndex = Math.abs(hashCode(entity.id)) % buildingTypes.length;
  const type = buildingTypes[typeIndex];

  let contextBuilding: THREE.Group;
  switch (type) {
    case 'round':
      contextBuilding = createRoundHouse(entity.id, palette, 2.5, 3);
      break;
    case 'l-shaped':
      contextBuilding = createLShapedBuilding(entity.id, palette);
      contextBuilding.scale.set(0.6, 0.6, 0.6);
      break;
    case 'tower':
      contextBuilding = createTower(entity.id, palette, 2);
      break;
    case 'organic':
      contextBuilding = createOrganicBuilding(entity.id, palette);
      contextBuilding.scale.set(0.5, 0.5, 0.5);
      break;
    case 'clustered':
      contextBuilding = createClusteredBuilding(entity.id, palette);
      contextBuilding.scale.set(0.5, 0.5, 0.5);
      break;
    default:
      contextBuilding = createRoundHouse(entity.id, palette, 2.5, 3);
  }

  visible.add(contextBuilding);
  return 5;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function populateLand(visible: THREE.Group, layout: LayoutNode, palette: MaterialPalette): number {
  visible.userData.visualFamily = 'institutional-land';

  // Create flowing terrain with PlaneGeometry and vertex displacement
  const terrainWidth = 130;
  const terrainDepth = 100;
  const segments = 32;
  const surfaceGeometry = new THREE.PlaneGeometry(terrainWidth, terrainDepth, segments, segments);
  surfaceGeometry.rotateX(-Math.PI / 2);

  // Add vertex displacement for rolling hills
  const positions = surfaceGeometry.attributes.position;
  if (positions) {
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.5
        + Math.sin(x * 0.02 + z * 0.03) * 0.8;
      positions.setY(i, height);
    }
    positions.needsUpdate = true;
  }
  surfaceGeometry.computeVertexNormals();

  visible.add(mesh(surfaceGeometry, palette.ground, 'land:sei:surface', [0, -0.5, 0]));

  // Add district clearings
  for (const district of DISTRICT_LAYOUT.values()) {
    const size = district.bounds.getSize(new THREE.Vector3());
    const clearing = mesh(
      new THREE.BoxGeometry(size.x, 0.15, size.z),
      palette.clearing,
      `clearing:${district.id}`,
      [district.center.x - layout.position[0], 0.1, district.center.z - layout.position[2]],
    );
    clearing.castShadow = false;
    visible.add(clearing);
  }
  return 3;
}

function collectOwnedGeometries(root: THREE.Object3D): Set<THREE.BufferGeometry> {
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) geometries.add(child.geometry);
  });
  return geometries;
}

export function disposeEntityVisual(visual: EntityVisual): void {
  const resources = resourcesByVisual.get(visual);
  if (!resources || resources.disposed) return;
  resources.disposed = true;
  for (const geometry of [...resources.geometries].reverse()) geometry.dispose();
  for (const material of [...resources.materials].reverse()) material.dispose();
}
