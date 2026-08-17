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
// ICONIC BUILDING GENERATOR - Egghead-first, futuristic engineering aesthetic
// ============================================================================

interface BuildingArchetype {
  type: 'tower' | 'atrium' | 'workshop' | 'laboratory' | 'office';
  floors: number;
  hasSolarPanels: boolean;
  hasAntennas: boolean;
  hasPipes: boolean;
  hasTurbines: boolean;
  hasGlassCurtainWall: boolean;
  hasLedStrips: boolean;
  hasSteelFrames: boolean;
  hasCoolingTowers: boolean;
  hasSatelliteDishes: boolean;
  hasWaterTanks: boolean;
}

function createIconicBuilding(id: string, palette: MaterialPalette, archetype: BuildingArchetype): THREE.Group {
  const building = new THREE.Group();
  building.name = `iconic:${id}`;

  const w = archetype.type === 'tower' ? 6 : archetype.type === 'atrium' ? 12 : 8;
  const d = archetype.type === 'tower' ? 6 : archetype.type === 'atrium' ? 10 : 7;
  const floorHeight = 3.5;
  const totalHeight = archetype.floors * floorHeight;

  // Foundation
  building.add(mesh(
    new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6),
    palette.darkMetal, 'foundation', [0, 0.3, 0],
  ));

  // Main volume
  building.add(mesh(
    new THREE.BoxGeometry(w, totalHeight, d),
    palette.groupShell, 'main-volume', [0, 0.6 + totalHeight / 2, 0],
  ));

  // Roof based on type
  if (archetype.type === 'tower') {
    // Flat roof with mechanical penthouse
    building.add(mesh(
    new THREE.BoxGeometry(w * 0.6, 1.5, d * 0.6),
    palette.darkMetal, 'penthouse', [0, 0.6 + totalHeight + 0.75, 0],
    ));
  } else if (archetype.type === 'atrium') {
    // Glass dome roof
    building.add(mesh(
      new THREE.SphereGeometry(w * 0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      palette.glass, 'dome-roof', [0, 0.6 + totalHeight, 0],
    ));
  } else {
    // Pitched roof
    const roofGeom = new THREE.BufferGeometry();
    const hw = w / 2 + 0.3;
    const hd = d / 2 + 0.3;
    const ry = 0.6 + totalHeight;
    const positions = new Float32Array([
      -hw, ry, -hd,  hw, ry, -hd,  0, ry + 2.5, 0,
      hw, ry, -hd,  hw, ry, hd,   0, ry + 2.5, 0,
      hw, ry, hd,   -hw, ry, hd,  0, ry + 2.5, 0,
      -hw, ry, hd,  -hw, ry, -hd, 0, ry + 2.5, 0,
    ]);
    roofGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    roofGeom.computeVertexNormals();
    building.add(mesh(roofGeom, palette.textile, 'roof', [0, 0, 0]));
  }

  // Windows (2-3 per floor)
  for (let floor = 0; floor < archetype.floors; floor++) {
    const windowCount = floor === 0 ? 2 : 3;
    for (let i = 0; i < windowCount; i++) {
      const x = -w / 2 + (w / (windowCount + 1)) * (i + 1);
      const y = 0.6 + floor * floorHeight + floorHeight * 0.5;
      building.add(mesh(
        new THREE.BoxGeometry(0.8, 1.0, 0.1),
        palette.glass, `window:${floor}:${i}`, [x, y, d / 2 + 0.05],
      ));
    }
  }

  // Door
  building.add(mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.15),
    palette.darkMetal, 'door', [0, 1.7, d / 2 + 0.08],
  ));

  // Glass curtain wall
  if (archetype.hasGlassCurtainWall) {
    building.add(mesh(
      new THREE.BoxGeometry(w * 0.8, totalHeight * 0.6, 0.1),
      palette.glass, 'curtain-wall', [0, 0.6 + totalHeight * 0.3, d / 2 + 0.1],
    ));
  }

  // Steel frames (exposed structure)
  if (archetype.hasSteelFrames) {
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 === 0 ? -1 : 1) * (w / 2 - 0.1);
      const z = (i < 2 ? -1 : 1) * (d / 2 - 0.1);
      building.add(mesh(
        new THREE.BoxGeometry(0.15, totalHeight + 1, 0.15),
        palette.darkMetal, `steel-frame:${i}`, [x, 0.6 + (totalHeight + 1) / 2, z],
      ));
    }
  }

  // Solar panels
  if (archetype.hasSolarPanels) {
    for (let i = 0; i < 3; i++) {
      building.add(mesh(
        new THREE.BoxGeometry(2.0, 0.08, 1.2),
        palette.electronics, `solar-panel:${i}`,
        [-3 + i * 3, 0.6 + totalHeight + 0.5, -d / 4],
      ));
    }
  }

  // Antennas
  if (archetype.hasAntennas) {
    for (let i = 0; i < 2; i++) {
      building.add(mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 4, 6),
        palette.darkMetal, `antenna:${i}`,
        [w / 4 * (i === 0 ? -1 : 1), 0.6 + totalHeight + 2, 0],
      ));
    }
  }

  // Pipes/conduits
  if (archetype.hasPipes) {
    for (let i = 0; i < 3; i++) {
      building.add(mesh(
        new THREE.CylinderGeometry(0.08, 0.08, totalHeight * 0.6, 8),
        palette.darkMetal, `pipe:${i}`,
        [-w / 2 - 0.2, 0.6 + totalHeight * 0.3, -d / 3 + i * (d / 3)],
      ));
    }
  }

  // Turbines
  if (archetype.hasTurbines) {
    for (let i = 0; i < 2; i++) {
      building.add(mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12),
        palette.darkMetal, `turbine:${i}`,
        [w / 3 * (i === 0 ? -1 : 1), 0.6 + totalHeight + 1, 0],
      ));
      building.add(mesh(
        new THREE.TorusGeometry(0.5, 0.06, 6, 12),
        palette.darkMetal, `turbine-ring:${i}`,
        [w / 3 * (i === 0 ? -1 : 1), 0.6 + totalHeight + 1, 0],
      ));
    }
  }

  // LED strips
  if (archetype.hasLedStrips) {
    building.add(mesh(
      new THREE.BoxGeometry(w, 0.08, 0.08),
      palette.selectionEdge, 'led-strip:bottom', [0, 0.65, d / 2 + 0.1],
    ));
    building.add(mesh(
      new THREE.BoxGeometry(w, 0.08, 0.08),
      palette.selectionEdge, 'led-strip:top', [0, 0.6 + totalHeight - 0.04, d / 2 + 0.1],
    ));
  }

  // Cooling towers
  if (archetype.hasCoolingTowers) {
    for (let i = 0; i < 2; i++) {
      building.add(mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 2.5, 8),
        palette.context, `cooling-tower:${i}`,
        [w / 3 * (i === 0 ? -1 : 1), 0.6 + totalHeight + 1.25, -d / 3],
      ));
    }
  }

  // Satellite dishes
  if (archetype.hasSatelliteDishes) {
    building.add(mesh(
      new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI),
      palette.darkMetal, 'satellite-dish',
      [w / 4, 0.6 + totalHeight + 0.5, -d / 3],
    ));
  }

  // Water tanks
  if (archetype.hasWaterTanks) {
    building.add(mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.2, 8),
      palette.context, 'water-tank',
      [-w / 4, 0.6 + totalHeight + 0.6, -d / 3],
    ));
  }

  return building;
}

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

  // Main lab - tall tower with solar panels and antennas
  const mainLab = createIconicBuilding('elastocalorics-main', palette, {
    type: 'tower', floors: 4,
    hasSolarPanels: true, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  mainLab.position.set(0, 0, 0);
  district.add(mainLab);

  // Workshop - industrial with pipes and turbines
  const workshop = createIconicBuilding('elastocalorics-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(-12, 0, -6);
  district.add(workshop);

  // Office - clean with glass curtain wall
  const office = createIconicBuilding('elastocalorics-office', palette, {
    type: 'office', floors: 3,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  office.position.set(10, 0, -8);
  district.add(office);

  // Storage - compact with pipes
  const storage = createIconicBuilding('elastocalorics-storage', palette, {
    type: 'workshop', floors: 1,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  storage.position.set(-6, 0, 10);
  district.add(storage);

  return district;
}

function createElectroactivePolymersDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:electroactive-polymers';

  // Main lab - atrium with glass dome
  const mainLab = createIconicBuilding('eap-main', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  mainLab.position.set(0, 0, 0);
  district.add(mainLab);

  // Tower - with antennas and satellite dish
  const tower = createIconicBuilding('eap-tower', palette, {
    type: 'tower', floors: 3,
    hasSolarPanels: false, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  tower.position.set(10, 0, -5);
  district.add(tower);

  // Workshop - with pipes and turbines
  const workshop = createIconicBuilding('eap-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: true, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  workshop.position.set(-10, 0, 6);
  district.add(workshop);

  // Office - clean with LED strips
  const office = createIconicBuilding('eap-office', palette, {
    type: 'office', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  office.position.set(5, 0, 10);
  district.add(office);

  return district;
}

function createSmartMaterialElectronicsDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:smart-material-electronics';

  // Main tower - tall with antennas and solar panels
  const tower = createIconicBuilding('sme-tower', palette, {
    type: 'tower', floors: 5,
    hasSolarPanels: true, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  tower.position.set(0, 0, 0);
  district.add(tower);

  // Lab - atrium with glass dome
  const lab = createIconicBuilding('sme-lab', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  lab.position.set(-10, 0, -5);
  district.add(lab);

  // Workshop - industrial with pipes and turbines
  const workshop = createIconicBuilding('sme-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(8, 0, 6);
  district.add(workshop);

  // Office - clean with LED strips
  const office = createIconicBuilding('sme-office', palette, {
    type: 'office', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  office.position.set(-5, 0, 10);
  district.add(office);

  return district;
}

function createSmartTextilesDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:smart-textiles';

  // Main lab - L-shaped with glass curtain wall
  const mainLab = createIconicBuilding('st-main', palette, {
    type: 'office', floors: 3,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  mainLab.position.set(0, 0, 0);
  district.add(mainLab);

  // Workshop - with pipes
  const workshop = createIconicBuilding('st-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(-10, 0, -4);
  district.add(workshop);

  // Tower - with antennas
  const tower = createIconicBuilding('st-tower', palette, {
    type: 'tower', floors: 3,
    hasSolarPanels: false, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  tower.position.set(8, 0, -6);
  district.add(tower);

  // Storage - compact
  const storage = createIconicBuilding('st-storage', palette, {
    type: 'workshop', floors: 1,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  storage.position.set(-5, 0, 10);
  district.add(storage);

  return district;
}

function createShapeMemoryAlloysDistrict(palette: MaterialPalette): THREE.Group {
  const district = new THREE.Group();
  district.name = 'district:shape-memory-alloys';

  // Main lab - tower with antennas and cooling towers
  const mainLab = createIconicBuilding('sma-main', palette, {
    type: 'tower', floors: 4,
    hasSolarPanels: false, hasAntennas: true, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: true, hasWaterTanks: true,
  });
  mainLab.position.set(0, 0, 0);
  district.add(mainLab);

  // Workshop - industrial with pipes and turbines
  const workshop = createIconicBuilding('sma-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(-10, 0, -5);
  district.add(workshop);

  // Lab - atrium with glass dome
  const lab = createIconicBuilding('sma-lab', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  lab.position.set(8, 0, -4);
  district.add(lab);

  // Storage - compact with pipes
  const storage = createIconicBuilding('sma-storage', palette, {
    type: 'workshop', floors: 1,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  storage.position.set(5, 0, 10);
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

  // Main hub - large atrium with glass dome
  const hub = createIconicBuilding('cims-hub', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: true, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  hub.scale.set(1.3, 1.2, 1.3);
  hub.position.set(0, 0, 0);
  visible.add(hub);

  // Admin building - tower with antennas
  const admin = createIconicBuilding('cims-admin', palette, {
    type: 'tower', floors: 3,
    hasSolarPanels: true, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  admin.position.set(-12, 0, -6);
  visible.add(admin);

  // Meeting hall - workshop with glass curtain wall
  const meeting = createIconicBuilding('cims-meeting', palette, {
    type: 'office', floors: 1,
    hasSolarPanels: false, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  meeting.position.set(10, 0, 5);
  visible.add(meeting);

  return 10;
}

function populateSoftLab(visible: THREE.Group, entity: NeighborhoodEntity, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'soft-lab' };

  // Lab - atrium with glass dome
  const lab = createIconicBuilding('soft-robotics-lab', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  lab.position.set(0, 0, 0);
  visible.add(lab);

  return 6;
}

function populateHycatt(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'hycatt-campus' };

  // Main facility - tower with pipes and turbines
  const main = createIconicBuilding('hycatt-main', palette, {
    type: 'tower', floors: 3,
    hasSolarPanels: false, hasAntennas: true, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: true, hasWaterTanks: true,
  });
  main.position.set(0, 0, 0);
  visible.add(main);

  // Lab - atrium with glass dome
  const lab = createIconicBuilding('hycatt-lab', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  lab.position.set(-10, 0, -5);
  visible.add(lab);

  // Storage - compact with pipes
  const storage = createIconicBuilding('hycatt-storage', palette, {
    type: 'workshop', floors: 1,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  storage.position.set(8, 0, -6);
  visible.add(storage);

  return 8;
}

function populateNewZema(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'new-zema-campus' };

  // Main building - atrium with glass dome
  const main = createIconicBuilding('new-zema-main', palette, {
    type: 'atrium', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  main.position.set(0, 0, 0);
  visible.add(main);

  // Workshop - industrial with pipes
  const workshop = createIconicBuilding('new-zema-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(-9, 0, -4);
  visible.add(workshop);

  // Office - clean with LED strips
  const office = createIconicBuilding('new-zema-office', palette, {
    type: 'office', floors: 2,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  office.position.set(7, 0, 6);
  visible.add(office);

  return 7;
}

function populateUds(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'academic-pair' };

  // Main building - office with glass curtain wall
  const main = createIconicBuilding('uds-main', palette, {
    type: 'office', floors: 3,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  main.position.set(0, 0, 0);
  visible.add(main);

  // Library - tower with antennas
  const library = createIconicBuilding('uds-library', palette, {
    type: 'tower', floors: 3,
    hasSolarPanels: false, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  library.position.set(-10, 0, 5);
  visible.add(library);

  return 7;
}

function populateHtwSaar(visible: THREE.Group, palette: MaterialPalette): number {
  visible.userData = { visualFamily: 'workshop-tower-pair' };

  // Workshop - industrial with pipes and turbines
  const workshop = createIconicBuilding('htw-saar-workshop', palette, {
    type: 'workshop', floors: 2,
    hasSolarPanels: false, hasAntennas: false, hasPipes: true,
    hasTurbines: true, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: true, hasSatelliteDishes: false, hasWaterTanks: true,
  });
  workshop.position.set(0, 0, 0);
  visible.add(workshop);

  // Tower - with antennas
  const tower = createIconicBuilding('htw-saar-tower', palette, {
    type: 'tower', floors: 4,
    hasSolarPanels: false, hasAntennas: true, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: false, hasLedStrips: false,
    hasSteelFrames: true, hasCoolingTowers: false, hasSatelliteDishes: true, hasWaterTanks: false,
  });
  tower.position.set(-10, 0, -5);
  visible.add(tower);

  // Annex - office with LED strips
  const annex = createIconicBuilding('htw-saar-annex', palette, {
    type: 'office', floors: 1,
    hasSolarPanels: true, hasAntennas: false, hasPipes: false,
    hasTurbines: false, hasGlassCurtainWall: true, hasLedStrips: true,
    hasSteelFrames: false, hasCoolingTowers: false, hasSatelliteDishes: false, hasWaterTanks: false,
  });
  annex.position.set(8, 0, 6);
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
  const terrainWidth = 400;
  const terrainDepth = 400;
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
